const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_REQUEST_TIMEOUT_MS,
  CHAPA_REQUEST_TIMEOUT_MS,
  getRequestTimeoutMs
} = require('../utils/requestTimeout');

test('Chapa gateway routes get enough time for the configured provider timeout', () => {
  const chapaRoutes = [
    '/api/payments/abc123/chapa-prepare',
    '/api/payments/abc123/chapa-init',
    '/api/payments/chapa-verify',
    '/api/payments/initialize',
    '/api/payments/verify',
    '/api/payments/verify/transaction-ref',
    '/api/payments/chapa-webhook'
  ];

  for (const route of chapaRoutes) {
    assert.equal(getRequestTimeoutMs(route), CHAPA_REQUEST_TIMEOUT_MS, route);
  }
  assert.ok(CHAPA_REQUEST_TIMEOUT_MS > 30_000);
});

test('ordinary requests retain the existing request timeout', () => {
  assert.equal(getRequestTimeoutMs('/api/auth/login'), DEFAULT_REQUEST_TIMEOUT_MS);
  assert.equal(getRequestTimeoutMs('/api/payments/invoices'), DEFAULT_REQUEST_TIMEOUT_MS);
});

test('Chapa gateway route timeouts ignore query parameters', () => {
  assert.equal(
    getRequestTimeoutMs('/api/payments/verify?tx_ref=transaction-ref'),
    CHAPA_REQUEST_TIMEOUT_MS
  );
});
