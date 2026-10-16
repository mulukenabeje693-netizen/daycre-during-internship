const Payment = require('../models/Payment');
const mongoose = require('mongoose');
const User = require('../models/User');
const Child = require('../models/Child');
const axios = require('axios');
const crypto = require('crypto');
const { createChapaReference, isValidChapaReference } = require('../utils/chapaReference');
const { validateEthiopianPhone } = require('../utils/validatePhone');
const { activateSubscriptionForInvoice } = require('./subscriptionController');
const { assessChapaVerification } = require('../utils/chapaVerification');
const { isInvoiceOwnedBy } = require('../utils/subscriptionBilling');
const {
  getChapaSandboxInvoiceAmount,
  isChapaConfigured,
  areOnlinePaymentsEnabledByEnvironment
} = require('../utils/chapaConfig');
const SystemSetting = require('../models/SystemSetting');
const { getManualBankTransferConfig } = require('../utils/bankTransferConfig');
const {
  getChapaCallbackUrl,
  getChapaReturnUrl,
  getFrontendOrigin
} = require('../utils/chapaCallbackUrl');

// To test webhooks locally:
// 1. Run: ngrok http 5000
// 2. Add your ngrok URL + /api/payments/chapa-webhook to your Chapa Dashboard Webhook settings
// 3. Set CHAPA_SECRET_KEY and CHAPA_WEBHOOK_SECRET in your backend .env file

const CHAPA_SECRET = process.env.CHAPA_SECRET_KEY;
const CHAPA_CONFIGURED = isChapaConfigured(CHAPA_SECRET);
const CHAPA_BASE   = 'https://api.chapa.co/v1';
const CHAPA_HTTP_TIMEOUT_MS = 30_000;
const CHAPA_STATUSES = new Set(['pending', 'processing', 'failed', 'cancelled', 'expired', 'success', 'unverified']);

const normalizeChapaStatus = (status) => {
  const normalized = String(status || 'unverified').toLowerCase();
  if (normalized === 'canceled') return 'cancelled';
  return CHAPA_STATUSES.has(normalized) ? normalized : 'unverified';
};

const getAmountPaid = (payment) => {
  const amount = Number(payment.amount);
  const recordedAmountPaid = Number(payment.amountPaid);
  const amountPaid = payment.status === 'paid'
    ? amount
    : Number.isFinite(recordedAmountPaid) ? recordedAmountPaid : 0;
  return Math.min(amount, Math.max(0, amountPaid));
};

const getOutstandingBalance = (payment) =>
  Math.max(0, Number(payment.amount) - getAmountPaid(payment));

const getChapaChargeAmount = (payment) => {
  const savedAmount = Number(payment.chapaAmount);
  if (Number.isFinite(savedAmount) && savedAmount > 0) return savedAmount;
  return payment.status === 'paid'
    ? Number(payment.amount)
    : getOutstandingBalance(payment);
};

const saveChapaStatus = async (txRef, status) => {
  await Payment.updateOne(
    { chapaTxRef: txRef, status: { $ne: 'paid' } },
    { $set: { chapaStatus: normalizeChapaStatus(status) } }
  );
};

const chapaReceiptFields = (payment, transaction) => ({
  chapaStatus: 'success',
  status: 'paid',
  amountPaid: payment.amount,
  chapaAmount: getChapaChargeAmount(payment),
  paidDate: payment.paidDate || new Date(),
  method: 'chapa',
  chapaReference: transaction.reference || payment.chapaReference || null,
  verifiedAt: payment.verifiedAt || new Date(),
  mode: CHAPA_SECRET.startsWith('CHASECK_TEST-') ? 'test' : 'live',
  receiptNumber: payment.receiptNumber || `RCT-${payment.invoiceNumber}`,
  receiptGeneratedAt: payment.receiptGeneratedAt || new Date()
});

const onlinePaymentsAreEnabled = async () => {
  const settings = await SystemSetting.findOne().select('onlinePaymentsEnabled').lean();
  return Boolean(
    settings?.onlinePaymentsEnabled === true &&
    isChapaConfigured() &&
    areOnlinePaymentsEnabledByEnvironment()
  );
};

const getPaymentScope = async (user) => {
  if (user.role === 'parent') return { parent: user._id };
  if (user.role !== 'teacher') return {};

  const Classroom = require('../models/Classroom');
  const classroom = await Classroom.findOne({ teacher: user._id }).select('_id').lean();
  if (!classroom) return { child: { $in: [] } };

  const childIds = await Child.distinct('_id', { classroom: classroom._id });
  return { child: { $in: childIds } };
};

const isRejectedChapaReference = (error) => {
  const responseData = error.response?.data;
  const providerMessage = (typeof responseData === 'string' ? responseData : '') ||
    responseData?.message ||
    responseData?.data?.message ||
    responseData?.error ||
    responseData?.data?.error ||
    error.message ||
    '';
  return Boolean(error.isChapaReferenceRejected) || (
    [400, 404].includes(error.response?.status) &&
    /invalid transaction reference|transaction reference.*not found|transaction not found/i.test(providerMessage)
  );
};

const rejectedReferenceResponse = (res) => res.status(409).json({
  success: false,
  code: 'CHAPA_REFERENCE_REJECTED',
  message: 'Chapa rejected the prepared transaction reference. Return to the payment method step to prepare a new checkout.'
});

const hasActiveInitialization = (payment) => {
  const startedAt = new Date(payment.chapaInitStartedAt).getTime();
  return Number.isFinite(startedAt) && Date.now() - startedAt < 2 * 60 * 1000;
};

