const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const {
  getTrialDurationDays,
  getMonthlyFee,
  getTrialEligibility,
  isInvoiceOwnedBy,
  buildTrialInvoiceFilter
} = require('../utils/subscriptionBilling');
const { assessChapaVerification } = require('../utils/chapaVerification');
const {
  activateSubscriptionForInvoice,
  createOrGetTrialInvoice
} = require('../controllers/subscriptionController');
const { getChapaSandboxInvoiceAmount } = require('../utils/chapaConfig');

test('trial duration defaults to 30 days and rejects invalid configuration', () => {
  const previous = process.env.FREE_TRIAL_DAYS;
  delete process.env.FREE_TRIAL_DAYS;
  assert.equal(getTrialDurationDays(), 30);
  process.env.FREE_TRIAL_DAYS = '0';
  assert.throws(getTrialDurationDays, /between 1 and 365/);
  if (previous === undefined) delete process.env.FREE_TRIAL_DAYS;
  else process.env.FREE_TRIAL_DAYS = previous;
});

test('trial eligibility requires an approved parent, an active child, and no prior subscription', () => {
  assert.equal(getTrialEligibility({
    role: 'parent',
    approvalStatus: 'approved',
    childCount: 1,
    subscription: null
  }).eligible, true);
  assert.equal(getTrialEligibility({
    role: 'parent',
    approvalStatus: 'pending',
    childCount: 1,
    subscription: null
  }).eligible, false);
  assert.equal(getTrialEligibility({
    role: 'parent',
    approvalStatus: 'approved',
    childCount: 0,
    subscription: null
  }).eligible, false);
  assert.equal(getTrialEligibility({
    role: 'parent',
    approvalStatus: 'approved',
    childCount: 1,
    subscription: { trialUsed: true }
  }).eligible, false);
});

test('monthly trial invoice key is stable and owned by the exact parent and child', () => {
  const periodStart = new Date('2026-11-15T12:00:00.000Z');
  const first = buildTrialInvoiceFilter({ parentId: 'parent-a', childId: 'child-a', billingPeriodStart: periodStart });
  const second = buildTrialInvoiceFilter({ parentId: 'parent-a', childId: 'child-a', billingPeriodStart: periodStart });
  assert.deepEqual(first, second);
  assert.equal(isInvoiceOwnedBy({ parent: 'parent-a' }, 'parent-a'), true);
  assert.equal(isInvoiceOwnedBy({ parent: 'parent-a' }, 'parent-b'), false);
});

test('trial-expiry invoice creation is idempotent for the same billing period', async () => {
  const parentId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const childId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const billingPeriodStart = new Date('2026-11-15T12:00:00.000Z');
  let invoice = null;
  let upsertCount = 0;
  const Payment = {
    async findOne() {
      return invoice;
    },
    async findOneAndUpdate(filter, update) {
      upsertCount += 1;
      invoice = { _id: 'invoice-test', ...filter, ...update.$setOnInsert };
      return invoice;
    }
  };
  const input = {
    Payment,
    Payment,
    parentId,
    childId,
    amount: 850,
    billingPeriodStart,
    billingPeriodEnd: new Date('2026-12-15T12:00:00.000Z')
  };
  const first = await createOrGetTrialInvoice(input);
  const second = await createOrGetTrialInvoice(input);
  assert.equal(first._id, second._id);
  assert.equal(upsertCount, 1);
});

test('paid invoices activate only the linked subscription for its parent', async t => {
  const subscriptionId = new mongoose.Types.ObjectId();
  const parentId = new mongoose.Types.ObjectId();
  const billingPeriodStart = new Date('2026-11-15T12:00:00.000Z');
  const billingPeriodEnd = new Date('2026-12-15T12:00:00.000Z');
  let update;
  t.mock.method(Subscription, 'findOneAndUpdate', async (filter, change) => {
    update = { filter, change };
  });

  await activateSubscriptionForInvoice({
    subscriptionId,
    parent: { _id: parentId },
    billingPeriodStart,
    billingPeriodEnd
  });

  assert.equal(String(update.filter._id), String(subscriptionId));
  assert.equal(String(update.filter.userId), String(parentId));
  assert.deepEqual(update.change.$set, {
    status: 'active',
    trialUsed: true,
    currentPeriodStart: billingPeriodStart,
    currentPeriodEnd: billingPeriodEnd
  });
});

