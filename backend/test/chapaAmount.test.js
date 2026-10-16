const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toEtbCents,
  getInvoiceBalanceCents,
  getAttemptProviderAmountCents,
  isProviderAmountCents,
  fromEtbCents
} = require('../utils/chapaAmount');

test('ETB whole-number amounts convert to integer cents without changing invoice units', () => {
  assert.equal(toEtbCents(75), 7500);
  assert.equal(toEtbCents('75.00'), 7500);
  assert.equal(toEtbCents(0.01), 1);
  assert.equal(fromEtbCents(7500), 75);
});

test('ETB decimal amounts are converted exactly to cents', () => {
  assert.equal(toEtbCents(75.25), 7525);
  assert.equal(toEtbCents('0.10'), 10);
  assert.equal(getInvoiceBalanceCents({
    amount: 75.25,
    amountPaid: 10.1,
    currency: 'ETB',
    status: 'pending'
  }), 6515);
});

test('ETB zero, negative, malformed, and more-than-two-decimal amounts are rejected', () => {
  for (const amount of [0, -1, '-0.01', 'invalid', '1.001', NaN, Infinity, null]) {
    assert.throws(() => toEtbCents(amount), { code: 'CHAPA_INVALID_AMOUNT' });
  }
});

test('invoice balance validates supported currency and nonnegative paid amount', () => {
  assert.throws(() => getInvoiceBalanceCents({
    amount: 10,
    amountPaid: 0,
    currency: 'USD',
    status: 'pending'
  }), { code: 'CHAPA_INVALID_AMOUNT' });
  assert.throws(() => getInvoiceBalanceCents({
    amount: 10,
    amountPaid: -1,
    currency: 'ETB',
    status: 'pending'
  }), { code: 'CHAPA_INVALID_AMOUNT' });
});

test('verification accepts only the expected whole number of provider cents', () => {
  const attempt = { amount: 75.25, providerAmountCents: 7525 };
  assert.equal(getAttemptProviderAmountCents(attempt), 7525);
  assert.equal(isProviderAmountCents('7525', 7525), true);
  assert.equal(isProviderAmountCents(7525, 7525), true);
  assert.equal(isProviderAmountCents('75.25', 7525), false);
  assert.equal(isProviderAmountCents(7526, 7525), false);
  assert.throws(() => getAttemptProviderAmountCents({
    amount: 75.25,
    providerAmountCents: 7524
  }), { code: 'CHAPA_INVALID_AMOUNT' });
});
