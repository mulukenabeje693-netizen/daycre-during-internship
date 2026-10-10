// ── Phone validation helpers (mirrors authController) ────────────────────────
const ETHIO_TELECOM_RE = /^(?:\+251|0)9\d{8}$/;
const SAFARICOM_ET_RE = /^(?:\+251|0)7\d{8}$/;

function normalizePhone(value) {
  if (!value) return null;
  const v = String(value).trim().replace(/\s+/g, '');
  if (!v) return null;
  if (v.startsWith('+251')) return v;
  if (v.startsWith('251')) return `+${v}`;
  if (v.startsWith('0')) return `+251${v.slice(1)}`;
  return v;
}

function validateEthPhone(value) {
  if (!value || !String(value).trim()) return null;
  const cleaned = String(value).trim().replace(/\s+/g, '');
  if (ETHIO_TELECOM_RE.test(cleaned) || SAFARICOM_ET_RE.test(cleaned)) return null;
  return 'Invalid phone number. Must be a valid Ethio Telecom (09…) or Safaricom (07…) 10-digit number.';
}

const User = require('../models/User');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const Message = require('../models/Message');

// @desc    Get all staff members
// @route   GET /api/staff
// @access  Private (admin)
const getStaff = async (req, res) => {
  try {
    const { role } = req.query;
    let query = { role: { $in: ['teacher', 'reception', 'staff', 'admin'] } };
    if (role) query.role = role;

    const staff = await User.find(query)
      .select('-password')
      .sort({ fullName: 1 })
      .lean();

    // Batch-fetch classrooms for ALL teachers in a single query (fixes N+1)
    const teacherIds = staff.filter(s => s.role === 'teacher').map(s => s._id);
    const classrooms = teacherIds.length > 0
      ? await Classroom.find({ teacher: { $in: teacherIds } })
          .select('name ageGroup capacity teacher')
          .lean()
      : [];

    // Build a map of teacherId → classroom for O(1) lookup
    const classroomByTeacher = new Map(
      classrooms.map(c => [c.teacher.toString(), c])
    );

    const staffWithClassroom = staff.map(s => ({
      ...s,
      phone:            s.phone            || null,
      emergencyContact: s.emergencyContact  || { name: '', phone: '', relationship: '' },
      organization:     s.organization      || null,
      classroom:        s.role === 'teacher'
                          ? (classroomByTeacher.get(s._id.toString()) || null)
                          : null,
    }));

    res.status(200).json({ success: true, count: staffWithClassroom.length, data: staffWithClassroom });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get staff contacts for messaging
// @route   GET /api/staff/contacts
// @access  Private
const getStaffContacts = async (req, res) => {
  try {
    if (req.user.role === 'parent') {
      const children = await Child.find({ parents: req.user._id })
        .select('classroom')
        .populate({
          path: 'classroom',
          select: 'teacher',
          populate: { path: 'teacher', select: 'fullName email phone role avatar' }
        })
        .lean()
        .maxTimeMS(5000);

      const teacherContacts = children
        .map(child => child.classroom?.teacher)
        .filter(Boolean)
        .reduce((acc, teacher) => {
          if (!acc.some(t => t._id.toString() === teacher._id.toString())) {
            acc.push(teacher);
          }
          return acc;
        }, []);

      const receptionAdmins = await User.find({ role: { $in: ['admin', 'reception'] } })
        .select('fullName email phone role avatar')
        .sort({ fullName: 1 })
        .lean()
        .maxTimeMS(5000);

      const combined = [...teacherContacts, ...receptionAdmins];
      const uniqueContacts = combined.filter((contact, index, array) =>
        array.findIndex(item => item._id.toString() === contact._id.toString()) === index
      );

      return res.status(200).json({ success: true, count: uniqueContacts.length, data: uniqueContacts });
    }

    // For admin and reception, include all registered users (including parents) so announcements and messages reach all parents
    const query = ['admin', 'reception'].includes(req.user.role)
      ? { _id: { $ne: req.user._id } }
      : { role: { $in: ['teacher', 'reception', 'staff', 'admin'] }, _id: { $ne: req.user._id } };

    const contacts = await User.find(query)
      .select('fullName email phone role avatar')
      .sort({ fullName: 1 })
      .lean()
      .maxTimeMS(5000);

    return res.status(200).json({ success: true, count: contacts.length, data: contacts });
  } catch (error) {
    console.error('getStaffContacts error:', error);
    return res.status(500).json({ success: false, message: error.message, data: [] });
  }
};

// @desc    Get single staff member
// @route   GET /api/staff/:id
// @access  Private (admin)
const getStaffMember = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    // If teacher, include classroom info
    let classroom = null;
    if (user.role === 'teacher') {
      classroom = await Classroom.findOne({ teacher: user._id }).select('name ageGroup capacity');
    }

    res.status(200).json({ success: true, data: { ...user.toJSON(), classroom } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update staff member
// @route   PUT /api/staff/:id
// @access  Private (admin)
const updateStaff = async (req, res) => {
  try {
    const { fullName, email, phone, role } = req.body;

    // Validate phone if provided
    const phoneErr = validateEthPhone(phone);
    if (phoneErr) {
      return res.status(400).json({ success: false, message: `Phone: ${phoneErr}` });
    }

    // Parse + validate emergency contact if present
    let emergencyContact;
    if (req.body.emergencyContact) {
      emergencyContact = typeof req.body.emergencyContact === 'string'
        ? (() => { try { return JSON.parse(req.body.emergencyContact); } catch (_) { return {}; } })()
        : req.body.emergencyContact;

      const emergencyPhoneErr = validateEthPhone(emergencyContact.phone);
      if (emergencyPhoneErr) {
        return res.status(400).json({ success: false, message: `Emergency contact phone: ${emergencyPhoneErr}` });
      }

      // Same-field duplicate check (primary vs emergency)
      const normalizedPrimary = normalizePhone(phone);
      const normalizedEmergency = normalizePhone(emergencyContact.phone);
      if (normalizedPrimary && normalizedEmergency && normalizedPrimary === normalizedEmergency) {
        return res.status(400).json({
          success: false,
          message: 'Emergency contact phone must be different from the primary phone number.'
        });
      }
    }

    // ── System-wide duplicate phone check (excluding the staff member being updated) ──────
    // Helper to build a multi-format regex for a normalized phone string
    const buildPhoneRegex = (normalized) => {
      const local = normalized.replace(/^\+251/, '0');
      const intl = normalized.replace(/^\+/, '');
      return new RegExp(`^(\\+?${intl}|${local})$`);
    };

    const normalizedPrimary = normalizePhone(phone);
    if (normalizedPrimary) {
      const conflict = await User.findOne({
        _id: { $ne: req.params.id },   // exclude the user being edited
        $or: [
          { phone: { $regex: buildPhoneRegex(normalizedPrimary) } },
          { 'emergencyContact.phone': { $regex: buildPhoneRegex(normalizedPrimary) } },
        ],
      }).select('_id').lean();
      if (conflict) {
        return res.status(400).json({
          success: false,
          message: 'This phone number is already associated with an existing account.',
        });
      }
    }

    if (emergencyContact) {
      const normalizedEmergency = normalizePhone(emergencyContact.phone);
      if (normalizedEmergency) {
        const emergConflict = await User.findOne({
          _id: { $ne: req.params.id },  // exclude the user being edited
          $or: [
            { phone: { $regex: buildPhoneRegex(normalizedEmergency) } },
            { 'emergencyContact.phone': { $regex: buildPhoneRegex(normalizedEmergency) } },
          ],
        }).select('_id').lean();
        if (emergConflict) {
          return res.status(400).json({
            success: false,
            message: 'The emergency contact phone number is already associated with an existing account.',
          });
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────────────

    const updatePayload = { fullName, email, phone, role };
    if (emergencyContact !== undefined) updatePayload.emergencyContact = emergencyContact;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete staff member
// @route   DELETE /api/staff/:id
// @access  Private (admin)
const deleteStaff = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    if (user.role === 'teacher') {
      await Classroom.updateMany({ teacher: user._id }, { teacher: null });
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Staff member removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all parents with their children
// @route   GET /api/staff/parents
// @access  Private (admin, reception)
const getParents = async (req, res) => {
  try {
    const parents = await User.find({ role: 'parent' })
      .select('-password')
      .sort({ fullName: 1 })
      .lean();

    // Batch-fetch ALL children for ALL parents in a single query (fixes N+1)
    const parentIds = parents.map(p => p._id);
    const allChildren = parentIds.length > 0
      ? await Child.find({ parents: { $in: parentIds } })
          .select('firstName lastName dateOfBirth classroom status emergencyContact allergies parents')
          .populate('classroom', 'name ageGroup')
          .lean()
      : [];

    // Group children by parent ID for O(1) lookup
    const childrenByParent = new Map();
    allChildren.forEach(child => {
      (child.parents || []).forEach(pid => {
        const key = pid.toString();
        if (!childrenByParent.has(key)) childrenByParent.set(key, []);
        childrenByParent.get(key).push(child);
      });
    });

    const parentsWithChildren = parents.map(parent => ({
      ...parent,
      phone:            parent.phone            || null,
      organization:     parent.organization      || null,
      emergencyContact: parent.emergencyContact  || { name: '', phone: '', relationship: '' },
      children: (childrenByParent.get(parent._id.toString()) || []).map(c => ({
        ...c,
        classroom: c.classroom || null,
        emergencyContact: c.emergencyContact || { name: '', phone: '', relationship: '' },
      })),
    }));

    res.status(200).json({ success: true, count: parentsWithChildren.length, data: parentsWithChildren });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Assign child to parent
// @route   PUT /api/staff/parents/:parentId/assign-child
// @access  Private (admin, reception)
const assignChildToParent = async (req, res) => {
  try {
    const { childId } = req.body;
    const child = await Child.findByIdAndUpdate(
      childId,
      { $addToSet: { parents: req.params.parentId } },
      { new: true }
    ).populate('parents', 'fullName email');

    if (!child) {
      return res.status(404).json({ success: false, message: 'Child not found' });
    }

    res.status(200).json({ success: true, data: child });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin stats overview
// @route   GET /api/staff/admin-stats
// @access  Private (admin)
const getAdminStats = async (req, res) => {
  try {
    const [
      totalChildren,
      totalParents,
      totalTeachers,
      totalStaff,
      totalClassrooms,
      activeChildren
    ] = await Promise.all([
      Child.countDocuments(),
      User.countDocuments({ role: 'parent' }),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: { $in: ['staff', 'reception'] } }),
      Classroom.countDocuments({ status: 'active' }),
      Child.countDocuments({ status: 'active' })
    ]);

    res.status(200).json({
      success: true,
      data: { totalChildren, totalParents, totalTeachers, totalStaff, totalClassrooms, activeChildren }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve a parent
// @route   PUT /api/staff/parents/:parentId/approve
// @access  Private (admin)
const approveParent = async (req, res) => {
  try {
    const { note } = req.body;
    const parent = await User.findByIdAndUpdate(
      req.params.parentId,
      { approvalStatus: 'approved', approvalNote: note || '' },
      { new: true, runValidators: true }
    ).select('-password');

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    // Notify parent + all reception users
    try {
      const receptionUsers = await User.find({ role: 'reception' }).select('_id');
      const recipients = new Set([
        parent._id.toString(),
        ...receptionUsers.map(u => u._id.toString()),
      ]);
      recipients.delete(req.user._id.toString()); // exclude the admin

      const broadcastId = `parent_approval_${parent._id}_${Date.now()}`;
      const messages = Array.from(recipients).map(recipientId => ({
        sender:      req.user._id,
        recipient:   recipientId,
        subject:     'Parent Verification Approved',
        body:        `Parent account for ${parent.fullName} has been APPROVED by Admin.${note ? ` Note: ${note}` : ''}`,
        priority:    'normal',
        broadcastId,
        broadcastGroup: null,
      }));

      if (messages.length > 0) {
        const inserted = await Message.insertMany(messages);
        const io = req?.app?.get?.('io');
        const connectedUsers = req?.app?.get?.('connectedUsers');
        if (io && connectedUsers) {
          inserted.forEach(msg => {
            const socketId = connectedUsers.get(msg.recipient.toString());
            if (socketId) io.to(socketId).emit('newMessage', msg);
          });
        }
      }
    } catch (notifErr) {
      console.error('approveParent notification error:', notifErr.message);
    }

    res.status(200).json({ success: true, data: parent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Disapprove a parent
// @route   PUT /api/staff/parents/:parentId/disapprove
// @access  Private (admin)
const disapproveParent = async (req, res) => {
  try {
    const { note } = req.body;
    const parent = await User.findByIdAndUpdate(
      req.params.parentId,
      { approvalStatus: 'disapproved', approvalNote: note || '' },
      { new: true, runValidators: true }
    ).select('-password');

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    // Notify parent + all reception users
    try {
      const receptionUsers = await User.find({ role: 'reception' }).select('_id');
      const recipients = new Set([
        parent._id.toString(),
        ...receptionUsers.map(u => u._id.toString()),
      ]);
      recipients.delete(req.user._id.toString()); // exclude the admin

      const broadcastId = `parent_approval_${parent._id}_${Date.now()}`;
      const messages = Array.from(recipients).map(recipientId => ({
        sender:      req.user._id,
        recipient:   recipientId,
        subject:     'Parent Verification Disapproved',
        body:        `Parent account for ${parent.fullName} was DISAPPROVED by Admin. Reason: ${note || 'No reason provided.'}`,
        priority:    'urgent',
        broadcastId,
        broadcastGroup: null,
      }));

      if (messages.length > 0) {
        const inserted = await Message.insertMany(messages);
        const io = req?.app?.get?.('io');
        const connectedUsers = req?.app?.get?.('connectedUsers');
        if (io && connectedUsers) {
          inserted.forEach(msg => {
            const socketId = connectedUsers.get(msg.recipient.toString());
            if (socketId) io.to(socketId).emit('newMessage', msg);
          });
        }
      }
    } catch (notifErr) {
      console.error('disapproveParent notification error:', notifErr.message);
    }

    res.status(200).json({ success: true, data: parent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Block or unblock a parent
// @route   PUT /api/staff/parents/:parentId/block
// @access  Private (admin)
const toggleBlockParent = async (req, res) => {
  try {
    const parent = await User.findById(req.params.parentId).select('-password');
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }
    parent.isBlocked = !parent.isBlocked;
    await parent.save();
    res.status(200).json({ success: true, data: parent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getStaff, getStaffMember, updateStaff, deleteStaff, getParents, assignChildToParent, getAdminStats, approveParent, disapproveParent, getStaffContacts, toggleBlockParent };
