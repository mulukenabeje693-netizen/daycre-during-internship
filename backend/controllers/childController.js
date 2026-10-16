const Child = require('../models/Child');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Message = require('../models/Message');
const mongoose = require('mongoose');
const fs = require('fs');

/* ── Notify parent + all reception users on approval/disapproval ── */
const sendChildApprovalNotifications = async ({ child, action, adminId, adminReason, req }) => {
  try {
    const childName = `${child.firstName} ${child.lastName}`;
    const isApproved = action === 'approved';

    const subject = isApproved
      ? 'Child Registration Approved'
      : 'Child Registration Disapproved';

    const body = isApproved
      ? `Registration for ${childName} has been APPROVED by Admin.`
      : `Registration for ${childName} was DISAPPROVED by Admin. Reason: ${adminReason || 'No reason provided.'}`;

    // Collect recipient IDs: parents of the child + all reception users
    const receptionUsers = await User.find({ role: 'reception' }).select('_id');
    const parentIds = (child.parents || []).map(p => p._id || p);
    const receptionIds = receptionUsers.map(u => u._id);

    // Deduplicate recipients
    const allIdStrings = new Set([
      ...parentIds.map(id => id.toString()),
      ...receptionIds.map(id => id.toString()),
    ]);
    // Remove the admin themselves from recipients
    allIdStrings.delete(adminId.toString());

    const broadcastId = `child_approval_${child._id}_${Date.now()}`;

    const messages = Array.from(allIdStrings).map(recipientId => ({
      sender: adminId,
      recipient: recipientId,
      subject,
      body,
      relatedChild: child._id,
      priority: isApproved ? 'normal' : 'urgent',
      broadcastId,
      broadcastGroup: null,
    }));

    if (messages.length > 0) {
      const inserted = await Message.insertMany(messages);

      // Emit socket event to online users
      const io = req?.app?.get?.('io');
      const connectedUsers = req?.app?.get?.('connectedUsers');
      if (io && connectedUsers) {
        inserted.forEach(msg => {
          const recipientSocketId = connectedUsers.get(msg.recipient.toString());
          if (recipientSocketId) {
            // Send unpopulated msg, frontend just needs it for a generic ping to refetch or show a simple toast
            io.to(recipientSocketId).emit('newMessage', msg);
          }
        });
      }
    }
  } catch (err) {
    // Non-blocking — log but don't fail the main request
    console.error('sendChildApprovalNotifications error:', err.message);
  }
};

const getChildQueryForUser = async (user, childId) => {
  const query = { _id: childId };
  if (user.role === 'teacher') {
    const classrooms = await Classroom.find({ teacher: user._id, status: 'active' })
      .select('_id')
      .lean();
    query.classroom = { $in: classrooms.map(classroom => classroom._id) };
    query.status = { $in: ['active', 'approved', 'pending'] };
  }
  return query;
};

