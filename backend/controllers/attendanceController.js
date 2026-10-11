const Attendance = require('../models/Attendance');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');

// @desc    Get attendance records
// @route   GET /api/attendance
// @access  Private
const getAttendance = async (req, res) => {
  try {
    const { date, classroomId, childId } = req.query;

    let query = {};

    // Filter by date
    if (date) {
      const d = new Date(date);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      query.date = { $gte: startOfDay, $lt: endOfDay };
    }

    if (classroomId) query.classroom = classroomId;
    if (childId) query.child = childId;

    // Teachers see only their classroom
    if (req.user.role === 'teacher') {
      const classroom = await Classroom.findOne({ teacher: req.user._id });
      if (classroom) query.classroom = classroom._id;
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
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    let classroomId = req.query.classroomId;

    if (req.user?.role === 'teacher') {
      const classroom = await Classroom.findOne({ teacher: req.user._id }).select('_id').lean().maxTimeMS(5000);
      // If teacher has no classroom yet, return empty attendance immediately
      if (!classroom) {
        return res.status(200).json({
          success: true,
          data: { records: [], absentChildren: [], summary: { present: 0, absent: 0, late: 0, sick: 0, permission: 0 } }
        });
      }
      classroomId = classroom._id;
    }

    const query = {
      date: { $gte: startOfDay, $lt: endOfDay }
    };

    if (classroomId) {
      query.classroom = classroomId;
    } else if (req.user?.role === 'parent') {
      // For parent users: isolate attendance to only their children
      const parentChildren = await Child.find({ parent: req.user._id }).select('_id').lean().maxTimeMS(5000);
      const childIds = parentChildren.map(c => c._id);
      query.child = { $in: childIds };
    }

    const records = await Attendance.find(query)
      .select('child classroom date checkIn checkOut status notes napStart napEnd napQuality')
      .populate('child', 'firstName lastName dateOfBirth createdAt enrollmentDate')
      .populate('classroom', 'name')
      .lean()
      .maxTimeMS(5000);

    // Get children in scope to calculate absent ones
    let allChildren = [];
    if (classroomId) {
      allChildren = await Child.find({ classroom: classroomId, status: { $in: ['active', 'approved'] } })
        .select('firstName lastName dateOfBirth createdAt enrollmentDate classroom')
        .lean()
        .maxTimeMS(5000);
    } else if (req.user?.role === 'parent') {
      allChildren = await Child.find({ parent: req.user._id, status: 'active' })
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
        summary: {
          present: records.filter(r => r.status === 'present').length,
          absent: absentChildren.length + records.filter(r => r.status === 'absent').length,
          late: records.filter(r => r.status === 'late').length,
          sick: records.filter(r => r.status === 'sick').length,
          permission: records.filter(r => ['permission', 'authorized-absence', 'excused'].includes(r.status)).length
        }
      }
    });
  } catch (error) {
    console.error('getTodayAttendance error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch attendance',
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
    const { childId, classroomId, notes } = req.body;

    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Find or create attendance record
    let record = await Attendance.findOne({ child: childId, date: dateOnly });

    if (record) {
      // Update existing record
      record.checkIn = { time: new Date(), recordedBy: req.user._id };
      record.status = 'present';
      record.notes = notes || record.notes;
      await record.save();
    } else {
      record = await Attendance.create({
        child: childId,
        classroom: classroomId,
        date: dateOnly,
        checkIn: { time: new Date(), recordedBy: req.user._id },
        status: 'present',
        notes: notes || ''
      });
    }

    const populated = await Attendance.findById(record._id)
      .populate('child', 'firstName lastName')
      .populate('classroom', 'name');

    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    const { childId, classroomId, status, notes } = req.body;

    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const record = await Attendance.findOneAndUpdate(
      { child: childId, date: dateOnly },
      {
        child: childId,
        classroom: classroomId,
        date: dateOnly,
        status: status || 'absent',
        notes: notes || ''
      },
      { new: true, upsert: true }
    )
      .populate('child', 'firstName lastName')
      .populate('classroom', 'name');

    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Start a nap for a child
// @route   POST /api/attendance/nap
// @access  Private (teacher, admin)
const startNap = async (req, res) => {
  try {
    const { childId, notes } = req.body;

    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let record = await Attendance.findOne({ child: childId, date: dateOnly });

    if (!record) {
      const child = await Child.findById(childId);
      record = await Attendance.create({
        child: childId,
        classroom: child?.classroom,
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
    ).populate('child', 'firstName lastName');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

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

    const child = await Child.findById(childId);
    
    const [startH, startM] = startTime.split(':');
    const [endH, endM] = endTime.split(':');
    
    const startObj = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(startH), parseInt(startM));
    const endObj = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(endH), parseInt(endM));

    let record = await Attendance.findOne({ child: childId, date: dateOnly });

    if (!record) {
      record = await Attendance.create({
        child: childId,
        classroom: child?.classroom,
        date: dateOnly,
        status: 'present',
        napStart: startObj,
        napEnd: endObj,
        napQuality: quality || 'good',
        notes: notes || ''
      });
    } else {
      if (!record.classroom) record.classroom = child?.classroom;
      record.napStart = startObj;
      record.napEnd = endObj;
      record.napQuality = quality || 'good';
      if (notes) record.notes = notes;
      await record.save();
    }

    const populated = await Attendance.findById(record._id).populate('child', 'firstName lastName');
    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAttendance, getTodayAttendance, checkIn, checkOut, markAbsence, startNap, endNap, logNap };
