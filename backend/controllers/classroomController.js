const mongoose = require('mongoose');
const Classroom = require('../models/Classroom');
const Child = require('../models/Child');
const User = require('../models/User');

const validateTeacherAssignment = async teacherId => {
  if (teacherId === undefined) return { teacher: undefined };
  if (teacherId === null || teacherId === '') return { teacher: null };
  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    return { status: 400, message: 'Select a valid nanny account.' };
  }

  const teacher = await User.findOne({
    _id: teacherId,
    role: 'teacher',
    isBlocked: { $ne: true }
  }).select('_id').lean();

  if (!teacher) {
    return { status: 404, message: 'The selected nanny account does not exist or is unavailable.' };
  }

  return { teacher: teacher._id };
};

// @desc    Get all classrooms
// @route   GET /api/classrooms
// @access  Private
const getClassrooms = async (req, res) => {
  try {
    let query = {};
    if (req.query.status === 'active' || req.query.status === 'inactive') {
      query.status = req.query.status;
    }
    // If the logged-in user is a nanny (teacher), only return their assigned classrooms
    if (req.user.role === 'teacher') {
      query.teacher = req.user._id;
    }

    const classrooms = await Classroom.find(query)
      .populate('teacher', 'fullName email')
      .populate('enrolledCount');

    res.status(200).json({ success: true, count: classrooms.length, data: classrooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single classroom with enrolled children
// @route   GET /api/classrooms/:id
// @access  Private
const getClassroom = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid classroom ID.' });
    }
    const classroom = await Classroom.findById(req.params.id)
      .populate('teacher', 'fullName email phone');

    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }
    if (
      req.user.role === 'teacher' &&
      String(classroom.teacher?._id || classroom.teacher || '') !== String(req.user._id)
    ) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this classroom.' });
    }

    // Get enrolled children
    const children = await Child.find({ classroom: classroom._id })
      .select('firstName lastName dateOfBirth gender allergies status')
      .populate('parents', 'fullName phone');

    res.status(200).json({ success: true, data: { ...classroom.toJSON(), children } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create classroom
// @route   POST /api/classrooms
// @access  Private (admin)
const createClassroom = async (req, res) => {
  try {
    const assignment = await validateTeacherAssignment(req.body.teacher);
    if (assignment.status) {
      return res.status(assignment.status).json({ success: false, message: assignment.message });
    }

    const classroom = await Classroom.create({
      ...req.body,
      ...(assignment.teacher !== undefined ? { teacher: assignment.teacher } : {})
    });
    const populated = await Classroom.findById(classroom._id).populate('teacher', 'fullName email');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A classroom with this name already exists' });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update classroom
// @route   PUT /api/classrooms/:id
// @access  Private (admin)
const updateClassroom = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid classroom ID.' });
    }

    const assignment = await validateTeacherAssignment(req.body.teacher);
    if (assignment.status) {
      return res.status(assignment.status).json({ success: false, message: assignment.message });
    }

    if (assignment.teacher !== undefined) {
      const currentClassroom = await Classroom.findById(req.params.id).select('_id teacher').lean();
      if (!currentClassroom) {
        return res.status(404).json({ success: false, message: 'Classroom not found' });
      }
      const currentTeacherId = currentClassroom.teacher ? String(currentClassroom.teacher) : '';
      const nextTeacherId = assignment.teacher ? String(assignment.teacher) : '';
      if (
        currentTeacherId &&
        currentTeacherId !== nextTeacherId &&
        req.body.confirmReassignment !== true
      ) {
        return res.status(409).json({
          success: false,
          message: 'This classroom already has a nanny. Confirm the reassignment before changing it.'
        });
      }
    }

    const updates = { ...req.body };
    delete updates.confirmReassignment;
    if (assignment.teacher !== undefined) updates.teacher = assignment.teacher;

    const classroom = await Classroom.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    }).populate('teacher', 'fullName email');

    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    res.status(200).json({ success: true, data: classroom });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete classroom
// @route   DELETE /api/classrooms/:id
// @access  Private (admin)
const deleteClassroom = async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    // Unassign children from this classroom
    await Child.updateMany({ classroom: req.params.id }, { classroom: null });
    await Classroom.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Classroom deleted and children unassigned' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get teacher's classroom
// @route   GET /api/classrooms/my-classroom
// @access  Private (teacher)
const getMyClassroom = async (req, res) => {
  try {
    const classrooms = await Classroom.find({ teacher: req.user._id })
      .populate('teacher', 'fullName email')
      .lean();

    if (!classrooms || classrooms.length === 0) {
      return res.status(200).json({ success: true, data: [], message: 'No classroom assigned' });
    }

    // Fetch all children for all classrooms in a single query (no N+1)
    const classroomIds = classrooms.map(c => c._id);
    const allChildren = await Child.find({
      classroom: { $in: classroomIds },
      status: { $in: ['active', 'approved'] }
    })
      .select('firstName lastName dateOfBirth gender allergies photoUrl status classroom')
      .populate('parents', 'fullName phone')
      .lean();

    // Group children by classroomId
    const childrenByClassroom = new Map();
    allChildren.forEach(child => {
      const key = child.classroom?.toString();
      if (!childrenByClassroom.has(key)) childrenByClassroom.set(key, []);
      childrenByClassroom.get(key).push(child);
    });

    const classroomsWithChildren = classrooms.map(classroom => ({
      ...classroom,
      children: childrenByClassroom.get(classroom._id.toString()) || [],
    }));

    res.status(200).json({ success: true, data: classroomsWithChildren });
  } catch (error) {
    console.error('Teacher classroom roster retrieval failed:', {
      role: req.user?.role || 'unknown',
      errorName: error.name || 'Error'
    });
    res.status(500).json({
      success: false,
      code: 'TEACHER_CLASSROOM_UNAVAILABLE',
      message: 'Could not load the assigned classroom roster. Please retry.'
    });
  }
};

module.exports = { getClassrooms, getClassroom, createClassroom, updateClassroom, deleteClassroom, getMyClassroom };
