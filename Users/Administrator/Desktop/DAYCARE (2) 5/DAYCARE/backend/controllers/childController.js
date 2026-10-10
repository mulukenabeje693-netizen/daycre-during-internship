const Child = require('../models/Child');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Message = require('../models/Message');
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

// @desc    Get all children (admin/teacher) or parent's children
// @route   GET /api/children
// @access  Private
const getChildren = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'parent') {
      query.parents = req.user._id;
    } else if (req.user.role === 'teacher') {
      // Use lean + select only _id to minimise data transfer for this lookup
      const classroom = await Classroom.findOne({ teacher: req.user._id })
        .select('_id')
        .lean();
      // If teacher has no classroom assigned yet, return empty list immediately
      if (!classroom) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      query.classroom = classroom._id;
      query.status = 'approved';
    }

    const children = await Child.find(query)
      .populate('classroom', 'name ageGroup')
      .populate('parents', 'fullName email phone organization emergencyContact')
      .sort({ lastName: 1, firstName: 1 })
      .lean()
      .maxTimeMS(8000);

    // Normalise all nullable fields so frontend never sees null/undefined
    const normalised = children.map(c => ({
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

    res.status(200).json({ success: true, count: normalised.length, data: normalised });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single child
// @route   GET /api/children/:id
// @access  Private
const getChild = async (req, res) => {
  try {
    const child = await Child.findById(req.params.id)
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
    const child = await Child.findByIdAndUpdate(req.params.id, req.body, {
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
    const child = await Child.findById(req.params.id);
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

module.exports = { getChildren, getChild, createChild, updateChild, deleteChild, assignClassroom, approveChild, disapproveChild, updateChildAvatar };
