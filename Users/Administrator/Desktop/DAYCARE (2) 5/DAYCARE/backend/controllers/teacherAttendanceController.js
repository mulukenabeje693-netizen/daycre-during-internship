const TeacherAttendance = require('../models/TeacherAttendance');
const User = require('../models/User');

// @route   POST /api/teacher-attendance
// @desc    Mark or update teacher attendance (Reception use)
// @access  Private (reception, admin)
exports.markAttendance = async (req, res) => {
  try {
    const { teacherId, status, checkIn, checkOut, note } = req.body;

    if (!teacherId || !status) {
      return res.status(400).json({ message: 'Teacher ID and status are required' });
    }

    // Verify teacher exists
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use exact date for upsert filter — range queries on upsert cause
    // MongoDB to store the query object as the field value on insert
    const attendance = await TeacherAttendance.findOneAndUpdate(
      { teacher: teacherId, date: today },
      {
        $set: {
          status,
          checkIn:  checkIn  || '-',
          checkOut: checkOut || '-',
          markedBy: req.user.id,
          note:     note || '',
        },
        $setOnInsert: { date: today, teacher: teacherId }
      },
      { new: true, upsert: true, runValidators: true }
    ).populate('teacher', 'fullName role email');

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ message: 'Server error while marking attendance', error: error.message });
  }
};

// @route   POST /api/teacher-attendance/bulk
// @desc    Mark attendance for multiple teachers at once
// @access  Private (reception, admin)
exports.markBulkAttendance = async (req, res) => {
  try {
    const { records } = req.body; // [{teacherId, status, checkIn, checkOut}]
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'records array is required' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ops = records.map(r => ({
      updateOne: {
        filter: { teacher: r.teacherId, date: today },
        update: {
          $set: {
            status: r.status || 'absent',
            checkIn: r.checkIn || '-',
            checkOut: r.checkOut || '-',
            markedBy: req.user.id,
            note: r.note || ''
          }
        },
        upsert: true
      }
    }));

    await TeacherAttendance.bulkWrite(ops);

    res.status(200).json({ success: true, message: `${records.length} attendance records saved.` });
  } catch (error) {
    console.error('Bulk attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/teacher-attendance
// @desc    Get today's teacher attendance (Admin use)
// @access  Private (admin, reception)
exports.getTodayAttendance = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch all teachers from User model — .lean() skips Mongoose hydration overhead
    const teachers = await User.find({ role: 'teacher' }, 'fullName email role createdAt').lean();

    // Fetch today's attendance records in parallel with teacher lookup above
    const records = await TeacherAttendance.find({
      date: { $gte: today, $lt: tomorrow }
    })
      .populate('teacher', 'fullName email role createdAt')
      .lean();

    // Build a map for quick lookup
    const recordMap = {};
    records.forEach(r => {
      if (r.teacher) recordMap[r.teacher._id.toString()] = r;
    });

    // Merge: every teacher gets a record (absent if not marked yet)
    const merged = teachers.map(t => {
      const rec = recordMap[t._id.toString()];
      return {
        id: t._id,
        fullName: t.fullName,
        role: t.role,
        classroom: rec?.classroom || 'Unassigned',
        status: rec?.status || 'absent',
        checkIn: rec?.checkIn || '-',
        checkOut: rec?.checkOut || '-',
        markedAt: rec?.updatedAt || null,
        createdAt: t.createdAt || null
      };
    });

    res.status(200).json({ success: true, data: merged });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/teacher-attendance/date/:date
// @desc    Get teacher attendance for a specific date (YYYY-MM-DD)
// @access  Private (admin)
exports.getAttendanceByDate = async (req, res) => {
  try {
    const date = new Date(req.params.date);
    date.setHours(0, 0, 0, 0);

    const records = await TeacherAttendance.find({ date })
      .populate('teacher', 'fullName email role')
      .lean();

    const data = records.map(r => ({
      id: r.teacher?._id,
      fullName: r.teacher?.fullName || 'Unknown',
      role: r.teacher?.role || 'teacher',
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      markedAt: r.updatedAt
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