const chapaPrepare = async (req, res) => {
  try {
    if (!(await onlinePaymentsAreEnabled())) {
      return res.status(403).json({
        success: false,
        message: 'Online payments are disabled. You can view invoices and receipt history. Chapa checkout becomes available when the daycare administrator enables online payments.'
      });
    }
    if (!CHAPA_CONFIGURED) {
      return res.status(503).json({ success: false, message: 'Chapa is not configured on the server.' });
    }

    const payment = await Payment.findById(req.params.id)
      .populate('parent', 'fullName email')
      .populate('child', 'firstName lastName parents');
    if (!payment) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (!isInvoiceOwnedBy(payment, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay this invoice.' });
    }
    if (payment.status === 'paid') {
      return res.status(409).json({ success: false, message: 'Invoice is already paid.' });
    }
    if (payment.status === 'cancelled') {
      return res.status(409).json({ success: false, message: 'A cancelled invoice cannot be paid.' });
    }
    if (hasActiveInitialization(payment)) {
      return res.status(409).json({
        success: false,
        message: 'Chapa checkout is currently being initialized for this invoice. Wait before preparing another attempt.'
      });
    }
    if (payment.method && payment.method !== 'chapa') {
      return res.status(409).json({ success: false, message: 'A manual payment submission is awaiting staff confirmation.' });
    }
    const outstandingBalance = getOutstandingBalance(payment);
    if (!Number.isFinite(outstandingBalance) || outstandingBalance <= 0 || payment.currency !== 'ETB') {
      return res.status(400).json({ success: false, message: 'Invoice amount or currency is not eligible for Chapa checkout.' });
    }

    if (
      payment.chapaTxRef &&
      isValidChapaReference(payment.chapaTxRef) &&
      ['pending', 'unverified'].includes(payment.chapaStatus) &&
      !payment.chapaInitAttemptedAt &&
      Number(payment.chapaAmount) === outstandingBalance
    ) {
      return res.status(200).json({
        success: true,
        txRef: payment.chapaTxRef,
        invoiceId: payment._id,
        amount: outstandingBalance,
        currency: payment.currency || 'ETB'
      });
    }

    if (
      payment.chapaTxRef &&
      payment.chapaCheckoutUrl &&
      payment.chapaStatus === 'pending' &&
      Number(payment.chapaAmount) === outstandingBalance
    ) {
      return res.status(200).json({
        success: true,
        txRef: payment.chapaTxRef,
        invoiceId: payment._id,
        amount: outstandingBalance,
        currency: payment.currency || 'ETB',
        checkoutReady: true
      });
    }

    if (
      payment.chapaTxRef &&
      payment.chapaInitAttemptedAt &&
      !['failed', 'cancelled', 'expired'].includes(payment.chapaStatus) &&
      isValidChapaReference(payment.chapaTxRef)
    ) {
      let previous;
      try {
        previous = await requestChapaTransaction(payment.chapaTxRef);
      } catch (error) {
        if (!isRejectedChapaReference(error)) throw error;
      }

      if (previous) {
        const status = normalizeChapaStatus(previous.transaction?.status || previous.response.data?.status);
        if (status === 'success') {
          const confirmed = await confirmChapaPayment(payment.chapaTxRef);
          return res.status(200).json({
            success: true,
            alreadyPaid: true,
            txRef: payment.chapaTxRef,
            invoiceId: confirmed._id
          });
        }
        if (!['failed', 'cancelled', 'expired'].includes(status)) {
          await saveChapaStatus(payment.chapaTxRef, status);
          return res.status(409).json({
            success: false,
            status,
            message: `The previous Chapa transaction is ${status}. Verify its status before starting another payment.`
          });
        }
      }
    }

    const txRef = createChapaReference();
    const previousRef = payment.chapaTxRef || null;
    const prepared = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $in: ['pending', 'overdue'] },
        chapaTxRef: previousRef
      },
      {
        $set: {
          chapaTxRef: txRef,
          chapaAmount: outstandingBalance,
          chapaStatus: 'pending',
          mode: CHAPA_SECRET.startsWith('CHASECK_TEST-') ? 'test' : 'live'
        },
        $unset: {
          chapaCheckoutUrl: '',
          chapaInitAttemptedAt: '',
          chapaInitStartedAt: ''
        }
      },
      { new: true }
    );
    if (!prepared) {
      return res.status(409).json({
        success: false,
        message: 'The invoice changed while preparing checkout. Refresh the invoice and try again.'
      });
    }

    return res.status(200).json({
      success: true,
      txRef,
      invoiceId: prepared._id,
      amount: getChapaChargeAmount(prepared),
      currency: prepared.currency || 'ETB'
    });
  } catch (error) {
    const status = error.statusCode || error.response?.status || 502;
    console.error('Chapa preparation failed:', error.message);
    return res.status(status).json({
      success: false,
      status: error.providerStatus,
      message: error.statusCode ? error.message : 'Could not safely prepare Chapa checkout. Please retry.'
    });
  }
};

/**
 * Convert normalized Ethiopian phone (+251912345678) to 10-digit Chapa format (09xxxxxxxx)
 * @param {string} normalizedPhone - Phone in format +251912345678 or +251712345678
 * @returns {string} Phone in format 09xxxxxxxx or 07xxxxxxxx
 */
const convertPhoneToCharpaFormat = (normalizedPhone) => {
  if (!normalizedPhone || !normalizedPhone.startsWith('+251')) return null;
  const digits = normalizedPhone.slice(4); // Remove +251 to get 912345678
  if (digits.length !== 9) return null;
  return `0${digits}`; // 912345678 → 0912345678
};