// @desc    Get all children (admin/teacher) or parent's children
// @route   GET /api/children
// @access  Private
const getChildren = async (req, res) => {
  try {
    let query = {};
    let assignmentStatus;
    let pendingCount = 0;
    let activeClassroomIds = [];

    if (req.user.role === 'parent') {
      query.parents = req.user._id;
    } else if (req.user.role === 'teacher') {
      const assignedClassrooms = await Classroom.find({ teacher: req.user._id })
        .select('_id status')
        .lean();
      activeClassroomIds = assignedClassrooms
        .filter(classroom => classroom.status === 'active')
        .map(classroom => classroom._id);

      if (activeClassroomIds.length === 0) {
        const assignmentStatus = assignedClassrooms.length > 0
          ? 'inactive_classroom'
          : 'unassigned';
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
          assignmentStatus,
          message: assignmentStatus === 'unassigned'
            ? 'No classroom is assigned to this nanny.'
            : 'The nanny is assigned to a classroom, but it is inactive.'
        });
      }

      query.classroom = { $in: activeClassroomIds };
      query.status = req.query.includePending === 'true'
        ? { $in: ['active', 'approved', 'pending'] }
        : { $in: ['active', 'approved'] };
      assignmentStatus = 'assigned';
    }

    const children = await Child.find(query)
      .populate('classroom', 'name ageGroup')
      .populate('parents', 'fullName email phone organization emergencyContact')
      .sort({ lastName: 1, firstName: 1 })
      .lean()
      .maxTimeMS(8000);

    const eligibleChildren = children;
    if (req.user.role === 'teacher') {
      pendingCount = req.query.includePending === 'true'
        ? children.filter(child => child.status === 'pending').length
        : await Child.countDocuments({
            classroom: { $in: activeClassroomIds },
            status: 'pending'
          }).maxTimeMS(8000);
      const enrolledCount = children.filter(child => ['active', 'approved'].includes(child.status)).length;
      assignmentStatus = enrolledCount > 0 ? 'assigned' : pendingCount > 0 ? 'pending' : 'empty';
    }

    // Normalise all nullable fields so frontend never sees null/undefined
    const normalised = eligibleChildren.map(c => ({
      ...c,
      allergies:        c.allergies        || '',
      medicalNotes:     c.medicalNotes     || '',
      photoUrl:         c.photoUrl         || null,
      vaccinationStatus: c.vaccinationStatus || 'unknown',
      emergencyContact: {
        name:         c.emergencyContact?.name         || '',
        phone:        c.emergencyContact?.phone        || '',
        relationship: c.emergencyContact?.relationship || '',
      },
      classroom: c.classroom || null,
      parents: (c.parents || []).map(p => ({
        ...p,
        phone:        p.phone        || null,
        organization: p.organization || null,
        emergencyContact: {
          name:         p.emergencyContact?.name         || '',
          phone:        p.emergencyContact?.phone        || '',
          relationship: p.emergencyContact?.relationship || '',
        },
      })),
    }));

    res.status(200).json({
      success: true,
      count: normalised.length,
      data: normalised,
      ...(req.user.role === 'teacher'
        ? {
            assignmentStatus,
            pendingCount,
            enrolledCount: normalised.filter(child => ['active', 'approved'].includes(child.status)).length
          }
        : {})
    });
  } catch (error) {
    console.error('Child roster retrieval failed:', {
      role: req.user?.role || 'unknown',
      errorName: error.name || 'Error'
    });
    res.status(500).json({
      success: false,
      code: 'CHILD_ROSTER_UNAVAILABLE',
      message: 'Could not load the child roster right now. Please retry.'
    });
  }
};

// @desc    Get single child
// @route   GET /api/children/:id
// @access  Private
const getChild = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid child ID.' });
    }

    const query = await getChildQueryForUser(req.user, req.params.id);
    const child = await Child.findOne(query)
      .populate('classroom', 'name ageGroup teacher')
      .populate('parents', 'fullName email phone organization emergencyContact')
      .lean();

    if (!child) {
      return res.status(404).json({ success: false, message: 'Child not found' });
    }

    const normalised = {
      ...child,
      allergies:        child.allergies        || '',
      medicalNotes:     child.medicalNotes     || '',
      photoUrl:         child.photoUrl         || null,
      vaccinationStatus: child.vaccinationStatus || 'unknown',
      emergencyContact: {
        name:         child.emergencyContact?.name         || '',
        phone:        child.emergencyContact?.phone        || '',
        relationship: child.emergencyContact?.relationship || '',
      },
      classroom: child.classroom || null,
      parents: (child.parents || []).map(p => ({
        ...p,
        phone:        p.phone        || null,
        organization: p.organization || null,
      })),
    };

    res.status(200).json({ success: true, data: normalised });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a child
