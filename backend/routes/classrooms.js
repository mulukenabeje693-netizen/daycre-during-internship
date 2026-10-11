const express = require('express');
const router = express.Router();
const { getClassrooms, getClassroom, createClassroom, updateClassroom, deleteClassroom, getMyClassroom } = require('../controllers/classroomController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/my-classroom', authorize('teacher'), getMyClassroom);

router.route('/')
  .get(getClassrooms)
  .post(authorize('admin'), createClassroom);

router.route('/:id')
  .get(getClassroom)
  .put(authorize('admin'), updateClassroom)
  .delete(authorize('admin'), deleteClassroom);

module.exports = router;
