const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const Message = require('../models/Message');

const notifyParentsOfNap = async (req, child, body) => {
  const recipients = [...new Set((child.parents || []).map(parent => String(parent._id || parent)))];
  if (recipients.length === 0) return;

  const messages = await Message.insertMany(recipients.map(recipient => ({
    sender: req.user._id,
    recipient,
    subject: `Sleep update: ${child.firstName} ${child.lastName}`,
    body,
    relatedChild: child._id
  })));

  const populatedMessages = await Message.find({ _id: { $in: messages.map(message => message._id) } })
    .populate('sender', 'fullName role avatar')
    .populate('recipient', 'fullName role avatar')
    .populate('relatedChild', 'firstName lastName')
    .lean()
    .maxTimeMS(5000);

  const io = req.app.get('io');
  const connectedUsers = req.app.get('connectedUsers');
  if (!io || !connectedUsers) return;

  populatedMessages.forEach(message => {
    const socketId = connectedUsers.get(String(message.recipient._id));
    if (socketId) io.to(socketId).emit('newMessage', message);
  });
};

const formatNapTime = date => new Date(date).toLocaleTimeString('en-US', {
  hour: 'numeric',
  minute: '2-digit'
});

const getAttendanceDay = value => {
  if (value !== undefined && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))) return null;

  const date = value
    ? (() => {
        const [year, month, day] = value.split('-').map(Number);
        const parsed = new Date(year, month - 1, day);
        return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
          ? parsed
          : null;
      })()
    : new Date();
  if (!date) return null;

  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return {
    start,
    end: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  };
};

const saveChildAttendance = async (req, res, status) => {
  const { childId, classroomId, date, notes } = req.body;
  if (!mongoose.isValidObjectId(childId)) {
    return res.status(400).json({ success: false, message: 'A valid child ID is required.' });
  }

  const day = getAttendanceDay(date);
  if (!day) {
    return res.status(400).json({ success: false, message: 'Attendance date must be a valid YYYY-MM-DD date.' });
  }

  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 1000)) {
    return res.status(400).json({ success: false, message: 'Attendance notes must be text no longer than 1000 characters.' });
  }

  const child = await Child.findById(childId).select('_id classroom status').lean();
  if (!child) {
    return res.status(404).json({ success: false, message: 'Child not found.' });
  }
  if (!['active', 'approved'].includes(child.status)) {
    return res.status(409).json({ success: false, message: 'Attendance can only be recorded for active or approved children.' });
  }
  if (!child.classroom || (classroomId && !mongoose.isValidObjectId(classroomId))) {
    return res.status(400).json({ success: false, message: 'The child must have a valid classroom assignment.' });
  }
  if (classroomId && String(child.classroom) !== String(classroomId)) {
    return res.status(403).json({ success: false, message: 'The submitted classroom does not match the child assignment.' });
  }

  const classroom = await Classroom.findById(child.classroom).select('_id teacher status').lean();
  if (!classroom) {
    return res.status(409).json({ success: false, message: 'The child classroom assignment is no longer valid.' });
  }
  if (req.user.role === 'teacher' &&
      (classroom.status !== 'active' || String(classroom.teacher) !== String(req.user._id))) {
    return res.status(403).json({ success: false, message: 'You may only record attendance for children in your active assigned classrooms.' });
  }

  const update = {
    $set: {
      classroom: child.classroom,
      status,
      ...(notes === undefined ? {} : { notes: notes.trim() })
    },
    $setOnInsert: {
      child: child._id,
      date: day.start
    }
  };
  if (status === 'present') {
    update.$set.checkIn = { time: new Date(), recordedBy: req.user._id };
  }

  let record;
  try {
    record = await Attendance.findOneAndUpdate(
      { child: child._id, date: day.start },
      update,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    record = await Attendance.findOneAndUpdate(
      { child: child._id, date: day.start },
      update,
      { new: true, runValidators: true }
    );
    if (!record) throw error;
  }

  const populated = await Attendance.findById(record._id)
    .populate('child', 'firstName lastName photoUrl')
    .populate('classroom', 'name');
  return res.status(200).json({ success: true, data: populated });
};

// @desc    Get attendance records
// @route   GET /api/attendance
// @access  Private
const getAttendance = async (req, res) => {
  try {
    if (!['admin', 'reception', 'teacher', 'parent'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view attendance.' });
    }
    const { date, classroomId, childId } = req.query;

    let query = {};

    // Filter by date
    if (date) {
      const day = getAttendanceDay(date);
      if (!day) {
        return res.status(400).json({ success: false, message: 'Attendance date must be a valid YYYY-MM-DD date.' });
      }
      query.date = { $gte: day.start, $lt: day.end };
    }

    if (classroomId) query.classroom = classroomId;
    if (childId) query.child = childId;

    // Teachers see only their classroom
    if (req.user.role === 'teacher') {
      const classrooms = await Classroom.find({ teacher: req.user._id, status: 'active' })
        .select('_id')
        .lean()
        .maxTimeMS(5000);
      query.classroom = { $in: classrooms.map(classroom => classroom._id) };
    }

    // Parents see only their children
    if (req.user.role === 'parent') {
      const children = await Child.find({ parents: req.user._id }).select('_id');
      query.child = { $in: children.map(c => c._id) };
    }

    const records = await Attendance.find(query)
      .populate('child', 'firstName lastName')
      .populate('classroom', 'name')
      .populate('checkIn.recordedBy', 'fullName')
      .populate('checkOut.recordedBy', 'fullName')
      .sort({ date: -1 })
      .limit(100)
      .lean()
      .maxTimeMS(5000);

    return res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: [] });
  }
};

