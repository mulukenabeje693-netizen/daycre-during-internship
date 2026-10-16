const DailyReport = require('../models/DailyReport');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const mongoose = require('mongoose');

const getParentChildIds = async (parentId) => {
  const children = await Child.find({ parents: parentId }).select('_id').lean();
  return children.map(child => child._id);
};

const getTeacherClassroomIds = async (teacherId) => {
  const classrooms = await Classroom.find({ teacher: teacherId }).select('_id').lean();
  return classrooms.map(classroom => classroom._id);
};

const isValidId = value => mongoose.Types.ObjectId.isValid(String(value || ''));

const populateReport = query => query
  .populate('child', 'firstName lastName allergies')
  .populate('classroom', 'name')
  .populate('createdBy', 'fullName');

const sendReportError = (res, error, action) => {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error(`Failed to ${action} daily report:`, error.message);
  return res.status(500).json({ success: false, message: `Could not ${action} daily report.` });
};

// @desc    Get daily reports
// @route   GET /api/reports
// @access  Private
const getReports = async (req, res) => {
  try {
    let query = {};
    const { date, childId, classroomId } = req.query;

    if (date) {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'A valid report date is required.' });
      }
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      query.date = { $gte: startOfDay, $lt: endOfDay };
    }

    if (childId && !isValidId(childId)) {
      return res.status(400).json({ success: false, message: 'A valid child ID is required.' });
    }
    if (classroomId && !isValidId(classroomId)) {
      return res.status(400).json({ success: false, message: 'A valid classroom ID is required.' });
    }
    if (childId) query.child = childId;
    if (classroomId) query.classroom = classroomId;

    // Parents can only see their own children's reports
    if (req.user.role === 'parent') {
      const childIds = await getParentChildIds(req.user._id);
      query.child = childId && childIds.some(id => String(id) === childId)
        ? childId
        : childId
          ? { $in: [] }
          : { $in: childIds };
    }

    // Teachers can only see their classroom reports
    if (req.user.role === 'teacher') {
      const classroomIds = await getTeacherClassroomIds(req.user._id);
      query.classroom = classroomId && classroomIds.some(id => String(id) === classroomId)
        ? classroomId
        : classroomId
          ? { $in: [] }
          : { $in: classroomIds };
    }

    const reports = await DailyReport.find(query)
      .populate('child', 'firstName lastName')
      .populate('classroom', 'name')
      .populate('createdBy', 'fullName')
      .sort({ date: -1 })
      .limit(Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100))
      .lean()
      .maxTimeMS(8000);

    res.status(200).json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    return sendReportError(res, error, 'load');
  }
};

// @desc    Get single daily report
// @route   GET /api/reports/:id
// @access  Private
const getReport = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'A valid report ID is required.' });
    }
    const query = { _id: req.params.id };
    if (req.user.role === 'parent') {
      query.child = { $in: await getParentChildIds(req.user._id) };
    } else if (req.user.role === 'teacher') {
      query.classroom = { $in: await getTeacherClassroomIds(req.user._id) };
    }
    const report = await populateReport(DailyReport.findOne(query));

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    return sendReportError(res, error, 'load');
  }
};

// @desc    Create daily report
// @route   POST /api/reports
// @access  Private (teacher, admin)
const createReport = async (req, res) => {
  try {
    const childId = req.body.child;
    if (!isValidId(childId)) {
      return res.status(400).json({ success: false, message: 'Select a valid child for this report.' });
    }

    const child = await Child.findById(childId).select('classroom').lean();
    if (!child) {
      return res.status(404).json({ success: false, message: 'The selected child was not found.' });
    }
    const classroomId = child.classroom?._id || child.classroom;
    if (!isValidId(classroomId)) {
      return res.status(409).json({ success: false, message: 'Assign the child to a classroom before recording a report.' });
    }
    if (req.body.classroom && String(req.body.classroom) !== String(classroomId)) {
      return res.status(400).json({ success: false, message: 'The selected classroom does not match the child’s assigned classroom.' });
    }

    if (req.user.role === 'teacher') {
      const assignedClassroom = await Classroom.exists({ _id: classroomId, teacher: req.user._id });
      if (!assignedClassroom) {
        return res.status(403).json({ success: false, message: 'You may only record reports for children in your assigned classroom.' });
      }
    }

    const reportFields = {
      child: child._id,
      classroom: classroomId,
      createdBy: req.user._id
    };
    ['date', 'meals', 'naps', 'activities', 'mood', 'health', 'teacherNotes'].forEach(field => {
      if (req.body[field] !== undefined) reportFields[field] = req.body[field];
    });
    const report = await DailyReport.create(reportFields);

    const populated = await populateReport(DailyReport.findById(report._id))

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A report for this child already exists for today' });
    }
    return sendReportError(res, error, 'save');
  }
};

// @desc    Update daily report
// @route   PUT /api/reports/:id
// @access  Private (teacher, admin)
const updateReport = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'A valid report ID is required.' });
    }
    const query = { _id: req.params.id };
    if (req.user.role === 'teacher') {
      query.classroom = { $in: await getTeacherClassroomIds(req.user._id) };
    }
    const updates = {};
    ['date', 'meals', 'naps', 'activities', 'mood', 'health', 'teacherNotes'].forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const report = await DailyReport.findOneAndUpdate(query, updates, {
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
    return sendReportError(res, error, 'update');
  }
};

// @desc    Parent acknowledges report
// @route   PUT /api/reports/:id/acknowledge
// @access  Private (parent)
const acknowledgeReport = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'A valid report ID is required.' });
    }
    const childIds = await getParentChildIds(req.user._id);
    const report = await DailyReport.findOneAndUpdate(
      { _id: req.params.id, child: { $in: childIds } },
      { $set: { parentAcknowledged: true } },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    return sendReportError(res, error, 'acknowledge');
  }
};

module.exports = { getReports, getReport, createReport, updateReport, acknowledgeReport };