test('Chapa verification rejects failure, mismatched amount, reference, or currency', () => {
  const expected = { txRef: 'tx-test', amount: 850 };
  assert.equal(assessChapaVerification({
    ...expected,
    responseData: { status: 'success', data: { status: 'failed', tx_ref: 'tx-test', amount: 850, currency: 'ETB' } }
  }).status, 'failed');
  assert.equal(assessChapaVerification({
    ...expected,
    responseData: { status: 'success', data: { status: 'success', tx_ref: 'other', amount: 850, currency: 'ETB' } }
  }).verified, false);
  assert.equal(assessChapaVerification({
    ...expected,
    responseData: { status: 'success', data: { status: 'success', tx_ref: 'tx-test', amount: 500, currency: 'ETB' } }
  }).verified, false);
  assert.equal(assessChapaVerification({
    ...expected,
    responseData: { status: 'success', data: { status: 'success', tx_ref: 'tx-test', amount: 850, currency: 'USD' } }
  }).verified, false);
  assert.equal(assessChapaVerification({
    ...expected,
    responseData: { status: 'success', data: { status: 'success', tx_ref: 'tx-test', amount: 850, currency: 'ETB' } }
  }).verified, true);
});

test('Chapa verification preserves pending, failed, and cancelled provider states', () => {
  for (const status of ['pending', 'failed', 'cancelled']) {
    const result = assessChapaVerification({
      txRef: 'tx-test',
      amount: 850,
      responseData: {
        status: 'success',
        data: { status, tx_ref: 'tx-test', amount: 850, currency: 'ETB' }
      }
    });
    assert.equal(result.verified, false);
    assert.equal(result.status, status);
  }
});

test('sandbox test invoices require explicit local configuration and a Chapa test key', () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_TEST_INVOICES: process.env.ALLOW_TEST_INVOICES,
    CHAPA_SECRET_KEY: process.env.CHAPA_SECRET_KEY,
    CHAPA_TEST_INVOICE_AMOUNT: process.env.CHAPA_TEST_INVOICE_AMOUNT
  };

  process.env.NODE_ENV = 'development';
  process.env.ALLOW_TEST_INVOICES = 'true';
  process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-example';
  process.env.CHAPA_TEST_INVOICE_AMOUNT = '100';
  assert.equal(getChapaSandboxInvoiceAmount(), 100);

  process.env.CHAPA_SECRET_KEY = 'CHASECK-example';
  assert.equal(getChapaSandboxInvoiceAmount(), null);
  process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-example';
  process.env.NODE_ENV = 'production';
  assert.equal(getChapaSandboxInvoiceAmount(), null);
  process.env.NODE_ENV = 'development';
  process.env.CHAPA_TEST_INVOICE_AMOUNT = '0';
  assert.equal(getChapaSandboxInvoiceAmount(), null);

  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('monthly fee must be explicitly configured before trial expiry invoicing', () => {
  const previous = process.env.DAYCARE_MONTHLY_FEE;
  delete process.env.DAYCARE_MONTHLY_FEE;
  assert.throws(getMonthlyFee, /Set DAYCARE_MONTHLY_FEE/);
  process.env.DAYCARE_MONTHLY_FEE = '850';
  assert.equal(getMonthlyFee(), 850);
  if (previous === undefined) delete process.env.DAYCARE_MONTHLY_FEE;
  else process.env.DAYCARE_MONTHLY_FEE = previous;
});
