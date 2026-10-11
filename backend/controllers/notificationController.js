const Message = require('../models/Message');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');

// @desc    Get all notifications for the logged-in user
//          Aggregates: unread messages, upcoming appointments, pending/overdue payments
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    const notifications = [];

    // ── Build queries ────────────────────────────────────────────
    const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const apptQuery = {
      scheduledAt: { $gte: new Date(), $lte: in48h },
      status: { $in: ['pending', 'confirmed'] }
    };
    if (!['admin', 'reception'].includes(role)) {
      apptQuery.$or = [{ requestedBy: userId }, { withUser: userId }];
    }

    // ── Fire all DB queries in parallel ─────────────────────────
    const needsPayments = ['parent', 'admin', 'staff'].includes(role);
    const Child = require('../models/Child');

    const [unreadMessages, upcomingAppts, myChildren] = await Promise.all([
      Message.find({ recipient: userId, isRead: false })
        .populate('sender', 'fullName role')
        .populate('relatedChild', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(15)
        .lean()
        .maxTimeMS(5000),

      Appointment.find(apptQuery)
        .populate('requestedBy', 'fullName')
        .sort({ scheduledAt: 1 })
        .limit(5)
        .lean()
        .maxTimeMS(5000),

      // Only fetch children if we'll need payment filtering for parents
      (needsPayments && role === 'parent')
        ? Child.find({ parents: userId }).select('_id').lean().maxTimeMS(5000)
        : Promise.resolve(null),
    ]);

    // Now fetch payments (needs childIds from above if parent)
    let pendingPayments = [];
    if (needsPayments) {
      const paymentQuery = { status: { $in: ['pending', 'overdue'] } };
      if (role === 'parent' && myChildren) {
        paymentQuery.child = { $in: myChildren.map(c => c._id) };
      }
      pendingPayments = await Payment.find(paymentQuery)
        .populate('child', 'firstName lastName')
        .sort({ dueDate: 1 })
        .limit(5)
        .lean()
        .maxTimeMS(5000);
    }

    // ── 1. Unread Messages ───────────────────────────────────────
    unreadMessages.forEach(msg => {
      const isChildApproval = msg.broadcastId && msg.broadcastId.startsWith('child_approval_');
      const bodyText = msg.body || '';
      const isDisapproval = isChildApproval && bodyText.includes('DISAPPROVED');

      let adminReason = null;
      if (isDisapproval) {
        const match = bodyText.match(/Reason:\s*(.+)$/);
        adminReason = match ? match[1].trim() : null;
      }

      notifications.push({
        id: `msg_${msg._id}`,
        type: isChildApproval ? 'child_approval' : 'message',
        icon: isChildApproval
          ? (isDisapproval ? 'bx-error-circle' : 'bx-check-shield')
          : 'bx-envelope',
        color: isChildApproval
          ? (isDisapproval ? 'amber' : 'cyan')
          : 'indigo',
        title: msg.subject || (isChildApproval ? 'Child Registration Update' : 'New message'),
        body: isDisapproval
          ? bodyText.replace(/\s*Reason:.*$/, '').trim()
          : bodyText.substring(0, 80),
        adminReason,
        isDisapproval,
        childName: msg.relatedChild
          ? `${msg.relatedChild.firstName} ${msg.relatedChild.lastName}`
          : null,
        relatedChildId: msg.relatedChild?._id || null,
        time: msg.createdAt,
        read: false,
        refId: msg._id,
        priority: isDisapproval ? 'high' : (msg.priority === 'urgent' ? 'high' : 'normal'),
      });
    });

    // ── 2. Upcoming Appointments ─────────────────────────────────
    upcomingAppts.forEach(appt => {
      const diffMs = new Date(appt.scheduledAt) - Date.now();
      const diffHrs = Math.round(diffMs / (1000 * 60 * 60));
      notifications.push({
        id: `appt_${appt._id}`,
        type: 'appointment',
        icon: 'bx-calendar-event',
        color: 'cyan',
        title: `Appointment: ${appt.title}`,
        body: diffHrs <= 1
          ? 'Starting very soon!'
          : diffHrs < 24
            ? `Today in ${diffHrs}h · ${appt.location}`
            : `Tomorrow · ${appt.location}`,
        time: appt.scheduledAt,
        read: false,
        refId: appt._id,
        priority: diffHrs <= 2 ? 'high' : 'normal'
      });
    });

    // ── 3. Pending / Overdue Payments ────────────────────────────
    pendingPayments.forEach(pmt => {
      const isOverdue = pmt.status === 'overdue';
      notifications.push({
        id: `pay_${pmt._id}`,
        type: 'payment',
        icon: isOverdue ? 'bx-error-circle' : 'bx-receipt',
        color: isOverdue ? 'rose' : 'amber',
        title: isOverdue
          ? `Overdue invoice — ${pmt.child?.firstName || 'Child'}`
          : `Payment due — ${pmt.child?.firstName || 'Child'}`,
        body: `ETB ${pmt.amount} · ${pmt.invoiceNumber || pmt.type}`,
        time: pmt.dueDate || pmt.createdAt,
        read: false,
        refId: pmt._id,
        priority: isOverdue ? 'high' : 'normal'
      });
    });

    // ── Sort: high priority first, then newest ───────────────────
    notifications.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return new Date(b.time) - new Date(a.time);
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    res.status(200).json({
      success: true,
      unreadCount,
      data: notifications.slice(0, 20)
    });
  } catch (error) {
    console.error('Notification fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark a message-type notification as read
// @route   PUT /api/notifications/:refId/read
// @access  Private
const markNotificationRead = async (req, res) => {
  try {
    const { refId } = req.params;
    const { type } = req.body; // 'message' | 'appointment' | 'payment'

    if (type === 'message') {
      const msg = await Message.findById(refId);
      if (msg && msg.recipient.toString() === req.user._id.toString()) {
        await msg.markRead();
      }
    }
    // Appointment and Payment notifications are informational only — no mark-read needed
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark ALL unread messages as read (bulk clear)
// @route   PUT /api/notifications/mark-all-read
// @access  Private
const markAllRead = async (req, res) => {
  try {
    await Message.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.status(200).json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getNotifications, markNotificationRead, markAllRead };
// @desc    Get full approval/disapproval history (read + unread) for current user
// @route   GET /api/notifications/approvals
// @access  Private (parent, reception, admin)
const getApprovalHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch ALL child-approval messages — by broadcastId OR by subject (fallback for legacy records)
    const messages = await Message.find({
      recipient: userId,
      $or: [
        { broadcastId: { $regex: '^child_approval_' } },
        { subject: { $in: ['Child Registration Approved', 'Child Registration Disapproved'] } },
      ]
    })
      .populate('sender', 'fullName role')
      .populate('relatedChild', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(50);

    const history = messages.map(msg => {
      const bodyText = msg.body || '';
      const isDisapproval = bodyText.includes('DISAPPROVED');

      let adminReason = null;
      if (isDisapproval) {
        const match = bodyText.match(/Reason:\s*(.+)$/);
        adminReason = match ? match[1].trim() : null;
      }

      return {
        id: `msg_${msg._id}`,
        type: 'child_approval',
        icon: isDisapproval ? 'bx-error-circle' : 'bx-check-shield',
        color: isDisapproval ? 'amber' : 'cyan',
        title: msg.subject || (isDisapproval ? 'Child Registration Disapproved' : 'Child Registration Approved'),
        body: isDisapproval
          ? bodyText.replace(/\s*Reason:.*$/, '').trim()
          : bodyText.substring(0, 120),
        adminReason,
        isDisapproval,
        status: isDisapproval ? 'disapproved' : 'approved',
        childName: msg.relatedChild
          ? `${msg.relatedChild.firstName} ${msg.relatedChild.lastName}`
          : null,
        relatedChildId: msg.relatedChild?._id || null,
        time: msg.createdAt,
        read: msg.isRead,
        refId: msg._id,
        priority: isDisapproval ? 'high' : 'normal',
      };
    });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error('getApprovalHistory error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getNotifications, markNotificationRead, markAllRead, getApprovalHistory };
