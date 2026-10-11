const express = require('express');
const router = express.Router();
const { getAttendance, getTodayAttendance, checkIn, checkOut, markAbsence, startNap, endNap, logNap } = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getAttendance);
router.get('/today', getTodayAttendance);
router.post('/checkin', authorize('admin', 'teacher', 'reception'), checkIn);
router.put('/checkout/:id', authorize('admin', 'teacher', 'reception'), checkOut);
router.post('/absence', authorize('admin', 'teacher', 'reception'), markAbsence);
router.post('/nap', authorize('admin', 'teacher', 'reception'), startNap);
router.post('/nap/log', authorize('admin', 'teacher', 'reception'), logNap);
router.put('/nap/:id', authorize('admin', 'teacher', 'reception'), endNap);

module.exports = router;
