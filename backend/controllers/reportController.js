const DailyReport = require('../models/DailyReport');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');

// @desc    Get daily reports
// @route   GET /api/reports
// @access  Private
const getReports = async (req, res) => {
  try {
    let query = {};
    const { date, childId, classroomId } = req.query;

    if (date) {
      const d = new Date(date);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      query.date = { $gte: startOfDay, $lt: endOfDay };
    }

    if (childId) query.child = childId;
    if (classroomId) query.classroom = classroomId;

    // Parents can only see their own children's reports
    if (req.user.role === 'parent') {
      const children = await Child.find({ parents: req.user._id }).select('_id').lean();
      query.child = { $in: children.map(c => c._id) };
    }

    // Teachers can only see their classroom reports
    if (req.user.role === 'teacher') {
      const classroom = await Classroom.findOne({ teacher: req.user._id }).select('_id').lean();
      if (classroom) query.classroom = classroom._id;
    }

    const reports = await DailyReport.find(query)
      .populate('child', 'firstName lastName')
      .populate('classroom', 'name')
      .populate('createdBy', 'fullName')
      .sort({ date: -1 })
      .limit(parseInt(req.query.limit) || 50)
      .lean()
      .maxTimeMS(8000);

    res.status(200).json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single daily report
// @route   GET /api/reports/:id
// @access  Private
const getReport = async (req, res) => {
  try {
    const report = await DailyReport.findById(req.params.id)
      .populate('child', 'firstName lastName allergies')
      .populate('classroom', 'name')
      .populate('createdBy', 'fullName');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create daily report
// @route   POST /api/reports
// @access  Private (teacher, admin)
const createReport = async (req, res) => {
  try {
    const report = await DailyReport.create({ ...req.body, createdBy: req.user._id });

    const populated = await DailyReport.findById(report._id)
      .populate('child', 'firstName lastName')
      .populate('classroom', 'name')
      .populate('createdBy', 'fullName');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A report for this child already exists for today' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update daily report
// @route   PUT /api/reports/:id
// @access  Private (teacher, admin)
const updateReport = async (req, res) => {
  try {
    const report = await DailyReport.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('child', 'firstName lastName')
      .populate('classroom', 'name')
      .populate('createdBy', 'fullName');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Parent acknowledges report
// @route   PUT /api/reports/:id/acknowledge
// @access  Private (parent)
const acknowledgeReport = async (req, res) => {
  try {
    const report = await DailyReport.findByIdAndUpdate(
      req.params.id,
      { parentAcknowledged: true },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getReports, getReport, createReport, updateReport, acknowledgeReport };