// @route   POST /api/children
// @access  Private (admin, reception, parent)
const createChild = async (req, res) => {
  try {
    const childData = { ...req.body };

    // Parents may only register their own children and require admin review.
    // Use 'pending' so admin sees the registration in the approvals workflow.
    if (req.user.role === 'parent') {
      childData.parents = [req.user._id];
      childData.status = 'pending';
      childData.classroom = null;
      childData.parentName = req.user.fullName || '';

      if (
        typeof childData.firstName === 'string' &&
        childData.firstName.trim() &&
        typeof childData.lastName === 'string' &&
        childData.lastName.trim() &&
        childData.dateOfBirth
      ) {
        const existingChild = await Child.findOne({
          parents: req.user._id,
          firstName: childData.firstName.trim(),
          lastName: childData.lastName.trim(),
          dateOfBirth: new Date(childData.dateOfBirth)
        })
          .collation({ locale: 'en', strength: 2 })
          .lean();

        if (existingChild) {
          return res.status(200).json({
            success: true,
            data: existingChild,
            duplicate: true,
            message: 'This child is already registered under your account.'
          });
        }
      }
    }

    if (req.user.role !== 'parent' && childData.parents !== undefined) {
      const submittedParentIds = Array.isArray(childData.parents)
        ? childData.parents
        : [childData.parents];
      const parentIds = [...new Set(submittedParentIds.filter(id => id != null).map(String))];

      if (parentIds.some(id => !/^[a-f\d]{24}$/i.test(id))) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected parent IDs are invalid.'
        });
      }

      childData.parents = parentIds;
      if (parentIds.length > 0) {
        let validParents;
        try {
          validParents = await User.find({
            _id: { $in: parentIds },
            role: /^\s*parent\s*$/i
          }).select('_id fullName').lean();
        } catch (error) {
          console.error('Failed to validate selected parent accounts:', error.name);
          return res.status(503).json({
            success: false,
            message: 'Parent account validation is temporarily unavailable. Please retry.'
          });
        }

        if (validParents.length !== parentIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more selected accounts are not valid parent accounts.'
          });
        }

        childData.parents = validParents.map(parent => parent._id);
        childData.parentName = validParents
          .map(parent => typeof parent.fullName === 'string' ? parent.fullName.trim() : '')
          .filter(Boolean)
          .join(', ');
      }
    }

    // Reception can submit children for review before admin approval.
    if (req.user.role === 'reception') {
      childData.status = 'pending';
    }

    const child = await Child.create(childData);

    const populated = await Child.findById(child._id)
      .populate('classroom', 'name ageGroup')
      .populate('parents', 'fullName email');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Duplicate entry' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a child
// @route   PUT /api/children/:id
// @access  Private (admin, reception)
const updateChild = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid child ID.' });
    }

    const query = await getChildQueryForUser(req.user, req.params.id);
    const updates = req.user.role === 'teacher'
      ? Object.fromEntries(
          ['firstName', 'lastName', 'dateOfBirth', 'gender', 'allergies', 'medicalNotes', 'vaccinationStatus', 'emergencyContact']
            .filter(field => Object.prototype.hasOwnProperty.call(req.body, field))
            .map(field => [field, req.body[field]])
        )
      : req.body;
    const child = await Child.findOneAndUpdate(query, updates, {
      new: true,
      runValidators: true
    })
      .populate('classroom', 'name ageGroup')
      .populate('parents', 'fullName email phone');

    if (!child) {
      return res.status(404).json({ success: false, message: 'Child not found' });
    }

    res.status(200).json({ success: true, data: child });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update child's photo/avatar
