const express = require('express');
const router = express.Router();
const { getVisitors, checkInVisitor, checkOutVisitor, getTodayVisitors } = require('../controllers/visitorController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'reception'));

router.get('/', getVisitors);
router.get('/today', getTodayVisitors);
router.post('/checkin', checkInVisitor);
router.put('/:id/checkout', checkOutVisitor);

module.exports = router;