// @desc    Get today's attendance for a classroom or parent
// @route   GET /api/attendance/today
// @access  Private (teacher, admin, parent, reception)
const getTodayAttendance = async (req, res) => {
  try {
    if (!['admin', 'reception', 'teacher', 'parent'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view attendance.' });
    }
    const day = getAttendanceDay(req.query.date);
    if (!day) {
      return res.status(400).json({
        success: false,
        message: 'Attendance date must be a valid YYYY-MM-DD date.'
      });
    }
    const { start: startOfDay, end: endOfDay } = day;

    let classroomId = req.query.classroomId;
    let classroomIds;
    let assignmentStatus;

    if (req.user?.role === 'teacher') {
      const assignedClassrooms = await Classroom.find({ teacher: req.user._id })
        .select('_id status')
        .lean()
        .maxTimeMS(5000);
      classroomIds = assignedClassrooms
        .filter(classroom => classroom.status === 'active')
        .map(classroom => classroom._id);

      if (classroomIds.length === 0) {
        assignmentStatus = assignedClassrooms.length > 0 ? 'inactive_classroom' : 'unassigned';
        return res.status(200).json({
          success: true,
          data: {
            records: [],
            absentChildren: [],
            assignmentStatus,
            summary: { present: 0, absent: 0, late: 0, sick: 0, permission: 0 }
          }
        });
      }
      assignmentStatus = 'assigned';
    }

    const query = {
      date: { $gte: startOfDay, $lt: endOfDay }
    };

    if (req.user?.role === 'parent') {
      // For parent users: isolate attendance to only their children
      const parentChildren = await Child.find({ parents: req.user._id }).select('_id').lean().maxTimeMS(5000);
      const childIds = parentChildren.map(c => c._id);
      query.child = { $in: childIds };
    } else if (classroomIds) {
      query.classroom = { $in: classroomIds };
    } else if (classroomId) {
      query.classroom = classroomId;
    }

    const records = await Attendance.find(query)
      .select('child classroom date checkIn checkOut status notes napStart napEnd napQuality')
      .populate('child', 'firstName lastName dateOfBirth createdAt enrollmentDate')
      .populate('classroom', 'name')
      .lean()
      .maxTimeMS(5000);

    // Get children in scope to calculate absent ones
    let allChildren = [];
    if (req.user?.role === 'parent') {
      allChildren = await Child.find({ parents: req.user._id, status: 'active' })
        .select('firstName lastName dateOfBirth createdAt enrollmentDate classroom')
        .lean()
        .maxTimeMS(5000);
    } else if (classroomIds) {
      allChildren = await Child.find({ classroom: { $in: classroomIds }, status: { $in: ['active', 'approved'] } })
        .select('firstName lastName dateOfBirth createdAt enrollmentDate classroom')
        .lean()
        .maxTimeMS(5000);
    } else if (classroomId) {
      allChildren = await Child.find({ classroom: classroomId, status: { $in: ['active', 'approved'] } })
        .select('firstName lastName dateOfBirth createdAt enrollmentDate classroom')
        .lean()
        .maxTimeMS(5000);
    } else {
      allChildren = await Child.find({ status: 'active' })
        .select('firstName lastName dateOfBirth createdAt enrollmentDate classroom')
        .lean()
        .maxTimeMS(5000);
    }

    // Null-safe extraction of checked-in IDs
    const checkedInIds = new Set(
      records
        .filter(r => r && r.child && r.child._id)
        .map(r => r.child._id.toString())
    );

    const absentChildren = allChildren.filter(c => c && c._id && !checkedInIds.has(c._id.toString()));

    return res.status(200).json({
      success: true,
      data: {
        records,
        absentChildren,
        ...(req.user?.role === 'teacher' ? { assignmentStatus } : {}),
        summary: {
          present: records.filter(r => r.status === 'present').length,
          absent: records.filter(r => r.status === 'absent').length,
          late: records.filter(r => r.status === 'late').length,
          sick: records.filter(r => r.status === 'sick').length,
          permission: records.filter(r => ['permission', 'authorized-absence', 'excused'].includes(r.status)).length
        }
      }
    });
  } catch (error) {
    console.error('Attendance retrieval failed:', {
      role: req.user?.role || 'unknown',
      errorName: error.name || 'Error'
    });
    return res.status(500).json({
      success: false,
      message: 'Could not load attendance right now. Please retry.',
      data: {
        records: [],
        absentChildren: [],
        summary: { present: 0, absent: 0, late: 0, sick: 0, permission: 0 }
      }
    });
  }
};

// @desc    Check in a child
// @route   POST /api/attendance/checkin
// @access  Private (teacher, admin, reception)
const checkIn = async (req, res) => {
  try {
    return await saveChildAttendance(req, res, 'present');
  } catch (error) {
    console.error('Attendance save failed:', { role: req.user?.role || 'unknown', errorName: error.name || 'Error' });
    res.status(500).json({ success: false, message: 'Could not save attendance right now. Please retry.' });
  }
};

// @desc    Check out a child
// @route   PUT /api/attendance/checkout/:id
// @access  Private (teacher, admin, reception)
const checkOut = async (req, res) => {
  try {
    const record = await Attendance.findByIdAndUpdate(
      req.params.id,
      { checkOut: { time: new Date(), recordedBy: req.user._id } },
      { new: true }
    )
      .populate('child', 'firstName lastName')
      .populate('classroom', 'name');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark absence
// @route   POST /api/attendance/absence
// @access  Private
const markAbsence = async (req, res) => {
  try {
    const status = req.body.status || 'absent';
    if (!['absent', 'late', 'sick', 'permission', 'authorized-absence', 'excused'].includes(status)) {
      return res.status(400).json({ success: false, message: 'A valid attendance status is required.' });
    }
    return await saveChildAttendance(req, res, status);
  } catch (error) {
    console.error('Attendance save failed:', { role: req.user?.role || 'unknown', errorName: error.name || 'Error' });
    res.status(500).json({ success: false, message: 'Could not save attendance right now. Please retry.' });
  }
};

// @desc    Start a nap for a child
// @route   POST /api/attendance/nap
// @access  Private (teacher, admin)
const startNap = async (req, res) => {
  try {
    const { childId, notes } = req.body;
    const child = await Child.findById(childId).select('firstName lastName parents classroom');
    if (!child) {
      return res.status(404).json({ success: false, message: 'Child not found' });
    }

    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let record = await Attendance.findOne({ child: childId, date: dateOnly });

    if (!record) {
      record = await Attendance.create({
        child: childId,
        classroom: child.classroom,
        date: dateOnly,
        status: 'present',
        napStart: new Date(),
        notes: notes || ''
      });
    } else {
      record.napStart = new Date();
      if (notes) record.notes = notes;
      await record.save();
    }

    await notifyParentsOfNap(
      req,
      child,
      `${child.firstName} ${child.lastName} started a nap at ${formatNapTime(record.napStart)}.${notes ? ` Notes: ${notes}` : ''}`
    );

    const populated = await Attendance.findById(record._id)
      .populate('child', 'firstName lastName');

    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    End a nap for a child
// @route   PUT /api/attendance/nap/:id
// @access  Private (teacher, admin)
const endNap = async (req, res) => {
  try {
    const record = await Attendance.findByIdAndUpdate(
      req.params.id,
      { napEnd: new Date() },
      { new: true }
    ).populate('child', 'firstName lastName parents');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    await notifyParentsOfNap(
      req,
      record.child,
      `${record.child.firstName} ${record.child.lastName} finished a nap at ${formatNapTime(record.napEnd)}.`
    );

    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Log a completed nap for a child
// @route   POST /api/attendance/nap/log
// @access  Private (teacher, admin)
const logNap = async (req, res) => {
  try {
    const { childId, startTime, endTime, quality, notes } = req.body;

    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const child = await Child.findById(childId).select('firstName lastName parents classroom');
    if (!child) {
      return res.status(404).json({ success: false, message: 'Child not found' });
    }
    
    const [startH, startM] = startTime.split(':');
    const [endH, endM] = endTime.split(':');
    
    const startObj = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(startH), parseInt(startM));
    const endObj = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(endH), parseInt(endM));

    let record = await Attendance.findOne({ child: childId, date: dateOnly });

    if (!record) {
      record = await Attendance.create({
        child: childId,
        classroom: child.classroom,
        date: dateOnly,
        status: 'present',
        napStart: startObj,
        napEnd: endObj,
        napQuality: quality || 'good',
        notes: notes || ''
      });
    } else {
      if (!record.classroom) record.classroom = child.classroom;
      record.napStart = startObj;
      record.napEnd = endObj;
      record.napQuality = quality || 'good';
      if (notes) record.notes = notes;
      await record.save();
    }

    const napDetails = `${child.firstName} ${child.lastName}'s nap was recorded from ${formatNapTime(startObj)} to ${formatNapTime(endObj)}. Quality: ${quality || 'good'}.${notes ? ` Notes: ${notes}` : ''}`;
    await notifyParentsOfNap(req, child, napDetails);

    const populated = await Attendance.findById(record._id).populate('child', 'firstName lastName');
    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAttendance, getTodayAttendance, checkIn, checkOut, markAbsence, startNap, endNap, logNap };
