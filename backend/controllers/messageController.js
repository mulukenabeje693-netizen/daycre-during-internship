const Message = require('../models/Message');
const crypto = require('crypto');

// @desc    Get inbox messages
// @desc    Get inbox messages
// @route   GET /api/messages/inbox
// @access  Private
const getInbox = async (req, res) => {
  try {
    const messages = await Message.find({ recipient: req.user._id, parentMessage: null })
      .populate('sender', 'fullName role avatar')
      .populate('recipient', 'fullName role avatar')
      .populate('relatedChild', 'firstName lastName')
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean()
      .maxTimeMS(5000);

    // ⚡ Batch-fetch latest replies in a SINGLE database query (eliminates N+1 5s loop delay)
    if (messages.length > 0) {
      const parentIds = messages.map(m => m._id);
      const replies = await Message.find({ parentMessage: { $in: parentIds } })
        .select('parentMessage body createdAt')
        .sort({ createdAt: -1 })
        .lean()
        .maxTimeMS(5000);

      const latestReplyMap = new Map();
      for (const reply of replies) {
        const pid = reply.parentMessage.toString();
        if (!latestReplyMap.has(pid)) {
          latestReplyMap.set(pid, reply);
        }
      }

      for (let msg of messages) {
        const latestReply = latestReplyMap.get(msg._id.toString());
        if (latestReply) {
          msg.latestMessageBody = latestReply.body;
          msg.latestMessageCreatedAt = latestReply.createdAt;
        }
      }
    }

    const unreadCount = messages.filter(m => !m.isRead).length;
    return res.status(200).json({ success: true, count: messages.length, unreadCount, data: messages });
  } catch (error) {
    console.error('getInbox error:', error);
    return res.status(500).json({ success: false, message: error.message, data: [], count: 0, unreadCount: 0 });
  }
};

// @desc    Get sent messages
// @route   GET /api/messages/sent
// @access  Private
const getSent = async (req, res) => {
  try {
    const messages = await Message.find({ sender: req.user._id, parentMessage: null })
      .populate('sender', 'fullName role avatar')
      .populate('recipient', 'fullName role avatar')
      .populate('relatedChild', 'firstName lastName')
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean()
      .maxTimeMS(5000);

    // ⚡ Batch-fetch latest replies in a SINGLE database query
    if (messages.length > 0) {
      const parentIds = messages.map(m => m._id);
      const replies = await Message.find({ parentMessage: { $in: parentIds } })
        .select('parentMessage body createdAt')
        .sort({ createdAt: -1 })
        .lean()
        .maxTimeMS(5000);

      const latestReplyMap = new Map();
      for (const reply of replies) {
        const pid = reply.parentMessage.toString();
        if (!latestReplyMap.has(pid)) {
          latestReplyMap.set(pid, reply);
        }
      }

      for (let msg of messages) {
        const latestReply = latestReplyMap.get(msg._id.toString());
        if (latestReply) {
          msg.latestMessageBody = latestReply.body;
          msg.latestMessageCreatedAt = latestReply.createdAt;
        }
      }
    }

    return res.status(200).json({ success: true, count: messages.length, data: messages });
  } catch (error) {
    console.error('getSent error:', error);
    return res.status(500).json({ success: false, message: error.message, data: [], count: 0 });
  }
};

