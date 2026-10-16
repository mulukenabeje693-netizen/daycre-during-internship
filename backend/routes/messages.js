const express = require('express');
const router = express.Router();
const {
  getInbox,
  getSent,
  getThread,
  sendMessage,
  markRead,
  deleteMessage,
  getUnreadCount,
  getAnnouncements,
  getUrgentAnnouncements
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

router.get('/inbox', getInbox);
router.get('/sent', getSent);
router.get('/unread-count', getUnreadCount);
router.get('/announcements', getAnnouncements);
router.get('/urgent-announcements', getUrgentAnnouncements);
router.get('/:id/thread', getThread);
router.post('/', upload.single('attachment'), sendMessage);
router.put('/:id/read', markRead);
router.delete('/:id', deleteMessage);

module.exports = router;

// Re-submission notification — sends urgent message to all admins + sets parent status to 'resubmitted'
router.post('/resubmit-notification', async (req, res) => {
  try {
    const { body, subject } = req.body;
    const User    = require('../models/User');
    const Message = require('../models/Message');

    // 1. Update the parent's approvalStatus to 'resubmitted' so admin sees it in pending list
    await User.findByIdAndUpdate(req.user._id, {
      approvalStatus: 'resubmitted',
      approvalNote:   ''   // clear the old disapproval note so it shows clean
    });

    // 2. Find all admins and send them an urgent re-submission notification
    const admins = await User.find({ role: 'admin' }).select('_id').lean();
    if (admins.length === 0) {
      return res.status(200).json({ success: true, message: 'No admins found' });
    }

    const broadcastId = `resubmit_${req.user._id}_${Date.now()}`;
    const messages = admins.map(admin => ({
      sender:      req.user._id,
      recipient:   admin._id,
      subject:     subject || '[Re-submission] Parent Profile Updated for Review',
      body:        body    || `${req.user.fullName || 'A parent'} has re-submitted their profile for review.`,
      priority:    'urgent',
      broadcastId,
      broadcastGroup: null,
    }));

    const inserted = await Message.insertMany(messages);

    // 3. Emit real-time socket events to online admins
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    if (io && connectedUsers) {
      inserted.forEach(msg => {
        const socketId = connectedUsers.get(msg.recipient.toString());
        if (socketId) io.to(socketId).emit('newMessage', msg);
      });
    }

    return res.status(200).json({ success: true, count: inserted.length });
  } catch (err) {
    console.error('resubmit-notification error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});
