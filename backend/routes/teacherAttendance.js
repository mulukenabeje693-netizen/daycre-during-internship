const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  markAttendance,
  markBulkAttendance,
  getTodayAttendance,
  getAttendanceByDate
} = require('../controllers/teacherAttendanceController');

// Mark single teacher attendance (reception, admin)
router.post('/', protect, authorize('reception', 'admin'), markAttendance);

// Mark bulk attendance (reception, admin)
router.post('/bulk', protect, authorize('reception', 'admin'), markBulkAttendance);

// Get today's full attendance list (admin, reception)
router.get('/', protect, authorize('admin', 'reception'), getTodayAttendance);

// Get attendance for a specific date (admin)
router.get('/date/:date', protect, authorize('admin'), getAttendanceByDate);

module.exports = router;
