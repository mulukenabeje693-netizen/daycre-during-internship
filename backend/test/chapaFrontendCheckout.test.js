const test = require('node:test');
const assert = require('node:assert/strict');

test('successful hosted checkout redirects to the HTTPS URL returned by Chapa', async () => {
  const { redirectToChapaCheckout } = await import('../../frontend/src/utils/chapaCheckout.js');
  let redirectedTo;
  redirectToChapaCheckout('https://checkout.chapa.co/checkout/session-1', {
    assign(url) {
      redirectedTo = url;
    }
  });

  assert.equal(redirectedTo, 'https://checkout.chapa.co/checkout/session-1');
});

test('checkout redirects reject URLs outside Chapa hosted checkout', async () => {
  const { getChapaCheckoutUrl } = await import('../../frontend/src/utils/chapaCheckout.js');
  assert.throws(
    () => getChapaCheckoutUrl('http://checkout.chapa.co/checkout/session-1'),
    /unexpected checkout address/
  );
  assert.throws(
    () => getChapaCheckoutUrl('https://attacker.example/checkout'),
    /unexpected checkout address/
  );
});

test('frontend validates references against Chapa’s 20-character limit', async () => {
  const { isValidChapaReference } = await import('../../frontend/src/utils/chapaReference.js');
  assert.equal(isValidChapaReference('MINT-123456789012345'), true);
  assert.equal(isValidChapaReference('MINT-reference-that-is-too-long'), false);
  assert.equal(isValidChapaReference(''), false);
});

test('frontend preserves a useful safe initialization error for the user', async () => {
  const { getChapaInitializationError } = await import('../../frontend/src/utils/chapaCheckout.js');
  assert.equal(
    getChapaInitializationError({ response: { data: { message: 'Reference must be at most 20 characters long.' } } }),
    'Reference must be at most 20 characters long.'
  );
  assert.equal(getChapaInitializationError({}), 'Payment initialization failed.');
});

test('Chapa return references route to the result page for server verification', async () => {
  const { getChapaReturnPath } = await import('../../frontend/src/utils/chapaCheckout.js');
  assert.equal(
    getChapaReturnPath('?tx_ref=MINT-test_reference'),
    '/dashboard/parent/payments/success?tx_ref=MINT-test_reference'
  );
  assert.equal(
    getChapaReturnPath('?trx_ref=MINT-old-name'),
    '/dashboard/parent/payments/success?tx_ref=MINT-old-name'
  );
  assert.equal(getChapaReturnPath('?status=success'), null);
});

test('Chapa return references are encoded and never treated as payment status', async () => {
  const { getChapaReturnPath } = await import('../../frontend/src/utils/chapaCheckout.js');
  assert.equal(
    getChapaReturnPath('?chapa_tx=MINT%26not-a-status'),
    '/dashboard/parent/payments/success?tx_ref=MINT%26not-a-status'
  );
});