const requestChapaTransaction = async (txRef) => {
  if (!CHAPA_CONFIGURED) {
    const error = new Error('Chapa is not configured on the server.');
    error.statusCode = 503;
    throw error;
  }

  let response;
  try {
    response = await axios.get(`${CHAPA_BASE}/transaction/verify/${encodeURIComponent(txRef)}`, {
      timeout: CHAPA_HTTP_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${CHAPA_SECRET}` },
    });
  } catch (error) {
    const responseData = error.response?.data;
    const providerMessage = (typeof responseData === 'string' ? responseData : '') ||
      responseData?.message ||
      responseData?.data?.message ||
      responseData?.error ||
      responseData?.data?.error ||
      '';
    if (
      [400, 404].includes(error.response?.status) &&
      /invalid transaction reference|transaction reference.*not found|transaction not found/i.test(providerMessage)
    ) {
      error.isChapaReferenceRejected = true;
    }
    throw error;
  }
  const transaction = response.data?.data;
  const providerMessage = response.data?.message || transaction?.message || '';
  if (
    !transaction &&
    /invalid transaction reference|transaction reference.*not found|transaction not found/i.test(providerMessage)
  ) {
    const error = new Error(providerMessage);
    error.statusCode = 400;
    error.isChapaReferenceRejected = true;
    throw error;
  }
  if (!transaction) {
    const error = new Error('Chapa verification response did not include the transaction.');
    error.statusCode = 502;
    throw error;
  }
  if (transaction.tx_ref !== txRef) {
    const error = new Error('Chapa transaction reference does not match the invoice.');
    error.statusCode = 400;
    throw error;
  }

  return { response, transaction };
};

const verifyChapaTransaction = async (txRef) => {
  const { response, transaction } = await requestChapaTransaction(txRef);
  if (response.data?.status !== 'success' || transaction?.status !== 'success') {
    const providerStatus = String(transaction?.status || response.data?.status || 'unverified').toLowerCase();
    const error = new Error(`Payment is not confirmed by Chapa (status: ${providerStatus}).`);
    error.statusCode = 409;
    error.providerStatus = providerStatus;
    throw error;
  }

  return transaction;
};

const confirmChapaPayment = async (txRef) => {
  const payment = await Payment.findOne({ chapaTxRef: txRef });
  if (!payment) {
    const error = new Error('Invoice not found for this transaction.');
    error.statusCode = 404;
    throw error;
  }

  const transaction = await verifyChapaTransaction(txRef);
  const expectedAmount = getChapaChargeAmount(payment);
  if (
    payment.status !== 'paid' &&
    getOutstandingBalance(payment) !== expectedAmount
  ) {
    const error = new Error('Invoice balance changed after Chapa checkout was prepared. The transaction needs manual review.');
    error.statusCode = 409;
    throw error;
  }
  if (expectedAmount <= 0 || !assessChapaVerification({
    responseData: { status: 'success', data: transaction },
    txRef,
    amount: expectedAmount,
    currency: payment.currency || 'ETB'
  }).verified) {
    const error = new Error('Chapa payment amount or currency does not match the invoice.');
    error.statusCode = 400;
    throw error;
  }

  if (payment.status === 'paid') {
    if (payment.method === 'chapa') {
      const receiptFields = chapaReceiptFields(payment, transaction);
      await Payment.updateOne({ _id: payment._id }, { $set: receiptFields });
      await activateSubscriptionForInvoice(payment);
      return payment;
    }
    const error = new Error('Invoice has already been settled using another payment method.');
    error.statusCode = 409;
    throw error;
  }
  if (payment.status === 'cancelled') {
    const error = new Error('Cannot confirm payment for a cancelled invoice.');
    error.statusCode = 409;
    throw error;
  }

  const updated = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      chapaTxRef: txRef,
      amount: payment.amount,
      chapaAmount: expectedAmount,
      $or: [
        { amountPaid: payment.amountPaid || 0 },
        { amountPaid: { $exists: false } }
      ],
      status: { $in: ['pending', 'overdue'] }
    },
    {
      $set: {
        ...chapaReceiptFields(payment, transaction)
      }
    },
    { new: true }
  );
  if (updated) {
    await activateSubscriptionForInvoice(updated);
    return updated;
  }

  const current = await Payment.findById(payment._id);
  if (current?.status === 'paid' && current.method === 'chapa') {
    await activateSubscriptionForInvoice(current);
    return current;
  }
  const error = new Error('Invoice status changed before payment confirmation.');
  error.statusCode = 409;
  throw error;
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
const getPayments = async (req, res) => {
  try {
    const query = await getPaymentScope(req.user);

    const { status, childId } = req.query;
    if (status) query.status = status;
    if (childId) {
      query.child = query.child?.$in
        ? { $in: query.child.$in.filter(id => String(id) === String(childId)) }
        : childId;
    }

    const payments = await Payment.find(query)
      .populate('parent', 'fullName email phone')
      .populate('child', 'firstName lastName')
      .populate('createdBy', 'fullName')
      .sort({ dueDate: -1 });

    const data = payments.map(payment => {
      const record = typeof payment.toObject === 'function' ? payment.toObject() : payment;
      const amount = Number(record.amount) || 0;
      const amountPaid = record.status === 'paid'
        ? amount
        : Math.min(amount, Math.max(0, Number(record.amountPaid) || 0));
      return {
        ...record,
        amountPaid,
        outstandingBalance: Math.max(0, amount - amountPaid)
      };
    });
    const totalPaid = data.reduce((sum, payment) => sum + payment.amountPaid, 0);
    const totalPending = data
      .filter(payment => payment.status === 'pending')
      .reduce((sum, payment) => sum + payment.outstandingBalance, 0);
    const totalOverdue = data
      .filter(payment => payment.status === 'overdue')
      .reduce((sum, payment) => sum + payment.outstandingBalance, 0);

    res.status(200).json({
      success: true,
      count: data.length,
      stats: { totalPaid, totalPending, totalOverdue },
      data
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
    const scope = await getPaymentScope(req.user);
    const payment = await Payment.findOne({ _id: req.params.id, ...scope })
      .populate('parent', 'fullName email phone')
      .populate({
        path: 'child',
        select: 'firstName lastName classroom',
        populate: { path: 'classroom', select: 'name' }
      })
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
    const linkedChild = await Child.findById(req.body.child).select('parents').lean();
    if (!linkedChild) {
      return res.status(404).json({ success: false, message: 'Child not found.' });
    }
    const parentIsLinked = (linkedChild.parents || []).some(
      parent => String(parent?._id || parent) === String(req.body.parent)
    );
    if (!parentIsLinked) {
      return res.status(400).json({ success: false, message: 'The selected parent is not linked to this child.' });
    }

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

    const payment = await Payment.create({
      parent: req.body.parent,
      child: req.body.child,
      amount: req.body.amount,
      type: req.body.type,
      dueDate: req.body.dueDate,
      notes: req.body.notes,
      subscriptionId: req.body.subscriptionId,
      billingPeriodStart: req.body.billingPeriodStart,
      billingPeriodEnd: req.body.billingPeriodEnd,
      status: 'pending',
      method: null,
      createdBy: req.user._id
    });

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

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    payment.status = 'paid';
    payment.amountPaid = payment.amount;
    payment.paidDate = new Date();
    payment.method = method || 'cash';
    payment.notes = notes || '';
    await payment.save();
    await payment.populate([
      { path: 'parent', select: 'fullName email' },
      { path: 'child', select: 'firstName lastName' }
    ]);

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
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (!isInvoiceOwnedBy(payment, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay this invoice' });
    }

    if (payment.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Invoice is already paid' });
    }
    if (payment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot pay a cancelled invoice' });
    }
    if (payment.method || payment.chapaTxRef) {
      return res.status(409).json({ success: false, message: 'A payment attempt or manual payment submission already exists for this invoice.' });
    }

    const { method, bankName, notes } = req.body;
    if (!['bank-transfer', 'cash', 'check'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Card processing is not configured. Use Chapa checkout, or submit a bank, cash, or check payment for staff confirmation.'
      });
    }
    if (method === 'bank-transfer' && !String(bankName || '').trim()) {
      return res.status(400).json({ success: false, message: 'Select the bank or wallet used for the transfer.' });
    }

    const submissionDetails = [
      `Parent payment submitted: ${method}`,
      bankName ? `Bank/wallet: ${String(bankName).trim()}` : '',
      notes ? String(notes).trim().slice(0, 500) : ''
    ].filter(Boolean).join(' · ');
    payment.method = method;
    payment.notes = [payment.notes, submissionDetails].filter(Boolean).join(' · ');
    await payment.save();

    const populated = await Payment.findById(payment._id)
      .populate('parent', 'fullName email')
      .populate('child',  'firstName lastName');

    res.status(202).json({
      success: true,
      message: 'Payment details submitted. The invoice remains unpaid until daycare staff confirm receipt.',
      data: populated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Initialize Chapa payment — returns a checkout URL
// @route   POST /api/payments/:id/chapa-init
// @access  Private (parent)
const chapaInitialize = async (req, res) => {
  let initializationLockAt = null;
  try {
    if (!(await onlinePaymentsAreEnabled())) {
      return res.status(403).json({
        success: false,
        message: 'Online payments are disabled. You can view invoices and receipt history. Chapa checkout becomes available when the daycare administrator enables online payments.'
      });
    }
    if (!CHAPA_CONFIGURED) {
      return res.status(503).json({ success: false, message: 'Chapa is not configured on the server.' });
    }

    const payment = await Payment.findById(req.params.id)
      .populate('parent', 'fullName email')
      .populate('child',  'firstName lastName parents');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Verify ownership
    const isOwner = isInvoiceOwnedBy(payment, req.user._id);

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay this invoice' });
    }
    if (payment.status === 'paid')      return res.status(400).json({ success: false, message: 'Invoice already paid' });
    if (payment.status === 'cancelled') return res.status(400).json({ success: false, message: 'Cannot pay a cancelled invoice' });
    if (payment.method && payment.method !== 'chapa') {
      return res.status(409).json({ success: false, message: 'A manual payment submission is awaiting staff confirmation.' });
    }
    const outstandingBalance = getOutstandingBalance(payment);
    if (!Number.isFinite(outstandingBalance) || outstandingBalance <= 0 || payment.currency !== 'ETB') {
      return res.status(400).json({ success: false, message: 'Invoice amount or currency is not eligible for Chapa checkout.' });
    }

    const requestedTxRef = req.body?.txRef;
    if (
      typeof requestedTxRef !== 'string' ||
      !requestedTxRef.trim() ||
      requestedTxRef !== payment.chapaTxRef
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction reference for this invoice. Prepare checkout before initializing payment.'
      });
    }

    if (payment.chapaAmount != null && Number(payment.chapaAmount) !== outstandingBalance) {
      return res.status(409).json({
        success: false,
        code: 'CHAPA_AMOUNT_CHANGED',
        message: 'The invoice balance changed after checkout preparation. Return to the payment method step to prepare a new transaction.'
      });
    }

    if (hasActiveInitialization(payment)) {
      return res.status(409).json({
        success: false,
        status: 'processing',
        message: 'Chapa checkout is currently being initialized for this invoice. Wait before trying again.'
      });
    }

    if (payment.chapaTxRef && payment.chapaCheckoutUrl && payment.chapaStatus === 'pending') {
      return res.status(200).json({
        success: true,
        checkoutUrl: payment.chapaCheckoutUrl,
        txRef: payment.chapaTxRef
      });
    }

    if (payment.chapaTxRef) {
      if (!isValidChapaReference(payment.chapaTxRef)) {
        return res.status(409).json({
          success: false,
          message: 'This older transaction reference is not supported. Return to payment method selection to prepare a new checkout.'
        });
      }

      if (payment.chapaInitAttemptedAt) {
        let previousAttempt;
        try {
          previousAttempt = await requestChapaTransaction(payment.chapaTxRef);
        } catch (error) {
          if (!isRejectedChapaReference(error)) throw error;

          await Payment.updateOne(
            {
              _id: payment._id,
              chapaTxRef: payment.chapaTxRef,
              status: { $in: ['pending', 'overdue'] }
            },
            {
              $set: { chapaStatus: 'failed' },
              $unset: {
                chapaTxRef: '',
                chapaCheckoutUrl: '',
                chapaInitAttemptedAt: '',
                chapaInitStartedAt: ''
              }
            }
          );
          return rejectedReferenceResponse(res);
        }
        const previousStatus = normalizeChapaStatus(
          previousAttempt.transaction.status || previousAttempt.response.data?.status
        );

        if (previousStatus === 'success') {
          const verification = assessChapaVerification({
            responseData: previousAttempt.response.data,
            txRef: payment.chapaTxRef,
            amount: getChapaChargeAmount(payment),
            currency: payment.currency || 'ETB'
          });
          if (!verification.verified) {
            await saveChapaStatus(payment.chapaTxRef, 'unverified');
            return res.status(409).json({
              success: false,
              status: 'unverified',
              message: 'Chapa reports a completed payment that does not match this invoice.'
            });
          }

          const confirmedPayment = await confirmChapaPayment(payment.chapaTxRef);
          return res.status(200).json({
            success: true,
            alreadyPaid: true,
            paymentId: confirmedPayment._id,
            txRef: payment.chapaTxRef
          });
        }

        if (!['failed', 'cancelled', 'expired'].includes(previousStatus)) {
          await saveChapaStatus(payment.chapaTxRef, previousStatus);
          return res.status(409).json({
            success: false,
            status: previousStatus,
            message: previousStatus === 'pending'
              ? 'A Chapa checkout for this invoice is still pending. Complete or cancel that checkout before starting another.'
              : 'The previous Chapa attempt could not be verified. Please retry verification before starting another payment.'
          });
        }
        return res.status(409).json({
          success: false,
          status: previousStatus,
          message: 'This Chapa attempt has ended. Return to payment method selection to prepare a new checkout.'
        });
      }
    }

    // Chapa accepts phone_number optionally; validate it when supplied.
    let phoneToUse = req.body?.phone_number || req.user.phone;
    
    // Validate phone number if provided
    let chapaPhoneNumber = null;
    if (phoneToUse) {
      const validation = validateEthiopianPhone(phoneToUse);
      if (validation.valid && validation.normalized) {
        // Convert from +251912345678 format to 09xxxxxxxx format for Chapa
        chapaPhoneNumber = convertPhoneToCharpaFormat(validation.normalized);
        if (!chapaPhoneNumber) {
          return res.status(400).json({ success: false, message: 'Invalid phone number format for payment processing.' });
        }
      } else {
        return res.status(400).json({ success: false, message: `Invalid phone number: ${validation.error}` });
      }
    }

    const txRef = payment.chapaTxRef || createChapaReference();
    if (!isValidChapaReference(txRef)) {
      return res.status(400).json({
        success: false,
        message: 'Transaction reference is too long. Return to payment method selection to prepare checkout again.'
      });
    }
    const frontendUrl = getFrontendOrigin();
    const callbackUrl = getChapaCallbackUrl();

    const sanitizeCustomizationText = (value) =>
      (value || '')
        .replace(/[^A-Za-z0-9 _\-.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 64);

    const chapaPayload = {
      amount:           outstandingBalance.toString(),
      currency:         payment.currency || 'ETB',
      email:            payment.parent?.email || req.user.email || 'noreply@mintdaycare.com',
      first_name:       (payment.parent?.fullName || req.user.fullName || 'Parent').split(' ')[0],
      last_name:        (payment.parent?.fullName || req.user.fullName || 'Parent').split(' ').slice(1).join(' ') || 'User',
      ...(chapaPhoneNumber ? { phone_number: chapaPhoneNumber } : {}),
      tx_ref:           txRef,
      return_url:       getChapaReturnUrl(undefined, txRef),
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      customization: {
        title:       'MiNT Daycare'.slice(0, 16),
        description: sanitizeCustomizationText(`Invoice ${payment.invoiceNumber} ${payment.type?.replace(/-/g,' ')}`),
        logo:        `${frontendUrl}/assets/images/mint-logo.png`,
      },
    };

    // Include phone_number if available (Chapa requires it)

    const lockAt = new Date();
    const lockExpiry = new Date(Date.now() - 2 * 60 * 1000);
    const lockedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $in: ['pending', 'overdue'] },
        chapaTxRef: payment.chapaTxRef || null,
        amount: payment.amount,
        $and: [
          {
            $or: [
              { amountPaid: Number(payment.amountPaid) || 0 },
              { amountPaid: { $exists: false } }
            ]
          },
          {
            $or: [
              { chapaInitStartedAt: null },
              { chapaInitStartedAt: { $exists: false } },
              { chapaInitStartedAt: { $lt: lockExpiry } }
            ]
          }
        ]
      },
      {
        $set: {
          chapaInitStartedAt: lockAt,
          chapaTxRef: txRef,
          chapaAmount: outstandingBalance,
          chapaInitAttemptedAt: lockAt,
          chapaStatus: 'processing',
          mode: CHAPA_SECRET.startsWith('CHASECK_TEST-') ? 'test' : 'live'
        }
      },
      { new: true }
    );
    if (!lockedPayment) {
      return res.status(409).json({
        success: false,
        message: 'A Chapa checkout is already being initialized for this invoice. Please wait before trying again.'
      });
    }
    initializationLockAt = lockAt;

    const chapaRes = await axios.post(`${CHAPA_BASE}/transaction/initialize`, chapaPayload, {
      headers: {
        Authorization: `Bearer ${CHAPA_SECRET}`,
        'Content-Type': 'application/json',
      },
      timeout: CHAPA_HTTP_TIMEOUT_MS,
    });

    if (chapaRes.data?.status !== 'success') {
      await Payment.updateOne(
        { _id: payment._id, chapaInitStartedAt: lockAt },
        { $set: { chapaStatus: 'failed' }, $unset: { chapaInitStartedAt: '', chapaInitAttemptedAt: '', chapaTxRef: '', chapaCheckoutUrl: '' } }
      );
      initializationLockAt = null;
      return res.status(502).json({
        success: false,
        code: 'CHAPA_INITIALIZATION_FAILED',
        message: chapaRes.data?.message || 'Chapa initialization failed. Prepare a new checkout before retrying.'
      });
    }

    const checkoutUrl = chapaRes.data?.data?.checkout_url;
    let parsedCheckoutUrl;
    try {
      parsedCheckoutUrl = new URL(checkoutUrl);
    } catch {
      await Payment.updateOne(
        { _id: payment._id, chapaInitStartedAt: lockAt },
        { $set: { chapaStatus: 'pending' }, $unset: { chapaInitStartedAt: '' } }
      );
      initializationLockAt = null;
      return res.status(502).json({
        success: false,
        code: 'CHAPA_CHECKOUT_UNAVAILABLE',
        txRef,
        message: 'Chapa accepted the transaction but did not return a valid checkout link. Check its verified status before retrying.'
      });
    }
    if (parsedCheckoutUrl.protocol !== 'https:' || parsedCheckoutUrl.hostname !== 'checkout.chapa.co') {
      await Payment.updateOne(
        { _id: payment._id, chapaInitStartedAt: lockAt },
        { $set: { chapaStatus: 'pending' }, $unset: { chapaInitStartedAt: '' } }
      );
      initializationLockAt = null;
      return res.status(502).json({
        success: false,
        code: 'CHAPA_CHECKOUT_UNAVAILABLE',
        txRef,
        message: 'Chapa returned an unexpected checkout address. The transaction was retained; verify its status before retrying.'
      });
    }

    await Payment.updateOne(
      { _id: payment._id, chapaInitStartedAt: lockAt },
      {
        $set: { chapaCheckoutUrl: checkoutUrl, chapaStatus: 'pending' },
        $unset: { chapaInitStartedAt: '' }
      }
    );
    initializationLockAt = null;

    res.status(200).json({
      success:     true,
      checkoutUrl,
      txRef
    });
  } catch (error) {
    if (initializationLockAt) {
      if (isRejectedChapaReference(error)) {
        await Payment.updateOne(
          { _id: req.params.id, chapaInitStartedAt: initializationLockAt },
          {
            $set: { chapaStatus: 'failed' },
            $unset: {
              chapaInitStartedAt: '',
              chapaInitAttemptedAt: '',
              chapaTxRef: '',
              chapaCheckoutUrl: ''
            }
          }
        );
        initializationLockAt = null;
        return rejectedReferenceResponse(res);
      }
      await Payment.updateOne(
        { _id: req.params.id, chapaInitStartedAt: initializationLockAt },
        { $unset: { chapaInitStartedAt: '' } }
      );
    }
    console.error('Chapa initialization failed:', error.message);
    res.status(error.statusCode || error.response?.status || 502).json({
      success: false,
      status: error.providerStatus,
      message: error.statusCode ? error.message : error.response?.data?.message || 'Chapa checkout initialization failed.'
    });
  }
};

// @desc    Verify Chapa payment after redirect
// @route   POST /api/payments/chapa-verify
// @access  Private (parent)
const chapaVerify = async (req, res) => {
  try {
    const { txRef } = req.body;
    if (typeof txRef !== 'string' || !txRef.trim()) {
      return res.status(400).json({ success: false, message: 'txRef is required' });
    }

    const invoice = await Payment.findOne({ chapaTxRef: txRef })
      .select('parent child amount amountPaid chapaAmount status method currency subscriptionId billingPeriodStart billingPeriodEnd');
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found for this transaction' });
    }
    const isOwner = isInvoiceOwnedBy(invoice, req.user._id);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to verify this invoice' });
    }
    if (!CHAPA_CONFIGURED) {
      return res.status(503).json({ success: false, message: 'Chapa is not configured on the server.' });
    }

    const { response: verifyRes } = await requestChapaTransaction(txRef);

    const expectedAmount = getChapaChargeAmount(invoice);
    if (expectedAmount <= 0) {
      return res.status(409).json({
        success: false,
        status: 'paid',
        message: 'This invoice has no outstanding balance.'
      });
    }
    if (invoice.status !== 'paid' && getOutstandingBalance(invoice) !== expectedAmount) {
      await saveChapaStatus(txRef, 'unverified');
      return res.status(409).json({
        success: false,
        status: 'unverified',
        message: 'The invoice balance changed after checkout was prepared. Contact the daycare administrator to reconcile this payment.'
      });
    }

    const verification = assessChapaVerification({
      responseData: verifyRes.data,
      txRef,
      amount: expectedAmount,
      currency: invoice.currency || 'ETB'
    });
    if (!verification.verified && verification.status !== 'mismatch') {
      const { status } = verification;
      await saveChapaStatus(txRef, status);
      return res.status(409).json({
        success: false,
        status,
        message: status === 'unverified'
          ? 'Chapa has not confirmed this payment. You can retry verification or check the invoice status.'
          : `Chapa reports this payment as ${status}. You can retry verification if the status is still pending.`
      });
    }

    if (verification.status === 'mismatch') {
      await saveChapaStatus(txRef, 'unverified');
      return res.status(400).json({
        success: false,
        message: 'Chapa payment reference, amount, or currency does not match the invoice.'
      });
    }

    if (invoice.status === 'paid' && invoice.method === 'chapa') {
      await activateSubscriptionForInvoice(invoice);
      const alreadyPaid = await Payment.findById(invoice._id)
        .populate('parent', 'fullName email')
        .populate('child', 'firstName lastName');
      return res.status(200).json({ success: true, data: alreadyPaid });
    }

    if (invoice.status === 'paid') {
      if (invoice.method !== 'chapa') {
        return res.status(409).json({ success: false, message: 'Invoice has already been settled using another payment method.' });
      }
    } else if (invoice.status === 'cancelled') {
      return res.status(409).json({ success: false, message: 'Cannot confirm payment for a cancelled invoice.' });
    }

    const payment = await Payment.findOneAndUpdate(
      {
        _id: invoice._id,
        chapaTxRef: txRef,
        status: { $in: ['pending', 'overdue'] }
      },
      {
        $set: {
          ...chapaReceiptFields(invoice, verification.transaction)
        }
      },
      { new: true }
    )
      .populate('parent', 'fullName email')
      .populate('child', 'firstName lastName');

    if (!payment && invoice.status !== 'paid') {
      const current = await Payment.findById(invoice._id)
        .populate('parent', 'fullName email')
        .populate('child', 'firstName lastName');
      if (current?.status !== 'paid' || current.method !== 'chapa') {
        return res.status(409).json({ success: false, message: 'Invoice status changed before payment confirmation.' });
      }
      await activateSubscriptionForInvoice(current);
      return res.status(200).json({ success: true, data: current });
    }

    await activateSubscriptionForInvoice(payment);
    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    console.error('Chapa verification failed:', error.message);
    res.status(error.statusCode || error.response?.status || 502).json({
      success: false,
      message: error.statusCode ? error.message : error.response?.data?.message || 'Could not verify this transaction with Chapa.'
    });
  }
};

const getMonthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const findExistingMonthlyInvoice = async ({ parentId, childId, dueDate = new Date() }) => {
  const { start, end } = getMonthRange(dueDate);
  return Payment.findOne({
    parent: parentId,
    child: childId,
    type: 'monthly-fee',
    dueDate: { $gte: start, $lte: end },
    status: { $ne: 'cancelled' }
  });
};

const getSandboxInvoiceErrorMessage = (error) => {
  if (error.name === 'ValidationError') {
    return `Test invoice validation failed: ${Object.values(error.errors || {})
      .map(validationError => `${validationError.path}: ${validationError.message}`)
      .join('; ')}`;
  }
  if (error.name === 'CastError') {
    return `Invalid ${error.path || 'database'} reference while creating the test invoice.`;
  }
  if (error.name === 'MongoServerSelectionError' || error.name === 'MongoNetworkError') {
    return 'The database is temporarily unavailable while creating the test invoice. Check the backend database connection and retry.';
  }
  if (error.code === 11000) {
    return 'A matching test invoice already exists. Refresh the invoice list before retrying.';
  }

  return String(error.message || 'Unknown error')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, '[MongoDB connection redacted]')
    .replace(/\b(?:CHAPA_SECRET_KEY|CHAPA_WEBHOOK_SECRET)\s*[:=]\s*\S+/gi, '[Chapa secret redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token redacted]')
    .slice(0, 300) || 'Unknown test invoice error.';
};

// @desc    Generate a test invoice for the logged-in parent (testing only)
// @route   POST /api/payments/generate-test
// @access  Private (parent)
const generateTestInvoice = async (req, res) => {
  let failureStage = 'configuration';
  try {
    const requestedParentId = req.params?.parentId || req.body?.parentId || req.user._id;
    const actorRole = req.user.role;
    const parentId = actorRole === 'admin' ? requestedParentId : req.user._id;

    if (actorRole !== 'parent' && actorRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only a parent or administrator can issue a test invoice.'
      });
    }

    const amount = getChapaSandboxInvoiceAmount();
    if (amount === null) {
      return res.status(403).json({
        success: false,
        code: 'TEST_INVOICE_DISABLED',
        message: 'Test invoices are disabled. In a non-production environment set ALLOW_TEST_INVOICES=true, a positive CHAPA_TEST_INVOICE_AMOUNT, and a valid Chapa test secret key.'
      });
    }

    failureStage = 'parent lookup';
    const targetParent = await User.findById(parentId).lean();
    if (!targetParent) {
      return res.status(404).json({
        success: false,
        message: 'The selected parent account was not found.'
      });
    }

    failureStage = 'active child lookup';
    const activeChildren = await Child.find({ parents: parentId, status: 'active' })
      .select('_id')
      .sort({ createdAt: -1 })
      .lean();

    if (!activeChildren.length) {
      return res.status(400).json({
        success: false,
        message: 'No child is linked to this parent account. Please ask daycare staff to link the child first.'
      });
    }

    const childIds = activeChildren.map(child => child._id);
    const testInvoiceNotes = 'Test invoice for Chapa sandbox checkout only.';
    failureStage = 'existing test invoice lookup';
    const existingTestInvoices = await Payment.find({
      parent: parentId,
      child: { $in: childIds },
      sandboxTestInvoice: true
    })
      .populate('parent', 'fullName email')
      .populate('child', 'firstName lastName classroom')
      .lean();

    const existingPayableInvoice = existingTestInvoices.find(invoice =>
      ['pending', 'overdue'].includes(invoice.status) &&
      Number(invoice.amount) > Math.max(0, Number(invoice.amountPaid) || 0)
    );

    if (existingPayableInvoice) {
      return res.status(200).json({
        success: true,
        alreadyUsed: true,
        data: existingPayableInvoice,
        message: 'An unpaid sandbox test invoice already exists for this parent and child.'
      });
    }

    const invoicesByChild = new Map();
    for (const invoice of existingTestInvoices) {
      const childId = String(invoice.child?._id || invoice.child);
      const childInvoices = invoicesByChild.get(childId) || [];
      childInvoices.push(invoice);
      invoicesByChild.set(childId, childInvoices);
    }
    const child = activeChildren.find(candidate => {
      const previousInvoices = invoicesByChild.get(String(candidate._id));
      return !previousInvoices || previousInvoices.every(invoice => invoice.status === 'paid');
    });
    if (!child) {
      return res.status(409).json({
        success: false,
        message: 'Every active child has an unpaid or unsettled sandbox test invoice. No duplicate test invoice was created.'
      });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    let payment;
    failureStage = 'invoice creation';
    try {
      payment = await Payment.create({
        parent: parentId,
        child: child._id,
        invoiceNumber: `TEST-${crypto.randomUUID().toUpperCase()}`,
        amount,
        type: 'other',
        dueDate,
        status: 'pending',
        mode: 'test',
        notes: testInvoiceNotes,
        sandboxTestInvoice: true,
        createdBy: req.user._id,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await Payment.findOne({
        parent: parentId,
        child: child._id,
        sandboxTestInvoice: true,
        status: { $in: ['pending', 'overdue'] }
      })
        .populate('parent', 'fullName email')
        .populate('child', 'firstName lastName classroom')
        .sort({ createdAt: -1 });
      if (existing) {
        const hasOutstandingBalance = ['pending', 'overdue'].includes(existing.status) &&
          Number(existing.amount) > Math.max(0, Number(existing.amountPaid) || 0);
        return res.status(200).json({
          success: hasOutstandingBalance,
          alreadyUsed: true,
          data: existing,
          message: hasOutstandingBalance
            ? 'An unpaid sandbox test invoice already exists for this parent and child.'
            : 'A sandbox test invoice already exists for this child and is no longer payable.'
        });
      }
      return res.status(409).json({
        success: false,
        code: 'TEST_INVOICE_INDEX_CONFLICT',
        message: 'A database uniqueness rule conflicts with this sandbox invoice request. Ask an administrator to back up the database and run the payment index migration before retrying.'
      });
    }

    failureStage = 'created invoice lookup';
    const populated = await Payment.findById(payment._id)
      .populate('parent', 'fullName email')
      .populate('child', 'firstName lastName classroom');
    if (!populated) {
      throw new Error('The test invoice was created but could not be loaded. Refresh the invoice list before retrying.');
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    const message = getSandboxInvoiceErrorMessage(error);
    console.error(`Sandbox test invoice generation failed during ${failureStage}: ${error.name || 'Error'}${error.code ? ` (${error.code})` : ''}: ${message}`);
    res.status(500).json({
      success: false,
      code: 'TEST_INVOICE_FAILURE',
      stage: failureStage,
      message
    });
  }
};

// @desc    Chapa Webhook listener
// @route   POST /api/payments/chapa-webhook
// @access  Public
const chapaWebhook = async (req, res) => {
  try {
    const secret = process.env.CHAPA_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(503).send('Webhook verification is not configured');
    }

    const signature = req.headers['x-chapa-signature'];
    if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) {
      return res.status(400).send('Invalid signature');
    }
    const received = Buffer.from(signature, 'hex');
    const signedPayloads = [
      req.rawBody,
      Buffer.from(JSON.stringify(req.body))
    ].filter(Boolean);
    const signatureIsValid = signedPayloads.some(payload => {
      const expected = crypto.createHmac('sha256', secret).update(payload).digest();
      return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    });
    if (!signatureIsValid) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    const txRef = event?.tx_ref || event?.data?.tx_ref;
    const eventStatus = event?.data?.status || event?.status;
    if (typeof txRef !== 'string' || !txRef) {
      return res.status(400).send('Invalid webhook transaction reference');
    }
    if (normalizeChapaStatus(eventStatus) === 'success') {
      await confirmChapaPayment(txRef);
    } else if (eventStatus) {
      await saveChapaStatus(txRef, eventStatus);
    }
    return res.status(200).send('Webhook received');
  } catch (err) {
    console.error('Webhook error:', err.message);
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
    if (!CHAPA_CONFIGURED) {
      return res.status(503).json({ success: false, message: 'Chapa is not configured on the server.' });
    }

    const invoice = await Payment.findOne({ chapaTxRef: tx_ref });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found for this transaction' });
    }

    const verifyRes = await axios.get(`${CHAPA_BASE}/transaction/verify/${encodeURIComponent(tx_ref)}`, {
      timeout: CHAPA_HTTP_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${CHAPA_SECRET}` },
    });

    if (verifyRes.data?.status !== 'success' || verifyRes.data?.data?.status !== 'success') {
      await saveChapaStatus(tx_ref, verifyRes.data?.data?.status || verifyRes.data?.status);
      return res.status(400).json({ success: false, message: 'Payment not confirmed by Chapa' });
    }

    const transaction = verifyRes.data.data;
    if (
      transaction.tx_ref !== tx_ref ||
      Number(transaction.amount) !== Number(invoice.amount) ||
      String(transaction.currency).toUpperCase() !== String(invoice.currency || 'ETB').toUpperCase()
    ) {
      await saveChapaStatus(tx_ref, 'unverified');
      return res.status(400).json({ success: false, message: 'Chapa payment does not match the invoice.' });
    }
    if (invoice.status === 'paid' && invoice.method !== 'chapa') {
      return res.status(409).json({ success: false, message: 'Invoice has already been settled using another payment method.' });
    }
    if (invoice.status === 'cancelled') {
      return res.status(409).json({ success: false, message: 'Cannot confirm payment for a cancelled invoice.' });
    }

    // Find and mark the payment as paid
    const payment = await Payment.findOneAndUpdate(
      {
        _id: invoice._id,
        chapaTxRef: tx_ref,
        status: { $in: ['pending', 'overdue'] }
      },
      {
        $set: {
          ...chapaReceiptFields(invoice, transaction)
        }
      },
      { new: true }
    )
      .populate('parent', 'fullName email')
      .populate('child',  'firstName lastName');

    if (!payment && invoice.status === 'paid' && invoice.method === 'chapa') {
      const alreadyPaid = await Payment.findById(invoice._id)
        .populate('parent', 'fullName email')
        .populate('child', 'firstName lastName');
      await activateSubscriptionForInvoice(alreadyPaid);
      return res.status(200).json({ success: true, data: alreadyPaid });
    }
    if (!payment) {
      return res.status(409).json({ success: false, message: 'Invoice status changed before payment confirmation.' });
    }
    await activateSubscriptionForInvoice(payment);
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
    const scopeFilter = await getPaymentScope(req.user);
    if (req.user.role === 'teacher' && scopeFilter.child.$in.length === 0) {
      return res.status(200).json({
        success: true,
        stats: {
          totalPaid: 0,
          totalCollected: 0,
          totalPending: 0,
          totalOverdue: 0,
          totalInvoices: 0,
          paidInvoices: 0,
          unpaidInvoices: 0,
          partiallyPaidInvoices: 0
        },
        data: []
      });
    }

    // Run stats aggregation and recent records fetch in parallel
    const [aggResult, recent] = await Promise.all([
      Payment.aggregate([
        { $match: scopeFilter },
        {
          $group: {
            _id: '$status',
            total: { $sum: '$amount' },
            collected: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'paid'] },
                  '$amount',
                  { $ifNull: ['$amountPaid', 0] }
                ]
              }
            },
            count: { $sum: 1 },
            partiallyPaidCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: [{ $ifNull: ['$amountPaid', 0] }, 0] },
                      { $lt: [{ $ifNull: ['$amountPaid', 0] }, '$amount'] },
                      { $ne: ['$status', 'paid'] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            unpaidCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$status', ['pending', 'overdue']] },
                      { $lte: [{ $ifNull: ['$amountPaid', 0] }, 0] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
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
    const stats = {
      totalPaid: 0,
      totalCollected: 0,
      totalPending: 0,
      totalOverdue: 0,
      totalInvoices: 0,
      paidInvoices: 0,
      unpaidInvoices: 0,
      partiallyPaidInvoices: 0
    };
    aggResult.forEach(({ _id, total, collected, count, unpaidCount, partiallyPaidCount }) => {
      stats.totalInvoices += count || 0;
      stats.totalCollected += collected || 0;
      if (_id === 'paid') {
        stats.totalPaid = collected || 0;
        stats.paidInvoices = count || 0;
      }
      if (_id === 'pending') stats.totalPending = total || 0;
      if (_id === 'overdue') stats.totalOverdue = total || 0;
      stats.unpaidInvoices += unpaidCount || 0;
      stats.partiallyPaidInvoices += partiallyPaidCount || 0;
    });

    res.status(200).json({ success: true, stats, data: recent });
  } catch (error) {
    console.error('getPaymentSummary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getInvoiceList = async (req, res) => {
  try {
    const scope = await getPaymentScope(req.user);
    const linkedChildIds = req.user.role === 'parent'
      ? await Child.distinct('_id', { parents: req.user._id })
      : null;
    const linkedChildScope = linkedChildIds
      ? { child: { $in: linkedChildIds } }
      : {};
    const activeChildIds = req.user.role === 'parent'
      ? await Child.distinct('_id', { parents: req.user._id, status: 'active' })
      : null;
    const activeChildScope = activeChildIds
      ? { child: { $in: activeChildIds } }
      : {};
    const query = {
      ...scope,
      ...linkedChildScope,
      status: { $in: ['pending', 'overdue'] },
      amount: { $gt: 0 },
      $expr: {
        $gt: [
          { $subtract: ['$amount', { $ifNull: ['$amountPaid', 0] }] },
          0
        ]
      }
    };

    const [invoices, paidInvoice, sandboxInvoices] = await Promise.all([
      Payment.find(query)
        .select('parent child invoiceNumber type amount amountPaid currency status dueDate billingPeriodStart billingPeriodEnd notes sandboxTestInvoice')
        .populate('parent', 'fullName email phone')
        .populate('child', 'firstName lastName')
        .sort({ dueDate: -1 })
        .lean(),
      Payment.findOne({ ...scope, ...linkedChildScope, status: 'paid' }).select('_id').lean(),
      activeChildIds
        ? Payment.find({
          ...scope,
          ...activeChildScope,
          sandboxTestInvoice: true
        }).select('child status').lean()
        : Promise.resolve([])
    ]);

    const sandboxInvoicesByChild = new Map();
    for (const invoice of sandboxInvoices) {
      const childId = String(invoice.child?._id || invoice.child);
      const childInvoices = sandboxInvoicesByChild.get(childId) || [];
      childInvoices.push(invoice);
      sandboxInvoicesByChild.set(childId, childInvoices);
    }
    const testInvoiceState = activeChildIds
      ? activeChildIds.length === 0
        ? 'no-active-children'
        : activeChildIds.some(childId => {
          const previousInvoices = sandboxInvoicesByChild.get(String(childId));
          return !previousInvoices || previousInvoices.every(invoice => invoice.status === 'paid');
        })
          ? 'available'
          : 'already-issued'
      : null;

    res.status(200).json({
      success: true,
      count: invoices.length,
      hasPaidInvoices: Boolean(paidInvoice),
      ...(testInvoiceState ? { testInvoiceState } : {}),
      data: invoices.map(invoice => {
        const amount = Number(invoice.amount);
        const amountPaid = invoice.status === 'paid'
          ? amount
          : Math.min(amount, Math.max(0, Number(invoice.amountPaid) || 0));
        return {
          ...invoice,
          amountPaid,
          outstandingBalance: Math.max(0, amount - amountPaid)
        };
      })
    });
  } catch (error) {
    console.error('Invoice list failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Could not load invoices right now. Please retry in a moment.'
    });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID.' });
    }

    const payment = await Payment.findOne({
      _id: req.params.id,
      parent: req.user._id
    })
      .select('invoiceNumber status method chapaStatus chapaTxRef chapaAmount chapaCheckoutUrl verifiedAt receiptNumber paidDate amount currency bankTransferReference bankTransferProviderReference bankTransferStatus bankTransferDecisionNote bankTransferVerifiedAt')
      .lean();

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const { chapaCheckoutUrl, ...statusPayment } = payment;
    res.status(200).json({
      success: true,
      data: {
        ...statusPayment,
        chapaInitialized: Boolean(chapaCheckoutUrl)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load invoice status.' });
  }
};

const initializePaymentAlias = async (req, res) => {
  try {
    const invoiceId = req.body?.invoiceId || req.body?.id || req.query?.invoiceId || req.query?.id;
    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'invoiceId is required' });
    }

    req.params = { ...(req.params || {}), id: invoiceId };
    return chapaInitialize(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const verifyPaymentAlias = async (req, res) => {
  try {
    const txRef = req.body?.txRef || req.body?.tx_ref || req.query?.tx_ref || req.query?.txRef;
    if (!txRef) {
      return res.status(400).json({ success: false, message: 'txRef is required' });
    }

    req.body = { ...(req.body || {}), txRef };
    return chapaVerify(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getReceipts = async (req, res) => {
  try {
    const query = { ...(await getPaymentScope(req.user)), status: 'paid' };

    const receipts = await Payment.find(query)
      .populate('parent', 'fullName email phone')
      .populate('child', 'firstName lastName classroom')
      .sort({ paidDate: -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: receipts.length,
      data: receipts.map(receipt => ({
        ...receipt,
        amountPaid: Number(receipt.amount),
        outstandingBalance: 0
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getReceiptById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid receipt ID.' });
    }

    const scope = await getPaymentScope(req.user);
    const receipt = await Payment.findOne({ _id: req.params.id, ...scope })
      .populate('parent', 'fullName email phone')
      .populate('child', 'firstName lastName classroom')
      .lean();

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (receipt.status !== 'paid') {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        ...receipt,
        amountPaid: Number(receipt.amount),
        outstandingBalance: 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const prepareManualBankTransfer = async (req, res) => {
  try {
    const bankTransfer = getManualBankTransferConfig();
    if (!bankTransfer.available) {
      return res.status(503).json({
        success: false,
        code: 'BANK_TRANSFER_UNAVAILABLE',
        message: 'Manual bank transfer is unavailable until the daycare administrator configures verified bank details.'
      });
    }

    const invoice = await Payment.findById(req.params.id)
      .populate('child', 'firstName lastName parents');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (!isInvoiceOwnedBy(invoice, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay this invoice.' });
    }
    if (!['pending', 'overdue'].includes(invoice.status) || invoice.currency !== 'ETB') {
      return res.status(409).json({ success: false, message: 'Only unpaid ETB invoices can be paid by bank transfer.' });
    }
    if (invoice.method && invoice.method !== 'bank-transfer') {
      return res.status(409).json({ success: false, message: 'Another payment method is already assigned to this invoice.' });
    }
    if (invoice.bankTransferStatus === 'pending_verification') {
      return res.status(409).json({
        success: false,
        code: 'BANK_TRANSFER_PENDING_VERIFICATION',
        message: 'This transfer is already awaiting administrator verification.',
        reference: invoice.bankTransferReference
      });
    }

    if (invoice.bankTransferReference && invoice.bankTransferStatus === 'prepared') {
      return res.status(200).json({
        success: true,
        reference: invoice.bankTransferReference,
        amount: getOutstandingBalance(invoice),
        currency: invoice.currency,
        bankTransfer
      });
    }

    const reference = `MINT-BANK-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    const update = await Payment.updateOne(
      {
        _id: invoice._id,
        parent: invoice.parent?._id || invoice.parent,
        status: { $in: ['pending', 'overdue'] },
        method: invoice.method || null,
        bankTransferStatus: invoice.bankTransferStatus || null
      },
      {
        $set: { bankTransferReference: reference, bankTransferStatus: 'prepared' },
        $push: {
          bankTransferAudit: {
            action: 'prepared',
            actor: req.user._id,
            reference
          }
        }
      }
    );
    if (update.modifiedCount !== 1) {
      return res.status(409).json({ success: false, message: 'The invoice changed. Refresh and try again.' });
    }

    return res.status(200).json({
      success: true,
      reference,
      amount: getOutstandingBalance(invoice),
      currency: invoice.currency,
      bankTransfer
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Could not reserve a unique bank transfer reference. Please retry.' });
    }
    console.error('Bank transfer preparation failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not prepare the bank transfer. Please retry.' });
  }
};

const submitManualBankTransfer = async (req, res) => {
  try {
    if (!getManualBankTransferConfig().available) {
      return res.status(503).json({
        success: false,
        code: 'BANK_TRANSFER_UNAVAILABLE',
        message: 'Manual bank transfer is not currently configured.'
      });
    }
    const invoice = await Payment.findById(req.params.id).populate('child', 'parents');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (!isInvoiceOwnedBy(invoice, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to submit a transfer for this invoice.' });
    }

    const transferReference = String(req.body?.reference || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{2,99}$/.test(transferReference)) {
      return res.status(400).json({ success: false, message: 'Enter a valid bank transaction reference (3–100 letters, numbers, or . _ / -).' });
    }

    const updated = await Payment.findOneAndUpdate(
      {
        _id: invoice._id,
        parent: req.user._id,
        status: { $in: ['pending', 'overdue'] },
        currency: 'ETB',
        bankTransferStatus: 'prepared',
        bankTransferReference: req.body?.paymentReference,
        $or: [{ method: null }, { method: 'bank-transfer' }]
      },
      {
        $set: {
          method: 'bank-transfer',
          bankTransferStatus: 'pending_verification',
          bankTransferProviderReference: transferReference,
          bankTransferSubmittedAt: new Date(),
          bankTransferDecisionNote: ''
        },
        $push: {
          bankTransferAudit: {
            action: 'submitted',
            actor: req.user._id,
            reference: transferReference
          }
        }
      },
      { new: true }
    );
    if (!updated) {
      return res.status(409).json({
        success: false,
        message: invoice.bankTransferStatus === 'pending_verification'
          ? 'This transfer is already awaiting verification.'
          : 'The bank transfer reference is invalid or this invoice is no longer payable.'
      });
    }
    return res.status(202).json({
      success: true,
      status: 'pending_verification',
      message: 'Transfer details submitted. The invoice remains unpaid until an administrator confirms funds were received.'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This bank transaction reference was already submitted.' });
    }
    console.error('Bank transfer submission failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not submit bank transfer details. Please retry.' });
  }
};

const getManualBankTransfers = async (req, res) => {
  try {
    const transfers = await Payment.find({ method: 'bank-transfer', bankTransferStatus: 'pending_verification' })
      .populate('parent', 'fullName email')
      .populate('child', 'firstName lastName')
      .sort({ bankTransferSubmittedAt: 1 })
      .lean();
    return res.status(200).json({ success: true, count: transfers.length, data: transfers });
  } catch (error) {
    console.error('Manual bank transfer queue failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load bank transfers for review.' });
  }
};

const reviewManualBankTransfer = async (req, res) => {
  try {
    const decision = req.body?.decision;
    const note = String(req.body?.note || '').trim();
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be approve or reject.' });
    }
    if (note.length < 5 || note.length > 500) {
      return res.status(400).json({ success: false, message: 'Enter a verification note between 5 and 500 characters.' });
    }

    const invoice = await Payment.findById(req.params.id);
    if (!invoice || invoice.method !== 'bank-transfer') {
      return res.status(404).json({ success: false, message: 'Bank transfer not found.' });
    }
    if (invoice.bankTransferStatus !== 'pending_verification' || !['pending', 'overdue'].includes(invoice.status)) {
      const alreadyApplied =
        (decision === 'approve' && invoice.bankTransferStatus === 'verified' && invoice.status === 'paid') ||
        (decision === 'reject' && invoice.bankTransferStatus === 'rejected');
      if (alreadyApplied) return res.status(200).json({ success: true, alreadyProcessed: true, data: invoice });
      return res.status(409).json({ success: false, message: 'This bank transfer has already been reviewed or is no longer payable.' });
    }

    const now = new Date();
    const action = decision === 'approve' ? 'approved' : 'rejected';
    const update = decision === 'approve'
      ? {
        $set: {
          status: 'paid',
          amountPaid: invoice.amount,
          paidDate: now,
          bankTransferStatus: 'verified',
          bankTransferVerifiedBy: req.user._id,
          bankTransferVerifiedAt: now,
          bankTransferDecisionNote: note,
          verifiedAt: now,
          receiptNumber: invoice.receiptNumber || `RCT-${invoice.invoiceNumber}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          receiptGeneratedAt: now
        },
        $push: { bankTransferAudit: { action, actor: req.user._id, reference: invoice.bankTransferProviderReference || '', note } }
      }
      : {
        $set: {
          bankTransferStatus: 'rejected',
          bankTransferVerifiedBy: req.user._id,
          bankTransferVerifiedAt: now,
          bankTransferDecisionNote: note,
          method: null,
          bankTransferReference: null,
          bankTransferProviderReference: null,
          bankTransferSubmittedAt: null
        },
        $push: { bankTransferAudit: { action, actor: req.user._id, reference: invoice.bankTransferProviderReference || '', note } }
      };
    const updated = await Payment.findOneAndUpdate(
      { _id: invoice._id, status: { $in: ['pending', 'overdue'] }, bankTransferStatus: 'pending_verification' },
      update,
      { new: true }
    );
    if (!updated) return res.status(409).json({ success: false, message: 'Another administrator reviewed this transfer. Refresh the queue.' });

    if (decision === 'approve' && updated.subscriptionId) {
      await activateSubscriptionForInvoice(updated);
    }
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Manual bank transfer review failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not save the bank transfer review.' });
  }
};

module.exports = {
  getPayments, getPayment, getPaymentSummary, createPayment, markAsPaid, parentPay, updatePayment,
  deletePayment, checkOverdue, chapaPrepare, chapaInitialize, chapaVerify, generateTestInvoice,
  chapaWebhook, chapaVerifyFallback, getInvoiceList, getPaymentStatus, initializePaymentAlias,
  verifyPaymentAlias, getReceipts, getReceiptById, prepareManualBankTransfer,
  submitManualBankTransfer, getManualBankTransfers, reviewManualBankTransfer
};
