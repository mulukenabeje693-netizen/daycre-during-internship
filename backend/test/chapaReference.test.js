const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CHAPA_REFERENCE_MAX_LENGTH,
  createChapaReference,
  isValidChapaReference
} = require('../utils/chapaReference');
const ChapaPayment = require('../models/ChapaPayment');

test('generated Chapa references are provider-compatible and unique across retries', () => {
  const references = new Set();
  for (let index = 0; index < 1000; index += 1) {
    const reference = createChapaReference();
    assert.ok(reference.length <= CHAPA_REFERENCE_MAX_LENGTH);
    assert.ok(isValidChapaReference(reference));
    assert.ok(reference.length > 0);
    assert.equal(references.has(reference), false);
    references.add(reference);
  }
});

test('Chapa reference validation rejects empty, malformed, and overlength references', () => {
  for (const reference of ['', 'MINT-', 'MINT-invalid-reference-too-long', 'BAD-prefix']) {
    assert.equal(isValidChapaReference(reference), false);
  }
});

test('ChapaPayment schema rejects references longer than the provider limit', () => {
  const payment = new ChapaPayment({
    parent: '507f1f77bcf86cd799439012',
    child: '507f1f77bcf86cd799439013',
    invoice: '507f1f77bcf86cd799439011',
    merchantReference: 'MINT-reference-that-is-over-20',
    amount: 10,
    currency: 'ETB',
    status: 'pending',
    mode: 'test'
  });
  const validationError = payment.validateSync();

  assert.ok(validationError.errors.merchantReference);
});
