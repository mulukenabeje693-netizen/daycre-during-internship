const Payment = require('../models/Payment');
const Child = require('../models/Child');
const axios = require('axios');
const crypto = require('crypto');

// To test webhooks locally:
// 1. Run: ngrok http 5000
// 2. Add your ngrok URL + /api/payments/chapa-webhook to your Chapa Dashboard Webhook settings
// 3. Set CHAPA_SECRET_KEY and CHAPA_WEBHOOK_SECRET in your backend .env file

const CHAPA_SECRET = process.env.CHAPA_SECRET_KEY;
const CHAPA_BASE   = 'https://api.chapa.co/v1';

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
const getPayments = async (req, res) => {
  try {
    let query = {};

    // Parents only see their own payments
    if (req.user.role === 'parent') {
      query.parent = req.user._id;
    }

    const { status, childId } = req.query;
    if (status) query.status = status;
    if (childId) query.child = childId;

    const payments = await Payment.find(query)
      .populate('parent', 'fullName email phone')
      .populate('child', 'firstName lastName')
      .populate('createdBy', 'fullName')
      .sort({ dueDate: -1 });

    // Summary stats
    const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
    const totalOverdue = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);

    res.status(200).json({
      success: true,
      count: payments.length,
      stats: { totalPaid, totalPending, totalOverdue },
      data: payments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
const getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('parent', 'fullName email phone')
      .populate('child', 'firstName lastName')
      .populate('createdBy', 'fullName');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create invoice/payment
// @route   POST /api/payments
// @access  Private (admin, staff)
const createPayment = async (req, res) => {
  try {
    if (req.body.type === 'monthly-fee' && req.body.child) {
      const dueDate = new Date(req.body.dueDate || Date.now());
      const startOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
      const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0, 23, 59, 59);

      const existingInvoice = await Payment.findOne({
        child: req.body.child,
        type: 'monthly-fee',
        dueDate: { $gte: startOfMonth, $lte: endOfMonth }
      });

      if (existingInvoice) {
        return res.status(400).json({ success: false, message: 'A monthly fee invoice already exists for this child for the selected month.' });
      }
    }

    const payment = await Payment.create({ ...req.body, createdBy: req.user._id });

    const populated = await Payment.findById(payment._id)
      .populate('parent', 'fullName email')
      .populate('child', 'firstName lastName');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark payment as paid
// @route   PUT /api/payments/:id/pay
// @access  Private (admin, staff)
const markAsPaid = async (req, res) => {
  try {
    const { method, notes } = req.body;

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      {
        status: 'paid',
        paidDate: new Date(),
        method: method || 'cash',
        notes: notes || ''
      },
      { new: true }
    )
      .populate('parent', 'fullName email')
      .populate('child', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update payment
// @route   PUT /api/payments/:id
// @access  Private (admin, staff)
const updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('parent', 'fullName email')
      .populate('child', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete payment
// @route   DELETE /api/payments/:id
// @access  Private (admin)
const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    res.status(200).json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Auto-update overdue statuses
// @route   PUT /api/payments/check-overdue
// @access  Private (admin)
const checkOverdue = async (req, res) => {
  try {
    const result = await Payment.updateMany(
      { status: 'pending', dueDate: { $lt: new Date() } },
      { status: 'overdue' }
    );
    res.status(200).json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Parent submits payment for their own invoice
// @route   PUT /api/payments/:id/parent-pay
// @access  Private (parent only)
const parentPay = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('child', 'firstName lastName parents');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Verify this invoice belongs to the requesting parent
    const child = await Child.findById(payment.child._id || payment.child);
    const isOwner = payment.parent.toString() === req.user._id.toString() ||
      (child?.parents && child.parents.some(p => p.toString() === req.user._id.toString()));

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay this invoice' });
    }

    if (payment.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Invoice is already paid' });
    }
    if (payment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot pay a cancelled invoice' });
    }

    const { method, cardLast4, cardBrand, bankName, notes } = req.body;

    // Build payment notes summary
    let paymentNote = notes || '';
    if (method === 'card' && cardLast4) {
      paymentNote = `${cardBrand || 'Card'} ending in ${cardLast4}${notes ? ' · ' + notes : ''}`;
    } else if (method === 'bank-transfer' && bankName) {
      paymentNote = `Bank transfer via ${bankName}${notes ? ' · ' + notes : ''}`;
    }

    payment.status   = 'paid';
    payment.paidDate = new Date();
    payment.method   = method || 'card';
    payment.notes    = paymentNote;
    await payment.save();

    const populated = await Payment.findById(payment._id)
      .populate('parent', 'fullName email')
      .populate('child',  'firstName lastName');

    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Initialize Chapa payment — returns a checkout URL
// @route   POST /api/payments/:id/chapa-init
// @access  Private (parent)
const chapaInitialize = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('parent', 'fullName email')
      .populate('child',  'firstName lastName parents');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Verify ownership
    const child = await Child.findById(payment.child?._id || payment.child);
    const isOwner =
      payment.parent?._id?.toString() === req.user._id.toString() ||
      payment.parent?.toString()       === req.user._id.toString() ||
      (child?.parents && child.parents.some(p => p.toString() === req.user._id.toString()));

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay this invoice' });
    }
    if (payment.status === 'paid')      return res.status(400).json({ success: false, message: 'Invoice already paid' });
    if (payment.status === 'cancelled') return res.status(400).json({ success: false, message: 'Cannot pay a cancelled invoice' });

    const txRef      = `MINT-${payment._id}-${Date.now()}`;
    const frontendUrl = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000';

    const sanitizeCustomizationText = (value) =>
      (value || '')
        .replace(/[^A-Za-z0-9 _\-.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 64);

    const chapaPayload = {
      amount:           payment.amount.toString(),
      currency:         'ETB',
      email:            payment.parent?.email || req.user.email || 'noreply@mintdaycare.com',
      first_name:       (payment.parent?.fullName || req.user.fullName || 'Parent').split(' ')[0],
      last_name:        (payment.parent?.fullName || req.user.fullName || 'Parent').split(' ').slice(1).join(' ') || 'User',
      tx_ref:           txRef,
      callback_url:     `${frontendUrl}/dashboard/parent/payments?chapa_tx=${txRef}&invoice_id=${payment._id}`,
      return_url:       `${frontendUrl}/dashboard/parent/payments?chapa_tx=${txRef}&invoice_id=${payment._id}`,
      customization: {
        title:       'MiNT Daycare'.slice(0, 16),
        description: sanitizeCustomizationText(`Invoice ${payment.invoiceNumber} ${payment.type?.replace(/-/g,' ')}`),
        logo:        `${frontendUrl}/assets/images/mint-logo.png`,
      },
    };

    const chapaRes = await axios.post(`${CHAPA_BASE}/transaction/initialize`, chapaPayload, {
      headers: {
        Authorization: `Bearer ${CHAPA_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    if (chapaRes.data?.status !== 'success') {
      return res.status(502).json({ success: false, message: chapaRes.data?.message || 'Chapa initialization failed' });
    }

    // Save tx_ref on the payment so we can verify later
    payment.chapaTxRef = txRef;
    await payment.save();

    res.status(200).json({
      success:     true,
      checkoutUrl: chapaRes.data.data.checkout_url,
      txRef,
    });
  } catch (error) {
    console.error('Chapa init error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
};

// @desc    Verify Chapa payment after redirect
// @route   POST /api/payments/chapa-verify
// @access  Private (parent)
const chapaVerify = async (req, res) => {
  try {
    const { txRef } = req.body;
    if (!txRef) return res.status(400).json({ success: false, message: 'txRef is required' });

    const verifyRes = await axios.get(`${CHAPA_BASE}/transaction/verify/${txRef}`, {
      headers: { Authorization: `Bearer ${CHAPA_SECRET}` },
    });

    if (verifyRes.data?.status !== 'success' || verifyRes.data?.data?.status !== 'success') {
      return res.status(400).json({ success: false, message: 'Payment not confirmed by Chapa' });
    }

    // Find and mark the payment as paid
    const payment = await Payment.findOneAndUpdate(
      { chapaTxRef: txRef },
      {
        status:   'paid',
        paidDate: new Date(),
        method:   'chapa',
        notes:    `Chapa: ${txRef}`,
      },
      { new: true }
    )
      .populate('parent', 'fullName email')
      .populate('child',  'firstName lastName');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Invoice not found for this transaction' });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    console.error('Chapa verify error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
};

// @desc    Generate a test invoice for the logged-in parent (testing only)
// @route   POST /api/payments/generate-test
// @access  Private (parent)
const generateTestInvoice = async (req, res) => {
  try {
    // Find first child belonging to this parent
    const child = await Child.findOne({ parents: req.user._id });
    if (!child) {
      return res.status(400).json({ success: false, message: 'No children found. Please register a child first.' });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const startOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
    const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0, 23, 59, 59);

    const existingInvoice = await Payment.findOne({
      child: child._id,
      type: 'monthly-fee',
      dueDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    if (existingInvoice) {
      return res.status(400).json({ success: false, message: 'A monthly fee invoice already exists for this child for the current month.' });
    }

    const payment = await Payment.create({
      parent:    req.user._id,
      child:     child._id,
      amount:    500,
      type:      'monthly-fee',
      dueDate,
      status:    'pending',
      createdBy: req.user._id,
    });

    const populated = await Payment.findById(payment._id)
      .populate('parent', 'fullName email')
      .populate('child', 'firstName lastName classroom');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Chapa Webhook listener
// @route   POST /api/payments/chapa-webhook
// @access  Public
const chapaWebhook = async (req, res) => {
  try {
    // Note: ensure process.env.CHAPA_WEBHOOK_SECRET is set in your .env
    const secret = process.env.CHAPA_WEBHOOK_SECRET || '';
    const hash = crypto.createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash === req.headers['x-chapa-signature']) {
      const event = req.body;
      
      if (event.status === 'success') {
        const txRef = event.tx_ref;
        
        // Find and mark the payment as paid
        const payment = await Payment.findOneAndUpdate(
          { chapaTxRef: txRef },
          {
            status:   'paid',
            paidDate: new Date(),
            method:   'chapa',
            notes:    `Chapa Webhook Auto-Paid: ${txRef}`,
          },
          { new: true }
        );
        
        if (payment) {
          console.log(`Payment ${payment.invoiceNumber} auto-updated via Chapa webhook`);
        }
      }
      return res.status(200).send('Webhook received');
    }
    
    return res.status(400).send('Invalid signature');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Server Error');
  }
};

// @desc    Fallback verify Chapa payment via GET
// @route   GET /api/payments/verify/:tx_ref
// @access  Private (admin, staff)
const chapaVerifyFallback = async (req, res) => {
  try {
    const { tx_ref } = req.params;
    if (!tx_ref) return res.status(400).json({ success: false, message: 'tx_ref is required' });

    const verifyRes = await axios.get(`${CHAPA_BASE}/transaction/verify/${tx_ref}`, {
      headers: { Authorization: `Bearer ${CHAPA_SECRET}` },
    });

    if (verifyRes.data?.status !== 'success' || verifyRes.data?.data?.status !== 'success') {
      return res.status(400).json({ success: false, message: 'Payment not confirmed by Chapa' });
    }

    // Find and mark the payment as paid
    const payment = await Payment.findOneAndUpdate(
      { chapaTxRef: tx_ref },
      {
        status:   'paid',
        paidDate: new Date(),
        method:   'chapa',
        notes:    `Chapa (Manual Verify): ${tx_ref}`,
      },
      { new: true }
    )
      .populate('parent', 'fullName email')
      .populate('child',  'firstName lastName');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Invoice not found for this transaction' });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    console.error('Chapa fallback verify error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
};

// @desc    Dashboard summary — aggregated stats + last 10 records (fast, no full scan)
// @route   GET /api/payments/summary
// @access  Private (all roles)
const getPaymentSummary = async (req, res) => {
  try {
    const { role, _id: userId } = req.user;

    // Build a scope filter so each role only sees their own data
    let scopeFilter = {};
    if (role === 'parent') {
      // Use { parent: 1 } standalone index for fastest lookup
      scopeFilter = { parent: userId };
    } else if (role === 'teacher') {
      const Classroom = require('../models/Classroom');
      const classroom = await Classroom.findOne({ teacher: userId })
        .select('children')
        .lean();
      const childIds = classroom?.children || [];
      // If teacher has no classroom yet, return empty stats immediately
      if (childIds.length === 0) {
        return res.status(200).json({
          success: true,
          stats: { totalPaid: 0, totalPending: 0, totalOverdue: 0 },
          data: []
        });
      }
      scopeFilter = { child: { $in: childIds } };
    }
    // admin / staff / reception see everything — scopeFilter stays {}

    // Run stats aggregation and recent records fetch in parallel
    const [aggResult, recent] = await Promise.all([
      Payment.aggregate([
        { $match: scopeFilter },
        {
          $group: {
            _id: '$status',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]).option({ maxTimeMS: 8000 }),

      Payment.find(scopeFilter)
        .select('invoiceNumber type amount status dueDate paidDate parent child')
        .populate('parent', 'fullName')
        .populate('child', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .maxTimeMS(8000),
    ]);

    // Map aggregation result into a flat stats object
    const stats = { totalPaid: 0, totalPending: 0, totalOverdue: 0 };
    aggResult.forEach(({ _id, total }) => {
      if (_id === 'paid')    stats.totalPaid    = total;
      if (_id === 'pending') stats.totalPending = total;
      if (_id === 'overdue') stats.totalOverdue = total;
    });

    res.status(200).json({ success: true, stats, data: recent });
  } catch (error) {
    console.error('getPaymentSummary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getPayments, getPayment, getPaymentSummary, createPayment, markAsPaid, parentPay, updatePayment, deletePayment, checkOverdue, chapaInitialize, chapaVerify, generateTestInvoice, chapaWebhook, chapaVerifyFallback };