// @route   PUT /api/children/:id/avatar
// @access  Private (parent of child, admin, reception, teacher)
const updateChildAvatar = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid child ID.' });
    }

    const query = await getChildQueryForUser(req.user, req.params.id);
    const child = await Child.findOne(query);
    if (!child) return res.status(404).json({ success: false, message: 'Child not found' });

    // Parents may only update their own child's photo
    if (req.user.role === 'parent') {
      const parentIds = (child.parents || []).map(p => String(p));
      if (!parentIds.includes(String(req.user._id))) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this child' });
      }
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Save as persistent base64 data URL so avatar survives cloud container restarts
    const fileBuffer = fs.readFileSync(req.file.path);
    const mimeType = req.file.mimetype || 'image/jpeg';
    child.photoUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    await child.save();

    try {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } catch (_) {}

    const populated = await Child.findById(child._id)
      .populate('classroom', 'name ageGroup')
      .populate('parents', 'fullName email phone');

    res.status(200).json({ success: true, data: populated, message: 'Child photo updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a child
// @route   DELETE /api/children/:id
// @access  Private (admin)
const deleteChild = async (req, res) => {
  try {
    const child = await Child.findByIdAndDelete(req.params.id);

    if (!child) {
      return res.status(404).json({ success: false, message: 'Child not found' });
    }

    res.status(200).json({ success: true, message: 'Child record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Assign child to classroom
// @route   PUT /api/children/:id/classroom
// @access  Private (admin)
const assignClassroom = async (req, res) => {
  try {
    const { classroomId } = req.body;
    if (classroomId) {
      const classroom = await Classroom.findById(classroomId).select('_id teacher');
      if (!classroom) {
        return res.status(404).json({ success: false, message: 'Classroom not found.' });
      }
      if (!classroom.teacher) {
        return res.status(409).json({ success: false, message: 'Assign a nanny to this classroom before enrolling children.' });
      }
      req.body = { teacherId: classroom.teacher, classroomId, childIds: [req.params.id] };
      return assignChildrenToClassroom(req, res);
    }

    const child = await Child.findByIdAndUpdate(
      req.params.id,
      { classroom: classroomId || null },
      { new: true }
    )
      .populate('classroom', 'name ageGroup')
      .populate('parents', 'fullName email');

    if (!child) {
      return res.status(404).json({ success: false, message: 'Child not found' });
    }

    res.status(200).json({ success: true, data: child });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const assignChildrenToClassroom = async (req, res) => {
  const { teacherId, classroomId, childIds } = req.body || {};
  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    return res.status(400).json({ success: false, message: 'Select a valid nanny.' });
  }
  if (!mongoose.Types.ObjectId.isValid(classroomId)) {
    return res.status(400).json({ success: false, message: 'Select a valid classroom.' });
  }
  if (
    !Array.isArray(childIds) ||
    childIds.length === 0 ||
    childIds.length > 100 ||
    childIds.some(id => !mongoose.Types.ObjectId.isValid(id)) ||
    new Set(childIds.map(String)).size !== childIds.length
  ) {
    return res.status(400).json({ success: false, message: 'Select one or more valid, unique children.' });
  }

  let session;
  try {
    session = await mongoose.startSession();
    let assigned;
    await session.withTransaction(async () => {
      const teacher = await User.findOne({
        _id: teacherId,
        role: 'teacher',
        isBlocked: { $ne: true }
      }).select('_id fullName').session(session).lean();
      if (!teacher) {
        const error = new Error('The selected nanny does not exist or is not eligible for assignments.');
        error.statusCode = 404;
        throw error;
      }

      const classroom = await Classroom.findById(classroomId).session(session).lean();
      if (!classroom) {
        const error = new Error('The selected classroom was not found.');
        error.statusCode = 404;
        throw error;
      }
      if (classroom.status !== 'active') {
        const error = new Error('The selected classroom is inactive. Choose an active classroom.');
        error.statusCode = 409;
        throw error;
      }
      if (classroom.teacher && String(classroom.teacher) !== String(teacher._id)) {
        const error = new Error(
          'This classroom is assigned to another nanny. Reassign the classroom explicitly before assigning children.'
        );
        error.statusCode = 409;
        throw error;
      }

      const children = await Child.find({ _id: { $in: childIds } })
        .select('_id classroom status')
        .session(session)
        .lean();
      if (children.length !== childIds.length) {
        const error = new Error('One or more selected children no longer exist. Refresh the list and try again.');
        error.statusCode = 404;
        throw error;
      }
      if (children.some(child => child.classroom)) {
        const error = new Error('One or more children have already been assigned. Refresh the list and select unassigned children.');
        error.statusCode = 409;
        throw error;
      }
      if (children.some(child => !['active', 'approved'].includes(child.status))) {
        const error = new Error('Children must be approved before they can be assigned to a classroom.');
        error.statusCode = 409;
        throw error;
      }

      const enrolledCount = await Child.countDocuments({
        classroom: classroom._id,
        status: { $in: ['active', 'approved'] }
      }).session(session);
      if (enrolledCount + childIds.length > classroom.capacity) {
        const availablePlaces = Math.max(0, classroom.capacity - enrolledCount);
        const error = new Error(
          `The classroom has ${availablePlaces} place${availablePlaces === 1 ? '' : 's'} available, but ${childIds.length} children were selected.`
        );
        error.statusCode = 409;
        throw error;
      }

      const classroomUpdate = await Classroom.updateOne(
        { _id: classroom._id, status: 'active' },
        {
          $set: { teacher: teacher._id },
          $inc: { assignmentRevision: 1 }
        },
        { session }
      );
      if (classroomUpdate.matchedCount !== 1) {
        const error = new Error('The classroom changed while assigning children. Refresh and try again.');
        error.statusCode = 409;
        throw error;
      }

      const childUpdate = await Child.updateMany(
        {
          _id: { $in: childIds },
          $or: [{ classroom: null }, { classroom: { $exists: false } }]
        },
        { $set: { classroom: classroom._id } },
        { session }
      );
      if (childUpdate.modifiedCount !== childIds.length) {
        const error = new Error('One or more children were assigned concurrently. No changes were saved; refresh and retry.');
        error.statusCode = 409;
        throw error;
      }

      assigned = {
        teacher: { id: String(teacher._id), name: teacher.fullName },
        classroom: { id: String(classroom._id), name: classroom.name },
        childIds: childIds.map(String),
        assignedCount: childUpdate.modifiedCount
      };
    });
    return res.status(200).json({ success: true, data: assigned });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error.code === 112 || error.code === 251 || error.hasErrorLabel?.('TransientTransactionError')) {
      return res.status(409).json({
        success: false,
        message: 'Another assignment changed this classroom at the same time. Refresh and retry.'
      });
    }
    console.error('Bulk child classroom assignment failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Could not save the child assignments. Please retry.'
    });
  } finally {
    if (session) await session.endSession();
  }
};

// @desc    Approve a child
// @route   PUT /api/children/:id/approve
// @access  Private (admin)
const approveChild = async (req, res) => {
  try {
    const { note } = req.body;
    const child = await Child.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', approvalNote: note || '' },
      { new: true, runValidators: true }
    )
      .populate('classroom', 'name ageGroup')
      .populate('parents', 'fullName email phone');

    if (!child) {
      return res.status(404).json({ success: false, message: 'Child not found' });
    }

    // Send notifications to parent + reception
    await sendChildApprovalNotifications({
      child,
      action: 'approved',
      adminId: req.user._id,
      adminReason: note || '',
      req,
    });

    res.status(200).json({ success: true, data: child });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Disapprove a child
// @route   PUT /api/children/:id/disapprove
// @access  Private (admin)
const disapproveChild = async (req, res) => {
  try {
    const { note } = req.body;
    const child = await Child.findByIdAndUpdate(
      req.params.id,
      { status: 'disapproved', approvalNote: note || '' },
      { new: true, runValidators: true }
    )
      .populate('classroom', 'name ageGroup')
      .populate('parents', 'fullName email phone');

    if (!child) {
      return res.status(404).json({ success: false, message: 'Child not found' });
    }

    // Send notifications to parent + reception
    await sendChildApprovalNotifications({
      child,
      action: 'disapproved',
      adminId: req.user._id,
      adminReason: note || '',
      req,
    });

    res.status(200).json({ success: true, data: child });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getChildren, getChild, createChild, updateChild, deleteChild, assignClassroom,
  assignChildrenToClassroom, approveChild, disapproveChild, updateChildAvatar
};
