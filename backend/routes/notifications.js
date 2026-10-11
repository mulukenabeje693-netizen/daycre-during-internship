const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markNotificationRead,
  markAllRead,
  getApprovalHistory,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getNotifications);
router.get('/approvals', getApprovalHistory);
router.put('/mark-all-read', markAllRead);
router.put('/:refId/read', markNotificationRead);

module.exports = router;
