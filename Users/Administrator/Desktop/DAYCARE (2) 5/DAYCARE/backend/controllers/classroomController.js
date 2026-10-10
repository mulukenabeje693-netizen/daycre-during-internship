const Classroom = require('../models/Classroom');
const Child = require('../models/Child');

// @desc    Get all classrooms
// @route   GET /api/classrooms
// @access  Private
const getClassrooms = async (req, res) => {
  try {
    let query = {};
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
    const classroom = await Classroom.findById(req.params.id)
      .populate('teacher', 'fullName email phone');

    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
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
    const classroom = await Classroom.create(req.body);
    const populated = await Classroom.findById(classroom._id).populate('teacher', 'fullName email');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A classroom with this name already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update classroom
// @route   PUT /api/classrooms/:id
// @access  Private (admin)
const updateClassroom = async (req, res) => {
  try {
    const classroom = await Classroom.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('teacher', 'fullName email');

    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    res.status(200).json({ success: true, data: classroom });
  } catch (error) {
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
    const allChildren = await Child.find({ classroom: { $in: classroomIds }, status: 'approved' })
      .select('firstName lastName dateOfBirth gender allergies status classroom')
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
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getClassrooms, getClassroom, createClassroom, updateClassroom, deleteClassroom, getMyClassroom };