// @desc    Get message thread (replies)
// @route   GET /api/messages/:id/thread
// @access  Private
const getThread = async (req, res) => {
  try {
    const parent = await Message.findById(req.params.id)
      .populate('sender', 'fullName role avatar')
      .populate('recipient', 'fullName role avatar')
      .populate('relatedChild', 'firstName lastName');

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const replies = await Message.find({ parentMessage: req.params.id })
      .populate('sender', 'fullName role avatar')
      .populate('recipient', 'fullName role avatar')
      .sort({ createdAt: 1 });

    // Mark parent as read
    if (parent.recipient._id.toString() === req.user._id.toString() && !parent.isRead) {
      await parent.markRead();
    }

    res.status(200).json({ success: true, data: { parent, replies } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send a new message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { recipientId, subject, body, relatedChild, priority, parentMessageId, broadcastGroup, broadcastCount, broadcastId } = req.body;

    const messageData = {
      sender: req.user._id,
      recipient: recipientId,
      subject: subject || 'No Subject',
      body,
      relatedChild: relatedChild || null,
      priority: priority || 'normal',
      parentMessage: parentMessageId || null,
      broadcastGroup: broadcastGroup || null,
      broadcastCount: broadcastCount ? Number(broadcastCount) : null,
      broadcastId: broadcastId || null
    };

    if (req.file) {
      messageData.attachment = {
        fileName: req.file.originalname,
        url: `/uploads/messages/${req.file.filename}`,
        mimeType: req.file.mimetype,
        size: req.file.size
      };
    }

    const message = await Message.create(messageData);
    const populated = await Message.findById(message._id)
      .populate('sender', 'fullName role avatar')
      .populate('recipient', 'fullName role avatar')
      .populate('relatedChild', 'firstName lastName');

    // Update the parent's updatedAt so it jumps to the top of recent chats
    if (parentMessageId) {
      await Message.findByIdAndUpdate(
        parentMessageId,
        { $set: { updatedAt: new Date() } },
        { timestamps: false }
      );
    }

    // Emit Socket.io event if recipient is online
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    if (io && connectedUsers && recipientId) {
      const recipientSocketId = connectedUsers.get(recipientId.toString());
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('newMessage', populated);
        if (populated.priority === 'urgent') {
          io.to(recipientSocketId).emit('urgentAnnouncement', populated);
        }
      }
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get announcements sent by the current user (grouped by broadcastId)
// @route   GET /api/messages/announcements
// @access  Private (admin/teacher)
const getAnnouncements = async (req, res) => {
  try {
    // Single aggregation pass — groups all N broadcast copies server-side.
    // Previously this fetched every individual message document (N per announcement)
    // and returned them all to Node for JS grouping, causing the 341 MB payload.
    const announcements = await Message.aggregate([
      // 1. Only the current user's announcement sends
      {
        $match: {
          sender: req.user._id,
          subject: { $regex: /^\[Announcement\]/ },
          parentMessage: null,
        },
      },
      // 2. Sort newest first before grouping so $first picks the latest copy
      { $sort: { createdAt: -1 } },
      // 3. Group by broadcastId (fall back to a per-second bucket for legacy records)
      {
        $group: {
          _id: {
            $cond: [
              { $ifNull: ['$broadcastId', false] },
              '$broadcastId',
              {
                $concat: [
                  '$subject',
                  '__',
                  {
                    $toString: {
                      $floor: { $divide: [{ $toLong: '$createdAt' }, 5000] },
                    },
                  },
                ],
              },
            ],
          },
          docId:          { $first: '$_id' },
          subject:        { $first: '$subject' },
          body:           { $first: '$body' },
          senderId:       { $first: '$sender' },
          priority:       { $first: '$priority' },
          broadcastGroup: { $first: '$broadcastGroup' },
          broadcastCount: { $first: '$broadcastCount' },
          createdAt:      { $first: '$createdAt' },
          recipientCount: { $sum: 1 },
        },
      },
      // 4. Newest announcement first
      { $sort: { createdAt: -1 } },
      // 5. Cap at 50 — the UI only shows the most recent ones
      { $limit: 50 },
    ]).option({ maxTimeMS: 8000 });

    // Populate sender in a single query (aggregation can't $lookup with virtual refs easily)
    const User = require('../models/User');
    const senderIds = [...new Set(announcements.map(a => a.senderId?.toString()).filter(Boolean))];
    const senders = await User.find({ _id: { $in: senderIds } })
      .select('fullName role avatar')
      .lean();
    const senderMap = new Map(senders.map(s => [s._id.toString(), s]));

    const result = announcements.map(a => ({
      _id:            a.docId,
      broadcastId:    a._id,
      subject:        a.subject,
      body:           a.body,
      sender:         senderMap.get(a.senderId?.toString()) || null,
      priority:       a.priority,
      broadcastGroup: a.broadcastGroup,
      broadcastCount: a.broadcastCount || a.recipientCount,
      createdAt:      a.createdAt,
    }));

    res.status(200).json({ success: true, count: result.length, data: result });
  } catch (error) {
    console.error('getAnnouncements error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark message as read
// @route   PUT /api/messages/:id/read
// @access  Private
const markRead = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    await message.markRead();
    res.status(200).json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private
const deleteMessage = async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    // Also delete replies
    await Message.deleteMany({ parentMessage: req.params.id });
    res.status(200).json({ success: true, message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get unread count
// @route   GET /api/messages/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, count: 0, message: 'User not authenticated' });
    }

    const count = await Message.countDocuments({
      recipient: req.user._id,
      isRead: false
    }).maxTimeMS(5000);

    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error('getUnreadCount error:', error);
    return res.status(500).json({
      success: false,
      count: 0,
      message: error.message || 'Failed to get unread count'
    });
  }
};

// @desc    Get active unread urgent announcements for the logged-in user
// @route   GET /api/messages/urgent-announcements
// @access  Private
const getUrgentAnnouncements = async (req, res) => {
  try {
    const userId = req.user._id;
    const urgentMsgs = await Message.find({
      recipient: userId,
      priority: 'urgent',
      isRead: false
    })
      .select('subject body priority isRead createdAt sender relatedChild attachment')
      .populate('sender', 'fullName role avatar')
      .populate('relatedChild', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
      .maxTimeMS(5000);

    return res.status(200).json({ success: true, data: urgentMsgs });
  } catch (error) {
    console.error('getUrgentAnnouncements error:', error);
    return res.status(500).json({ success: false, message: error.message, data: [] });
  }
};

module.exports = {
  getInbox,
  getSent,
  getThread,
  sendMessage,
  markRead,
  deleteMessage,
  getUnreadCount,
  getAnnouncements,
  getUrgentAnnouncements
};
