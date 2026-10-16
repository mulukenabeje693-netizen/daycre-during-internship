const crypto = require('crypto');
const Child = require('../models/Child');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const {
  DAY_IN_MS,
  getTrialDurationDays,
  getMonthlyFee,
  isMonthlyFeeConfigured,
  getTrialEligibility,
  addCalendarMonth,
  getMonthRange,
  buildTrialInvoiceFilter
} = require('../utils/subscriptionBilling');

const getParentChildren = (userId) =>
  Child.find({ parents: userId, status: 'active' }).select('_id').lean();

const createOrGetTrialInvoice = async ({
  Payment: PaymentModel = Payment,
  parentId,
  childId,
  subscriptionId,
  amount,
  billingPeriodStart,
  billingPeriodEnd
}) => {
  const dueDate = new Date(billingPeriodStart.getTime() + 7 * DAY_IN_MS);
  const { start, end } = getMonthRange(dueDate);
  const existing = await PaymentModel.findOne({
    parent: parentId,
    child: childId,
    type: 'monthly-fee',
    dueDate: { $gte: start, $lte: end },
    status: { $ne: 'cancelled' }
  });
  if (existing) return existing;

  const filter = buildTrialInvoiceFilter({ parentId, childId, billingPeriodStart });
  try {
    return await PaymentModel.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          ...filter,
          subscriptionId,
          invoiceNumber: `INV-TRIAL-${billingPeriodStart.getTime()}-${crypto.randomBytes(6).toString('hex')}`,
          amount,
          dueDate,
          billingPeriodEnd,
          status: 'pending',
          createdBy: parentId,
          notes: 'Automatically generated after the parent free trial expired.'
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    const invoice = await PaymentModel.findOne(filter);
    if (!invoice) throw error;
    return invoice;
  }
};

const ensureExpiredTrialInvoices = async (subscription) => {
  if (!subscription.trialEndsAt || subscription.trialEndsAt > new Date()) return [];

  let amount;
  try {
    amount = getMonthlyFee();
  } catch (error) {
    error.statusCode = 503;
    throw error;
  }

  const children = await getParentChildren(subscription.userId);
  if (!children.length) {
    const error = new Error('No active child is linked to this account, so a monthly invoice could not be created.');
    error.statusCode = 409;
    throw error;
  }

  const billingPeriodStart = new Date(subscription.trialEndsAt);
  const billingPeriodEnd = addCalendarMonth(billingPeriodStart);
  const invoices = [];
  for (const child of children) {
    invoices.push(await createOrGetTrialInvoice({
      parentId: subscription.userId,
      childId: child._id,
      subscriptionId: subscription._id,
      amount,
      billingPeriodStart,
      billingPeriodEnd
    }));
  }

  if (subscription.status === 'trialing') {
    subscription.status = 'expired';
    subscription.currentPeriodStart = billingPeriodStart;
    subscription.currentPeriodEnd = billingPeriodEnd;
    await subscription.save();
  }
  return invoices;
};

exports.getMySubscription = async (req, res) => {
  try {
    let subscription = await Subscription.findOne({ userId: req.user._id });
    let invoices = [];
    if (subscription && subscription.trialEndsAt <= new Date() && ['trialing', 'expired'].includes(subscription.status)) {
      invoices = await ensureExpiredTrialInvoices(subscription);
    }

    const [childCount, refreshedSubscription] = await Promise.all([
      Child.countDocuments({ parents: req.user._id, status: 'active' }),
      subscription ? Subscription.findById(subscription._id).lean() : Promise.resolve(null)
    ]);
    const eligibility = getTrialEligibility({
      role: req.user.role,
      approvalStatus: req.user.approvalStatus,
      childCount,
      subscription: refreshedSubscription
    });
    const invoiceGenerationConfigured = isMonthlyFeeConfigured();
    const ineligibilityReason = eligibility.reason ||
      (invoiceGenerationConfigured ? null : 'The daycare monthly fee is not configured. Please contact the administrator before starting a trial.');

    return res.status(200).json({
      success: true,
      data: {
        subscription: refreshedSubscription,
        canStartTrial: eligibility.eligible && invoiceGenerationConfigured,
        ineligibilityReason,
        trialDurationDays: refreshedSubscription?.trialStartedAt && refreshedSubscription?.trialEndsAt
          ? Math.ceil((refreshedSubscription.trialEndsAt - refreshedSubscription.trialStartedAt) / DAY_IN_MS)
          : getTrialDurationDays(),
        invoices,
        invoiceGenerationConfigured
      }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Could not load your subscription information.'
    });
  }
};

exports.startTrial = async (req, res) => {
  try {
    const [subscription, children] = await Promise.all([
      Subscription.findOne({ userId: req.user._id }),
      getParentChildren(req.user._id)
    ]);
    const eligibility = getTrialEligibility({
      role: req.user.role,
      approvalStatus: req.user.approvalStatus,
      childCount: children.length,
      subscription
    });
    if (!eligibility.eligible) {
      return res.status(409).json({ success: false, message: eligibility.reason });
    }

    try {
      getMonthlyFee();
    } catch (error) {
      return res.status(503).json({ success: false, message: error.message });
    }

    let days;
    try {
      days = getTrialDurationDays();
    } catch (error) {
      return res.status(503).json({ success: false, message: error.message });
    }
    const trialStartedAt = new Date();
    const trialEndsAt = new Date(trialStartedAt.getTime() + days * DAY_IN_MS);
    const created = await Subscription.create({
      userId: req.user._id,
      planId: process.env.DAYCARE_PLAN_ID || 'daycare-monthly',
      status: 'trialing',
      trialStartedAt,
      trialEndsAt,
      trialUsed: true,
      currentPeriodStart: trialStartedAt,
      currentPeriodEnd: trialEndsAt
    });
    return res.status(201).json({
      success: true,
      data: { subscription: created, trialDurationDays: days }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A trial or subscription has already been created for this account.' });
    }
    return res.status(500).json({ success: false, message: 'Could not start the free trial.' });
  }
};

exports.activateSubscriptionForInvoice = async (invoice) => {
  if (!invoice?.subscriptionId || !invoice?.billingPeriodStart || !invoice?.billingPeriodEnd) return;
  await Subscription.findOneAndUpdate(
    { _id: invoice.subscriptionId, userId: invoice.parent?._id || invoice.parent },
    {
      $set: {
        status: 'active',
        trialUsed: true,
        currentPeriodStart: invoice.billingPeriodStart,
        currentPeriodEnd: invoice.billingPeriodEnd
      }
    }
  );
};

exports.createOrGetTrialInvoice = createOrGetTrialInvoice;

exports.processExpiredTrials = async () => {
  const expiredTrials = await Subscription.find({
    status: 'trialing',
    trialEndsAt: { $lte: new Date() }
  }).limit(100);
  let processed = 0;
  let failed = 0;

  for (const subscription of expiredTrials) {
    try {
      await ensureExpiredTrialInvoices(subscription);
      processed += 1;
    } catch (error) {
      failed += 1;
      console.error('Trial-expiry invoice generation failed:', error.message);
    }
  }
  return { processed, failed };
};
