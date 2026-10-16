const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-unit_test_key';
process.env.CHAPA_WEBHOOK_SECRET = 'unit_test_webhook_secret';
process.env.JWT_SECRET = 'unit_test_jwt_secret';
process.env.ONLINE_PAYMENTS_ENABLED = 'true';
process.env.FRONTEND_URL = 'https://parent.example.com';

const axios = require('axios');
const jwt = require('jsonwebtoken');
const ChapaPayment = require('../models/ChapaPayment');
const Payment = require('../models/Payment');
const SystemSetting = require('../models/SystemSetting');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const settingsRouter = require('../routes/settings');
const paymentsRouter = require('../routes/payments');
const {
  isChapaConfigured,
  isValidChapaBaseUrl
} = require('../utils/chapaConfig');
const { getChapaCallbackUrl, getChapaReturnUrl } = require('../utils/chapaCallbackUrl');
const { getSettings, setOnlinePayments } = require('../controllers/settingsController');
const {
  prepareChapaPayment,
  initializeChapaPayment,
  verifyChapaPayment,
  handleChapaWebhook,
  getPaymentHistory
} = require('../controllers/chapaPaymentController');

const queryStub = value => {
  const query = {
    populate() { return query; },
    select() { return query; },
    sort() { return query; },
    skip() { return query; },
    limit() { return query; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
  return query;
};

const responseStub = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  send(body) {
    this.body = body;
    return this;
  }
});

const invoice = () => ({
  _id: '507f1f77bcf86cd799439011',
  invoiceNumber: 'INV-10001',
  parent: { _id: '507f1f77bcf86cd799439012', fullName: 'Test Parent', email: 'parent@example.test' },
  child: { _id: '507f1f77bcf86cd799439013', firstName: 'Test', lastName: 'Child' },
  amount: 100,
  amountPaid: 25,
  currency: 'ETB',
  status: 'pending',
  chapaTxRef: 'MINT-test-reference',
  chapaAmount: 75,
  method: null
});

test('payment verification authentication rejects requests without a parent session', async () => {
  let nextCalled = false;
  const res = responseStub();
  await protect({ headers: {} }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(nextCalled, false);
});

test('new payment settings persist disabled by default', async t => {
  let createdSettings;
  t.mock.method(SystemSetting, 'findOne', async () => null);
  t.mock.method(SystemSetting, 'create', async values => {
    createdSettings = values;
    return { ...values };
  });
  const res = responseStub();

  await getSettings({}, res);

  assert.equal(res.statusCode, 200);
  assert.equal(createdSettings.isFreeMode, true);
  assert.equal(res.body.data.paymentSettingEnabled, false);
  assert.equal(res.body.data.onlinePaymentsEnabled, false);
});

test('legacy settings do not count as an explicit online payment opt-in', async t => {
  t.mock.method(SystemSetting, 'findOne', async () => ({ isFreeMode: false }));
  const res = responseStub();

  await getSettings({}, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.paymentSettingEnabled, false);
  assert.equal(res.body.data.onlinePaymentsEnabled, false);
});

test('online payment settings route restricts changes to administrators', () => {
  const settingsRoute = settingsRouter.stack.find(layer =>
    layer.route?.path === '/online-payments'
  );
  assert.ok(settingsRoute);
  assert.equal(settingsRoute.route.stack[0].handle.name, 'protect');

  const authorizeAdmin = settingsRoute.route.stack[1].handle;
  let nextCalled = false;
  const denied = responseStub();
  authorizeAdmin({ user: { role: 'parent' } }, denied, () => { nextCalled = true; });

  assert.equal(denied.statusCode, 403);
  assert.equal(nextCalled, false);

  const authorized = responseStub();
  authorizeAdmin({ user: { role: 'admin' } }, authorized, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('verification rate limiter returns a retry delay without sharing the payment-initiation bucket', async () => {
  const verifyRoute = paymentsRouter.stack.find(layer => layer.route?.path === '/verify');
  assert.ok(verifyRoute);
  const limiter = verifyRoute.route.stack[1].handle;
  const userId = `verification-rate-limit-test-${Date.now()}`;
  let nextCalls = 0;
  let limitedResponse;

  for (let requestNumber = 1; requestNumber <= 7; requestNumber += 1) {
    const headers = {};
    const res = {
      headersSent: false,
      setHeader(name, value) { headers[name.toLowerCase()] = value; },
      getHeader(name) { return headers[name.toLowerCase()]; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; limitedResponse = this; return this; }
    };
    await limiter({
      user: { _id: userId },
      ip: '127.0.0.1',
      method: 'POST',
      originalUrl: '/api/payments/verify',
      path: '/verify'
    }, res, () => { nextCalls += 1; });
  }

  assert.equal(nextCalls, 6);
  assert.equal(limitedResponse.statusCode, 429);
  assert.equal(limitedResponse.body.code, 'PAYMENT_RATE_LIMITED');
  assert.equal(limitedResponse.body.retryAfterSeconds, 60);
  assert.equal(limitedResponse.getHeader('Retry-After'), '60');
});

test('parent checkout route uses the v2 Chapa initializer for the frontend invoice endpoint', () => {
  const initializeRoute = paymentsRouter.stack.find(layer =>
    layer.route?.path === '/:id/chapa-init'
  );

  assert.ok(initializeRoute);
  assert.equal(initializeRoute.route.methods.post, true);
  assert.equal(initializeRoute.route.stack.at(-1).handle, initializeChapaPayment);
});

test('Chapa callback URL accepts a trimmed public HTTPS webhook URL and requires the webhook secret', () => {
  const callback = '  https://payments.example.com/api/payments/chapa-webhook  ';

  assert.equal(
    getChapaCallbackUrl(callback, ' signing-secret '),
    'https://payments.example.com/api/payments/chapa-webhook'
  );
  assert.throws(
    () => getChapaCallbackUrl(callback, '  '),
    error => error.code === 'CHAPA_WEBHOOK_SECRET_MISSING'
  );
});

test('Chapa callback can be omitted with or without a webhook secret', () => {
  assert.equal(getChapaCallbackUrl('', ''), null);
  assert.equal(getChapaCallbackUrl('  ', 'signing-secret'), null);
});

test('Chapa callback rejects malformed URLs, embedded whitespace, non-HTTPS URLs, and localhost', () => {
  const invalidCallbacks = [
    'https://[broken/api/payments/chapa-webhook',
    'https://payments. example.com/api/payments/chapa-webhook',
    'http://payments.example.com/api/payments/chapa-webhook',
    'https://localhost/api/payments/chapa-webhook',
    'https://127.0.0.1/api/payments/chapa-webhook',
    'https://service.internal/api/payments/chapa-webhook'
  ];

  for (const callback of invalidCallbacks) {
    assert.throws(
      () => getChapaCallbackUrl(callback, 'signing-secret'),
      error => error.code === 'CHAPA_CALLBACK_URL_INVALID',
      callback
    );
  }
});

test('Chapa callback rejects the wrong path, credentials, and URL fragments', () => {
  const invalidCallbacks = [
    'https://payments.example.com/api/payments/callback',
    'https://user:password@payments.example.com/api/payments/chapa-webhook',
    'https://payments.example.com/api/payments/chapa-webhook#fragment'
  ];

  for (const callback of invalidCallbacks) {
    assert.throws(
      () => getChapaCallbackUrl(callback, 'signing-secret'),
      error => error.code === 'CHAPA_CALLBACK_URL_INVALID',
      callback
    );
  }
});

test('Chapa return URL uses the public frontend callback route and transaction reference', () => {
  assert.equal(
    getChapaReturnUrl(
      '  https://parent.example.com/dashboard/parent/payments/success  ',
      'MINT-test'
    ),
    'https://parent.example.com/dashboard/parent/payments/success?tx_ref=MINT-test'
  );
  assert.equal(
    getChapaReturnUrl(undefined, 'MINT-default'),
    'https://parent.example.com/dashboard/parent/payments/success?tx_ref=MINT-default'
  );
});

test('Chapa return URL rejects HTTP, localhost, credentials, and non-callback values', () => {
  const invalidReturnUrls = [
    'http://parent.example.com',
    'https://localhost:3000',
    'https://127.0.0.1',
    'https://user:password@parent.example.com',
    'https://parent.example.com/dashboard',
    'https://parent.example.com?next=/dashboard',
    'https://parent.example.com#success'
  ];

  for (const returnUrl of invalidReturnUrls) {
    assert.throws(
      () => getChapaReturnUrl(returnUrl),
      error => error.code === 'CHAPA_RETURN_URL_INVALID',
      returnUrl
    );
  }
});

test('Chapa return URL rejects invalid frontend origins with an actionable error', t => {
  const previousFrontendUrl = process.env.FRONTEND_URL;
  t.after(() => {
    if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontendUrl;
  });

  for (const frontendUrl of [
    'http://localhost:3000',
    'https://localhost:3000',
    'https://parent.example.com/dashboard',
    'https://parent.example.com?next=/dashboard'
  ]) {
    process.env.FRONTEND_URL = frontendUrl;
    assert.throws(
      () => getChapaReturnUrl(),
      error => error.code === 'CHAPA_RETURN_URL_INVALID' &&
        /public HTTPS frontend origin only/.test(error.message),
      frontendUrl
    );
  }
});

test('Chapa configuration rejects sample credentials and non-official API hosts', async t => {
  const originalSecretKey = process.env.CHAPA_SECRET_KEY;
  const originalBaseUrl = process.env.CHAPA_BASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  t.after(() => {
    process.env.CHAPA_SECRET_KEY = originalSecretKey;
    if (originalBaseUrl === undefined) delete process.env.CHAPA_BASE_URL;
    else process.env.CHAPA_BASE_URL = originalBaseUrl;
    process.env.NODE_ENV = originalNodeEnv;
  });

  process.env.NODE_ENV = 'development';
  process.env.CHAPA_SECRET_KEY = 'CHAPA_TEST_replace_with_test_secret_key';
  delete process.env.CHAPA_BASE_URL;
  assert.equal(isChapaConfigured(), false);
  assert.equal(isValidChapaBaseUrl(), true);

  process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-configured_test_key';
  process.env.CHAPA_BASE_URL = 'https://attacker.example/v2';
  assert.equal(isChapaConfigured(), false);
  assert.equal(isValidChapaBaseUrl(), false);
});

test('an administrator can disable persisted payments even if backend checkout gates are off', async t => {
  const previousOnlinePayments = process.env.ONLINE_PAYMENTS_ENABLED;
  const previousSecretKey = process.env.CHAPA_SECRET_KEY;
  process.env.ONLINE_PAYMENTS_ENABLED = 'false';
  delete process.env.CHAPA_SECRET_KEY;
  t.after(() => {
    process.env.ONLINE_PAYMENTS_ENABLED = previousOnlinePayments;
    process.env.CHAPA_SECRET_KEY = previousSecretKey;
  });
  const settings = {
    isFreeMode: false,
    async save() {}
  };
  t.mock.method(SystemSetting, 'findOne', async () => settings);
  const res = responseStub();

  await setOnlinePayments({ body: { enabled: false } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(settings.isFreeMode, true);
  assert.equal(res.body.data.paymentSettingEnabled, false);
  assert.equal(res.body.data.onlinePaymentsEnabled, false);
});

test('enabling checkout is rejected when the backend runtime safety gate is off', async t => {
  const previousOnlinePayments = process.env.ONLINE_PAYMENTS_ENABLED;
  process.env.ONLINE_PAYMENTS_ENABLED = 'false';
  t.after(() => { process.env.ONLINE_PAYMENTS_ENABLED = previousOnlinePayments; });
  const settingLookup = t.mock.method(SystemSetting, 'findOne', async () => {
    throw new Error('Checkout must be gated before settings can be changed.');
  });
  const res = responseStub();

  await setOnlinePayments({ body: { enabled: true } }, res);

  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /ONLINE_PAYMENTS_ENABLED=true/);
  assert.equal(settingLookup.mock.callCount(), 0);
});

test('authentication database failures return a retryable service error rather than invalidating a parent token', async t => {
  const token = jwt.sign({ id: '507f1f77bcf86cd799439012' }, process.env.JWT_SECRET);
  t.mock.method(User, 'findById', () => ({
    select() {
      return {
        lean: async () => { throw new Error('Database temporarily unavailable.'); }
      };
    }
  }));
  let nextCalled = false;
  const res = responseStub();

  await protect({
    headers: { authorization: `Bearer ${token}` }
  }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'AUTH_SERVICE_UNAVAILABLE');
  assert.equal(nextCalled, false);
});

test('verification rejects malformed references before querying payment records', async t => {
  const lookup = t.mock.method(ChapaPayment, 'findOne', async () => {
    throw new Error('Malformed references must not reach the database.');
  });
  const res = responseStub();

  await verifyChapaPayment({
    body: { txRef: 'https://attacker.example/transaction' },
    user: { _id: '507f1f77bcf86cd799439012', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(lookup.mock.callCount(), 0);
});

test('preparing a Chapa checkout stores a unique parent-child-invoice transaction using the DB balance', async t => {
  const savedInvoice = invoice();
  const previousWebhookSecret = process.env.CHAPA_WEBHOOK_SECRET;
  delete process.env.CHAPA_WEBHOOK_SECRET;
  t.after(() => {
    if (previousWebhookSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = previousWebhookSecret;
  });
  let created;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(ChapaPayment, 'findOne', async () => null);
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'create', async values => {
    created = values;
    return { ...values, _id: 'attempt-1' };
  });
  const res = responseStub();

  await prepareChapaPayment({
    params: { id: savedInvoice._id },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(created.parent, savedInvoice.parent._id);
  assert.equal(created.child, savedInvoice.child._id);
  assert.equal(created.invoice, savedInvoice._id);
  assert.equal(created.amount, 75);
  assert.equal(created.providerAmountCents, 7500);
  assert.equal(created.currency, 'ETB');
  assert.equal(created.status, 'pending');
  assert.equal(created.mode, 'test');
  assert.match(created.merchantReference, /^MINT-[A-Za-z0-9_-]{1,15}$/);
  assert.ok(created.merchantReference.length <= 20);
  assert.equal(res.body.amount, 75);
});

test('preparing checkout rejects invalid ETB amounts and unsupported currency before creating an attempt', async t => {
  let savedInvoice = invoice();
  let createCalls = 0;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(ChapaPayment, 'findOne', async () => null);
  t.mock.method(ChapaPayment, 'create', async () => {
    createCalls += 1;
    return {};
  });

  for (const amount of [0, -1, 'invalid', '75.251', NaN]) {
    savedInvoice = { ...invoice(), amount, amountPaid: 0 };
    const res = responseStub();
    await prepareChapaPayment({
      params: { id: savedInvoice._id },
      user: { _id: savedInvoice.parent._id, role: 'parent' }
    }, res);
    assert.equal(res.statusCode, 400, `amount ${String(amount)} should be rejected`);
  }

  savedInvoice = { ...invoice(), currency: 'USD' };
  const currencyResponse = responseStub();
  await prepareChapaPayment({
    params: { id: savedInvoice._id },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, currencyResponse);

  assert.equal(currencyResponse.statusCode, 400);
  assert.equal(createCalls, 0);
});

test('preparing checkout expires an old oversized active reference and preserves invoice-parent mapping', async t => {
  const savedInvoice = invoice();
  const oldAttempt = {
    _id: 'attempt-old-reference',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    activeInvoice: savedInvoice._id,
    merchantReference: 'MINT-old-reference-is-too-long',
    amount: 75,
    providerAmountCents: 7500,
    currency: 'ETB',
    status: 'pending',
    mode: 'test'
  };
  let created;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'findOne', async () => oldAttempt);
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(oldAttempt, update.$set || {});
    for (const key of Object.keys(update.$unset || {})) delete oldAttempt[key];
    return oldAttempt;
  });
  t.mock.method(ChapaPayment, 'create', async values => {
    created = values;
    return { ...values, _id: 'attempt-new-reference' };
  });
  const res = responseStub();

  await prepareChapaPayment({
    params: { id: savedInvoice._id },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(oldAttempt.status, 'expired');
  assert.equal(oldAttempt.activeInvoice, undefined);
  assert.ok(created.merchantReference.length <= 20);
  assert.notEqual(created.merchantReference, oldAttempt.merchantReference);
  assert.equal(created.invoice, savedInvoice._id);
  assert.equal(created.parent, savedInvoice.parent._id);
  assert.equal(res.body.invoiceId, savedInvoice._id);
  assert.equal(res.body.txRef, created.merchantReference);
});

test('preparing checkout replaces a previously failed invoice reference with a fresh attempt', async t => {
  const savedInvoice = {
    ...invoice(),
    chapaTxRef: 'MINT-failed-retry',
    chapaAmount: 75,
    chapaStatus: 'failed',
    chapaCheckoutUrl: null
  };
  const failedAttempt = {
    _id: 'attempt-failed-before-retry',
    merchantReference: savedInvoice.chapaTxRef,
    invoice: savedInvoice._id,
    activeInvoice: savedInvoice._id,
    status: 'failed',
    amount: 75,
    currency: 'ETB',
    mode: 'test'
  };
  const attempts = [failedAttempt];
  let created;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(ChapaPayment, 'findOne', async filter => {
    assert.deepEqual(filter, { activeInvoice: savedInvoice._id });
    return attempts.find(attempt => String(attempt.activeInvoice) === String(filter.activeInvoice)) || null;
  });
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(failedAttempt, update.$set || {});
    for (const key of Object.keys(update.$unset || {})) delete failedAttempt[key];
    return failedAttempt;
  });
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'create', async values => {
    created = { ...values, _id: 'attempt-retry' };
    attempts.push(created);
    return created;
  });
  const res = responseStub();

  await prepareChapaPayment({
    params: { id: savedInvoice._id },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.notEqual(res.body.txRef, savedInvoice.chapaTxRef);
  assert.notEqual(created.merchantReference, failedAttempt.merchantReference);
  assert.equal(created.amount, 75);
  assert.equal(created.invoice, savedInvoice._id);
  assert.equal(failedAttempt.status, 'failed');
  assert.equal(failedAttempt.activeInvoice, undefined);
  assert.equal(attempts.length, 2);
});

test('initialization rejects an overlength merchant reference before looking up or sending it to Chapa', async t => {
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  const attemptLookup = t.mock.method(ChapaPayment, 'findOne', async () => {
    throw new Error('Invalid reference must be rejected before database lookup.');
  });
  const providerRequest = t.mock.method(axios, 'post', async () => {
    throw new Error('Invalid reference must never be sent to Chapa.');
  });
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: 'MINT-reference-that-is-over-20' },
    user: { _id: '507f1f77bcf86cd799439012', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /20 characters/);
  assert.equal(attemptLookup.mock.callCount(), 0);
  assert.equal(providerRequest.mock.callCount(), 0);
});

test('preparing checkout verifies an old hosted checkout and creates a new reference only after Chapa confirms expiry', async t => {
  const savedInvoice = invoice();
  const expiredAttempt = {
    _id: 'attempt-expired',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    activeInvoice: savedInvoice._id,
    merchantReference: 'MINT-expired-01',
    chapaReference: 'CHAPA-EXPIRED-1',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: 'https://checkout.chapa.co/checkout/expired',
    initializedAt: new Date()
  };
  savedInvoice.chapaTxRef = expiredAttempt.merchantReference;
  let createdAttempt;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'findOne', async () => expiredAttempt);
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(expiredAttempt, update.$set);
    for (const key of Object.keys(update.$unset || {})) delete expiredAttempt[key];
    return expiredAttempt;
  });
  t.mock.method(ChapaPayment, 'create', async values => {
    createdAttempt = { ...values, _id: 'attempt-retry' };
    return createdAttempt;
  });
  t.mock.method(axios, 'get', async url => {
    assert.equal(
      url,
      `https://api.chapa.global/v2/payments/${expiredAttempt.chapaReference}/verify`
    );
    return {
      data: {
        status: 'success',
        data: {
          status: 'expired',
          tx_ref: expiredAttempt.merchantReference,
          amount: '7500',
          currency: 'ETB'
        }
      }
    };
  });
  const res = responseStub();

  await prepareChapaPayment({
    params: { id: savedInvoice._id },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(expiredAttempt.status, 'expired');
  assert.equal(expiredAttempt.activeInvoice, undefined);
  assert.equal(expiredAttempt.checkoutUrl, undefined);
  assert.notEqual(createdAttempt.merchantReference, expiredAttempt.merchantReference);
  assert.equal(res.body.txRef, createdAttempt.merchantReference);
  assert.equal(res.body.checkoutUrl, undefined);
});

test('preparing checkout releases an unverified attempt only after Chapa confirms it expired', async t => {
  const savedInvoice = invoice();
  const oldAttempt = {
    _id: 'attempt-unverified-expired',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    activeInvoice: savedInvoice._id,
    merchantReference: 'MINT-unver-exp01',
    chapaReference: 'CHAPA-UNVERIFIED-EXPIRED',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'unverified',
    checkoutUrl: 'https://checkout.chapa.co/checkout/old',
    initializedAt: new Date()
  };
  savedInvoice.chapaTxRef = oldAttempt.merchantReference;
  let createdAttempt;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'findOne', async () => oldAttempt);
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(oldAttempt, update.$set);
    for (const key of Object.keys(update.$unset || {})) delete oldAttempt[key];
    return oldAttempt;
  });
  t.mock.method(ChapaPayment, 'create', async values => {
    createdAttempt = { ...values, _id: 'attempt-after-expiry' };
    return createdAttempt;
  });
  t.mock.method(axios, 'get', async () => ({
    data: {
      status: 'success',
      data: {
        status: 'expired',
        tx_ref: oldAttempt.merchantReference,
        amount: '7500',
        currency: 'ETB'
      }
    }
  }));
  const res = responseStub();

  await prepareChapaPayment({
    params: { id: savedInvoice._id },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(oldAttempt.status, 'expired');
  assert.equal(oldAttempt.activeInvoice, undefined);
  assert.equal(oldAttempt.checkoutUrl, undefined);
  assert.notEqual(createdAttempt.merchantReference, oldAttempt.merchantReference);
  assert.equal(res.body.txRef, createdAttempt.merchantReference);
});

test('preparing checkout returns a clear error when Chapa credentials are missing', async t => {
  const previousSecretKey = process.env.CHAPA_SECRET_KEY;
  delete process.env.CHAPA_SECRET_KEY;
  t.after(() => {
    if (previousSecretKey === undefined) delete process.env.CHAPA_SECRET_KEY;
    else process.env.CHAPA_SECRET_KEY = previousSecretKey;
  });
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  const res = responseStub();

  await prepareChapaPayment({
    params: { id: '507f1f77bcf86cd799439011' },
    user: { _id: '507f1f77bcf86cd799439012', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /CHAPA_SECRET_KEY/i);
});

test('initialization uses Chapa v2 hosted checkout and never accepts a browser amount', async t => {
  const savedInvoice = { ...invoice(), amount: 100.25, chapaAmount: 75.25 };
  const previousCallbackUrl = process.env.CHAPA_CALLBACK_URL;
  const previousReturnUrl = process.env.CHAPA_RETURN_URL;
  const previousFrontendUrl = process.env.FRONTEND_URL;
  process.env.CHAPA_CALLBACK_URL = '  https://api.example.com/api/payments/chapa-webhook  ';
  process.env.CHAPA_RETURN_URL = '  https://parent.example.com/dashboard/parent/payments/success  ';
  process.env.FRONTEND_URL = 'https://parent.example.com';
  t.after(() => {
    if (previousCallbackUrl === undefined) delete process.env.CHAPA_CALLBACK_URL;
    else process.env.CHAPA_CALLBACK_URL = previousCallbackUrl;
    if (previousReturnUrl === undefined) delete process.env.CHAPA_RETURN_URL;
    else process.env.CHAPA_RETURN_URL = previousReturnUrl;
    if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontendUrl;
  });
  const attempt = {
    _id: 'attempt-1',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-test-reference',
    amount: 75.25,
    providerAmountCents: 7525,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: null
  };
  savedInvoice.chapaTxRef = attempt.merchantReference;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return attempt;
  });
  t.mock.method(ChapaPayment, 'updateOne', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return { modifiedCount: 1 };
  });
  t.mock.method(axios, 'post', async (url, payload, config) => {
    assert.equal(url, 'https://api.chapa.global/v2/payments/hosted');
    assert.equal(config.headers.Authorization, `Bearer ${process.env.CHAPA_SECRET_KEY}`);
    assert.equal(payload.amount, 7525);
    assert.equal(Number.isSafeInteger(payload.amount), true);
    assert.equal(payload.currency, 'ETB');
    assert.equal(payload.merchant_reference, attempt.merchantReference);
    assert.equal(payload.callback_url, 'https://api.example.com/api/payments/chapa-webhook');
    assert.equal(payload.customer.email, savedInvoice.parent.email);
    assert.equal(payload.customer.first_name, 'Test');
    assert.equal(payload.customer.last_name, 'Parent');
    assert.equal(payload.customer.phone_number, '+251912345678');
    assert.equal(payload.phone_number, '+251912345678');
    const returnUrl = new URL(payload.return_url);
    assert.equal(returnUrl.origin, 'https://parent.example.com');
    assert.equal(returnUrl.pathname, '/dashboard/parent/payments/success');
    assert.equal(returnUrl.searchParams.get('tx_ref'), attempt.merchantReference);
    assert.equal(payload.meta.invoice_id, savedInvoice._id);
    return {
      data: {
        status: 'success',
        data: {
          checkout_url: 'https://checkout.chapa.co/checkout/test',
          reference: 'CHAPA-REFERENCE-1'
        }
      }
    };
  });
  const res = responseStub();

  await initializeChapaPayment({
    params: { id: savedInvoice._id },
    body: { txRef: attempt.merchantReference, amount: 0.01, phone_number: '0912345678' },
    headers: { origin: 'http://localhost:5173' },
    user: { _id: savedInvoice.parent._id, role: 'parent', email: 'parent@example.test' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.checkoutUrl, 'https://checkout.chapa.co/checkout/test');
  assert.equal(attempt.chapaReference, 'CHAPA-REFERENCE-1');
  assert.equal(attempt.status, 'pending');
  assert.equal(attempt.invoice, savedInvoice._id);
  assert.equal(attempt.parent, savedInvoice.parent._id);
});

test('initialization refuses a localhost return URL before locking or contacting Chapa', async t => {
  const previousReturnUrl = process.env.CHAPA_RETURN_URL;
  const previousFrontendUrl = process.env.FRONTEND_URL;
  delete process.env.CHAPA_RETURN_URL;
  process.env.FRONTEND_URL = 'http://localhost:3000';
  t.after(() => {
    if (previousReturnUrl === undefined) delete process.env.CHAPA_RETURN_URL;
    else process.env.CHAPA_RETURN_URL = previousReturnUrl;
    if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontendUrl;
  });
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  const lookup = t.mock.method(ChapaPayment, 'findOne', async () => {
    throw new Error('Return URL configuration must be rejected before attempt lookup.');
  });
  const providerCall = t.mock.method(axios, 'post', async () => {
    throw new Error('An invalid return URL must never be sent to Chapa.');
  });
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: 'MINT-local-return' },
    headers: { origin: 'http://localhost:5173' },
    user: { _id: '507f1f77bcf86cd799439012', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'CHAPA_RETURN_URL_INVALID');
  assert.equal(lookup.mock.callCount(), 0);
  assert.equal(providerCall.mock.callCount(), 0);
});

test('initialization rejects an unsafe Chapa callback URL before contacting Chapa', async t => {
  const previousCallbackUrl = process.env.CHAPA_CALLBACK_URL;
  process.env.CHAPA_CALLBACK_URL = 'http://localhost:5000/api/payments/chapa-webhook';
  t.after(() => {
    if (previousCallbackUrl === undefined) delete process.env.CHAPA_CALLBACK_URL;
    else process.env.CHAPA_CALLBACK_URL = previousCallbackUrl;
  });
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  const providerCall = t.mock.method(axios, 'post', async () => {
    throw new Error('An unsafe callback URL must not be sent to Chapa.');
  });
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: 'MINT-test-reference' },
    user: { _id: '507f1f77bcf86cd799439012', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'CHAPA_CALLBACK_URL_INVALID');
  assert.equal(providerCall.mock.callCount(), 0);
});

test('initialization rejects a public HTTPS callback URL that is not the webhook endpoint', async t => {
  const previousCallbackUrl = process.env.CHAPA_CALLBACK_URL;
  process.env.CHAPA_CALLBACK_URL = 'https://api.example.com/api/payments/callback';
  t.after(() => {
    if (previousCallbackUrl === undefined) delete process.env.CHAPA_CALLBACK_URL;
    else process.env.CHAPA_CALLBACK_URL = previousCallbackUrl;
  });
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  const providerCall = t.mock.method(axios, 'post', async () => {
    throw new Error('A URL that is not the webhook route must not be sent to Chapa.');
  });
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: 'MINT-invalidroute01' },
    user: { _id: '507f1f77bcf86cd799439012', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'CHAPA_CALLBACK_URL_INVALID');
  assert.equal(providerCall.mock.callCount(), 0);
});

test('initialization rejects a callback URL without its webhook signing secret', async t => {
  const previousCallbackUrl = process.env.CHAPA_CALLBACK_URL;
  const previousWebhookSecret = process.env.CHAPA_WEBHOOK_SECRET;
  process.env.CHAPA_CALLBACK_URL = 'https://api.example.com/api/payments/chapa-webhook';
  delete process.env.CHAPA_WEBHOOK_SECRET;
  t.after(() => {
    if (previousCallbackUrl === undefined) delete process.env.CHAPA_CALLBACK_URL;
    else process.env.CHAPA_CALLBACK_URL = previousCallbackUrl;
    if (previousWebhookSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = previousWebhookSecret;
  });
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  const providerCall = t.mock.method(axios, 'post', async () => {
    throw new Error('A callback without signature verification must not be sent.');
  });
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: 'MINT-callback01' },
    user: { _id: '507f1f77bcf86cd799439012', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'CHAPA_WEBHOOK_SECRET_MISSING');
  assert.equal(providerCall.mock.callCount(), 0);
});

test('local initialization works without webhook settings when Chapa returns a verification reference', async t => {
  const savedInvoice = invoice();
  const previousCallbackUrl = process.env.CHAPA_CALLBACK_URL;
  const previousWebhookSecret = process.env.CHAPA_WEBHOOK_SECRET;
  delete process.env.CHAPA_CALLBACK_URL;
  delete process.env.CHAPA_WEBHOOK_SECRET;
  t.after(() => {
    if (previousCallbackUrl === undefined) delete process.env.CHAPA_CALLBACK_URL;
    else process.env.CHAPA_CALLBACK_URL = previousCallbackUrl;
    if (previousWebhookSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = previousWebhookSecret;
  });
  const attempt = {
    _id: 'attempt-local-return',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    activeInvoice: savedInvoice._id,
    merchantReference: 'MINT-local-return',
    amount: 75,
    providerAmountCents: 7500,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: null
  };
  savedInvoice.chapaTxRef = attempt.merchantReference;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return attempt;
  });
  t.mock.method(ChapaPayment, 'updateOne', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return { modifiedCount: 1 };
  });
  const providerCall = t.mock.method(axios, 'post', async (_url, payload) => {
    assert.equal(Object.hasOwn(payload, 'callback_url'), false);
    return {
      data: {
        status: 'success',
        data: {
          checkout_url: 'https://checkout.chapa.co/checkout/local-return',
          reference: 'CHAPA-LOCAL-REFERENCE'
        }
      }
    };
  });
  const res = responseStub();

  await initializeChapaPayment({
    params: { id: savedInvoice._id },
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent', email: 'parent@example.test' }
  }, res);

  assert.equal(providerCall.mock.callCount(), 1);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.checkoutUrl, 'https://checkout.chapa.co/checkout/local-return');
  assert.equal(attempt.chapaReference, 'CHAPA-LOCAL-REFERENCE');
  assert.equal(attempt.status, 'pending');
  assert.equal(savedInvoice.status, 'pending');
});

test('Chapa initialization rejects an invalid parent-supplied phone before contacting Chapa', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-invalid-phone',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-invalid-phone',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: null
  };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  const providerCall = t.mock.method(axios, 'post', async () => {
    throw new Error('Invalid phone numbers must not be sent to Chapa.');
  });
  const lockAttempt = t.mock.method(ChapaPayment, 'findOneAndUpdate', async () => {
    throw new Error('Invalid phone numbers must be rejected before checkout initialization.');
  });
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: attempt.merchantReference, phone_number: '12345' },
    user: { _id: savedInvoice.parent._id, role: 'parent', email: 'parent@example.test' }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /valid Ethiopian phone number/);
  assert.equal(providerCall.mock.callCount(), 0);
  assert.equal(lockAttempt.mock.callCount(), 0);
});

test('Chapa authorization failures do not become app authentication failures', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-unauthorized',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-auth-fail',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: null
  };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return attempt;
  });
  t.mock.method(ChapaPayment, 'updateOne', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return { modifiedCount: 1 };
  });
  const providerError = new Error('Provider authorization rejected.');
  providerError.isAxiosError = true;
  providerError.response = {
    status: 401,
    config: { url: 'https://api.chapa.global/v2/payments/hosted' },
    data: {
      status: 'error',
      code: 'invalid_api_key',
      message: 'Invalid credential CHAPA_TEST_PRIV_test-only-token',
      credential: 'must-not-be-logged'
    }
  };
  const providerLogs = [];
  t.mock.method(console, 'error', (...args) => providerLogs.push(args.join(' ')));
  t.mock.method(axios, 'post', async () => {
    throw providerError;
  });
  const res = responseStub();

  await initializeChapaPayment({
    params: { id: savedInvoice._id },
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent', email: 'parent@example.test' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'CHAPA_CREDENTIALS_REJECTED');
  assert.equal(res.body.status, 'initialization_failed');
  assert.equal(providerLogs.length, 1);
  assert.match(providerLogs[0], /"status":401/);
  assert.match(providerLogs[0], /https:\/\/api\.chapa\.global\/v2\/payments\/hosted/);
  assert.match(providerLogs[0], /invalid_api_key/);
  assert.match(providerLogs[0], /\[REDACTED\]/);
  assert.doesNotMatch(providerLogs[0], /test-only-token|must-not-be-logged/);
  assert.match(res.body.message, /Chapa rejected the server credentials.*test\/sandbox/i);
  assert.match(res.body.message, /merchant dashboard.*restart the backend/i);
  assert.match(res.body.message, /No payment was made/i);
  assert.equal(attempt.status, 'failed');
  assert.equal(savedInvoice.status, 'pending');
  assert.equal(Boolean(savedInvoice.receiptNumber), false);
});

test('Chapa DNS failures during initialization are explicit and keep the attempt processing', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-dns-initialization',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-dns-init',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: null
  };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return attempt;
  });
  t.mock.method(ChapaPayment, 'updateOne', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return { modifiedCount: 1 };
  });
  t.mock.method(axios, 'post', async () => {
    throw Object.assign(new Error('getaddrinfo ENOTFOUND api.chapa.global'), {
      isAxiosError: true,
      code: 'ENOTFOUND'
    });
  });
  const res = responseStub();

  await initializeChapaPayment({
    params: { id: savedInvoice._id },
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent', email: 'parent@example.test' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'CHAPA_DNS_ERROR');
  assert.equal(res.body.status, 'processing');
  assert.match(res.body.message, /official API hostname.*DNS/i);
  assert.match(res.body.message, /https:\/\/api\.chapa\.global\/v2/);
  assert.equal(attempt.status, 'processing');
  assert.equal(savedInvoice.status, 'pending');
  assert.equal(Boolean(savedInvoice.receiptNumber), false);
});

test('a rejected Chapa initialization returns its safe provider reason and keeps the invoice unpaid', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-provider-rejection',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-provider-rej',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: null
  };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return attempt;
  });
  t.mock.method(ChapaPayment, 'updateOne', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return { modifiedCount: 1 };
  });
  const providerError = new Error('Chapa rejected checkout fields.');
  providerError.isAxiosError = true;
  providerError.response = {
    status: 400,
    data: {
      status: 'error',
      message: 'Callback URL must start with https:// and be a valid URL'
    }
  };
  t.mock.method(axios, 'post', async () => { throw providerError; });
  const res = responseStub();

  await initializeChapaPayment({
    params: { id: savedInvoice._id },
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent', email: 'parent@example.test' }
  }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, 'CHAPA_INITIALIZATION_FAILED');
  assert.equal(
    res.body.message,
    'Callback URL must start with https:// and be a valid URL'
  );
  assert.equal(attempt.status, 'failed');
  assert.equal(savedInvoice.status, 'pending');
  assert.equal(Boolean(savedInvoice.receiptNumber), false);
});

test('initialization does not issue checkout without a provider reference or callback URL', async t => {
  const savedInvoice = invoice();
  const previousCallbackUrl = process.env.CHAPA_CALLBACK_URL;
  delete process.env.CHAPA_CALLBACK_URL;
  t.after(() => {
    if (previousCallbackUrl === undefined) delete process.env.CHAPA_CALLBACK_URL;
    else process.env.CHAPA_CALLBACK_URL = previousCallbackUrl;
  });
  const attempt = {
    _id: 'attempt-reference-unavailable',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    activeInvoice: savedInvoice._id,
    merchantReference: 'MINT-ref-unavail',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: null
  };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return attempt;
  });
  t.mock.method(ChapaPayment, 'updateOne', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return { modifiedCount: 1 };
  });
  t.mock.method(axios, 'post', async () => ({
    data: {
      status: 'success',
      data: { checkout_url: 'https://checkout.chapa.co/checkout/test' }
    }
  }));
  const res = responseStub();

  await initializeChapaPayment({
    params: { id: savedInvoice._id },
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent', email: 'parent@example.test' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'CHAPA_REFERENCE_UNAVAILABLE');
  assert.equal(res.body.checkoutUrl, undefined);
  assert.equal(attempt.status, 'unverified');
  assert.equal(savedInvoice.status, 'pending');
});

test('initialization retains an accepted transaction without inventing a missing checkout URL', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-no-url',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    activeInvoice: savedInvoice._id,
    merchantReference: 'MINT-test-no-url',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: null
  };
  savedInvoice.chapaTxRef = attempt.merchantReference;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return attempt;
  });
  t.mock.method(ChapaPayment, 'updateOne', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return { modifiedCount: 1 };
  });
  const providerCall = t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 'success', data: { reference: 'CHAPA-REFERENCE-NO-URL' } }
  }));
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent', email: 'parent@example.test' }
  }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'CHAPA_CHECKOUT_UNAVAILABLE');
  assert.equal(res.body.status, 'pending');
  assert.equal(res.body.txRef, attempt.merchantReference);
  assert.equal(res.body.checkoutUrl, undefined);
  assert.equal(attempt.status, 'unverified');
  assert.equal(attempt.activeInvoice, savedInvoice._id);
  assert.equal(attempt.chapaReference, 'CHAPA-REFERENCE-NO-URL');
  assert.equal(savedInvoice.status, 'pending');
  assert.equal(Boolean(savedInvoice.receiptNumber), false);

  t.mock.method(axios, 'get', async () => ({
    data: {
      status: 'success',
      data: {
        status: 'pending',
        merchant_reference: attempt.merchantReference,
        reference: attempt.chapaReference,
        amount: '7500',
        currency: 'ETB'
      }
    }
  }));
  const retryRes = responseStub();
  await initializeChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent', email: 'parent@example.test' }
  }, retryRes);

  assert.equal(retryRes.statusCode, 409);
  assert.equal(retryRes.body.code, 'CHAPA_TRANSACTION_PENDING');
  assert.equal(providerCall.mock.callCount(), 1);
});

test('pending initialization lock prevents a duplicate provider request', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-processing',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-test-processing',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'processing',
    checkoutUrl: null,
    initializationStartedAt: new Date()
  };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async () => null);
  const providerCall = t.mock.method(axios, 'post', async () => {
    throw new Error('An active initialization must not be duplicated.');
  });
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.status, 'processing');
  assert.equal(providerCall.mock.callCount(), 0);
});

test('initialization verifies an existing checkout and does not reuse it when Chapa still reports pending', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-1',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-test-reference',
    chapaReference: 'CHAPA-REFERENCE-1',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: 'https://checkout.chapa.global/payment/existing'
  };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return attempt;
  });
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  const providerCall = t.mock.method(axios, 'post', async () => {
    throw new Error('An existing transaction must not be initialized again.');
  });
  const verificationCall = t.mock.method(axios, 'get', async url => {
    assert.equal(
      url,
      `https://api.chapa.global/v2/payments/${attempt.chapaReference}/verify`
    );
    return {
      data: {
        status: 'success',
        data: {
          status: 'pending',
          tx_ref: attempt.merchantReference,
          amount: '7500',
          currency: 'ETB'
        }
      }
    };
  });
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'CHAPA_TRANSACTION_PENDING');
  assert.equal(res.body.txRef, attempt.merchantReference);
  assert.equal(res.body.checkoutUrl, undefined);
  assert.equal(verificationCall.mock.callCount(), 1);
  assert.equal(providerCall.mock.callCount(), 0);
});

test('initialization reconciles a previously paid checkout instead of reopening it', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-paid',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-already-paid',
    chapaReference: 'CHAPA-PAID-1',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: 'https://checkout.chapa.co/checkout/processed',
    initializedAt: new Date()
  };
  savedInvoice.chapaTxRef = attempt.merchantReference;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return attempt;
  });
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(savedInvoice, update.$set);
    return savedInvoice;
  });
  const verificationCall = t.mock.method(axios, 'get', async () => ({
    data: {
      status: 'success',
      data: {
        status: 'success',
        tx_ref: attempt.merchantReference,
        chapa_reference: 'CHAPA-PAID-1',
        amount: '7500',
        currency: 'ETB'
      }
    }
  }));
  const initializationCall = t.mock.method(axios, 'post', async () => {
    throw new Error('A settled Chapa transaction must not be initialized again.');
  });
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.alreadyPaid, true);
  assert.equal(savedInvoice.status, 'paid');
  assert.equal(savedInvoice.chapaTxRef, attempt.merchantReference);
  assert.equal(attempt.status, 'success');
  assert.ok(attempt.receiptNumber);
  assert.equal(verificationCall.mock.callCount(), 1);
  assert.equal(initializationCall.mock.callCount(), 0);
});

test('preparing an existing checkout keeps its active attempt when provider verification is unavailable', async t => {
  const savedInvoice = invoice();
  const activeAttempt = {
    _id: 'attempt-uncertain',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    activeInvoice: savedInvoice._id,
    merchantReference: 'MINT-uncertain',
    chapaReference: 'CHAPA-UNCERTAIN-1',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: 'https://checkout.chapa.co/checkout/uncertain',
    initializedAt: new Date()
  };
  savedInvoice.chapaTxRef = activeAttempt.merchantReference;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(ChapaPayment, 'findOne', async () => activeAttempt);
  const createAttempt = t.mock.method(ChapaPayment, 'create', async () => {
    throw new Error('An uncertain transaction must keep its active slot.');
  });
  const providerError = new Error('Provider timeout.');
  providerError.code = 'ECONNABORTED';
  providerError.isAxiosError = true;
  t.mock.method(axios, 'get', async () => { throw providerError; });
  const res = responseStub();

  await prepareChapaPayment({
    params: { id: savedInvoice._id },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'CHAPA_VERIFICATION_UNAVAILABLE');
  assert.equal(activeAttempt.status, 'pending');
  assert.equal(activeAttempt.activeInvoice, savedInvoice._id);
  assert.equal(createAttempt.mock.callCount(), 0);
});

test('initialization never reuses a checkout URL after the attempt is terminal', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-failed',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-terminal',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'failed',
    checkoutUrl: 'https://checkout.chapa.global/payment/failed'
  };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  const providerCall = t.mock.method(axios, 'post', async () => {
    throw new Error('A failed checkout must not be initialized again.');
  });
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.status, 'failed');
  assert.equal(res.body.checkoutUrl, undefined);
  assert.equal(providerCall.mock.callCount(), 0);
});

test('initialization verifies an unverified attempt and never restarts it after Chapa confirms expiry', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-unverified',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    activeInvoice: savedInvoice._id,
    merchantReference: 'MINT-unverified',
    chapaReference: 'CHAPA-UNVERIFIED-1',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'unverified',
    checkoutUrl: 'https://checkout.chapa.co/checkout/old',
    initializedAt: new Date()
  };
  savedInvoice.chapaTxRef = attempt.merchantReference;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    for (const key of Object.keys(update.$unset || {})) delete attempt[key];
    return attempt;
  });
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(axios, 'get', async () => ({
    data: {
      status: 'success',
      data: {
        status: 'expired',
        tx_ref: attempt.merchantReference,
        amount: '7500',
        currency: 'ETB'
      }
    }
  }));
  const providerInitialization = t.mock.method(axios, 'post', async () => {
    throw new Error('The expired reference must not be initialized again.');
  });
  const res = responseStub();

  await initializeChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'CHAPA_TRANSACTION_TERMINAL');
  assert.equal(attempt.status, 'expired');
  assert.equal(attempt.activeInvoice, undefined);
  assert.equal(attempt.checkoutUrl, undefined);
  assert.equal(providerInitialization.mock.callCount(), 0);
});

test('verification waits for Chapa reference instead of querying with the merchant reference', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-without-provider-reference',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-ref-pending',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending'
  };
  savedInvoice.chapaTxRef = attempt.merchantReference;
  savedInvoice.chapaAmount = attempt.amount;
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  const providerCall = t.mock.method(axios, 'get', async () => {
    throw new Error('Verification must use the Chapa-issued reference only.');
  });
  const res = responseStub();

  await verifyChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'CHAPA_REFERENCE_PENDING');
  assert.equal(res.body.status, 'pending');
  assert.equal(providerCall.mock.callCount(), 0);
  assert.equal(savedInvoice.status, 'pending');
});

test('successful Chapa v2 verification matches both references, amount and currency before settling', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-1',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-test-reference',
    chapaReference: 'CHAPA-REFERENCE-1',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending',
    checkoutUrl: 'https://checkout.chapa.co/checkout/processed'
  };
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    for (const key of Object.keys(update.$unset || {})) delete attempt[key];
    return attempt;
  });
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(savedInvoice, update.$set);
    return savedInvoice;
  });
  t.mock.method(axios, 'get', async (url, config) => {
    assert.equal(
      url,
      `https://api.chapa.global/v2/payments/${attempt.chapaReference}/verify`
    );
    assert.equal(config.headers.Authorization, `Bearer ${process.env.CHAPA_SECRET_KEY}`);
    return {
      data: {
        status: 'success',
        data: {
          status: 'success',
          merchant_reference: attempt.merchantReference,
          chapa_reference: attempt.chapaReference,
          amount: '7500',
          currency: 'ETB',
          payment_method: 'telebirr',
          updated_at: '2026-10-13T10:00:00.000Z'
        }
      }
    };
  });
  const res = responseStub();

  await verifyChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(savedInvoice.status, 'paid');
  assert.equal(savedInvoice.amountPaid, 100);
  assert.equal(savedInvoice.method, 'chapa');
  assert.equal(savedInvoice.chapaTxRef, attempt.merchantReference);
  assert.equal(attempt.status, 'success');
  assert.equal(attempt.checkoutUrl, undefined);
  assert.equal(attempt.chapaReference, 'CHAPA-REFERENCE-1');
  assert.ok(attempt.receiptNumber);
  assert.ok(attempt.verifiedAt);
  assert.equal(res.body.data.receiptNumber, attempt.receiptNumber);
});

test('concurrent successful verification returns the persisted receipt instead of a stale conflict', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-concurrent-verification',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-concurrent',
    chapaReference: 'CHAPA-CONCURRENT-1',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending'
  };
  savedInvoice.chapaTxRef = attempt.merchantReference;
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(ChapaPayment, 'findById', async () => attempt);
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    Object.assign(attempt, { status: 'success', receiptNumber: 'RCT-CONCURRENT-1', verifiedAt: new Date() });
    return null;
  });
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(savedInvoice, update.$set);
    return null;
  });
  t.mock.method(axios, 'get', async () => ({
    data: {
      status: 'success',
      data: {
        status: 'success',
        merchant_reference: attempt.merchantReference,
        chapa_reference: attempt.chapaReference,
        amount: '7500',
        currency: 'ETB'
      }
    }
  }));
  const res = responseStub();

  await verifyChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(savedInvoice.status, 'paid');
  assert.equal(attempt.status, 'success');
  assert.equal(res.body.data.receiptNumber, attempt.receiptNumber);
});

for (const providerStatus of ['pending', 'failed', 'cancelled', 'expired']) {
  test(`Chapa ${providerStatus} verification never settles the invoice`, async t => {
    const savedInvoice = invoice();
    const attempt = {
      _id: 'attempt-1',
      parent: savedInvoice.parent._id,
      child: savedInvoice.child._id,
      invoice: savedInvoice._id,
      merchantReference: 'MINT-test-reference',
      chapaReference: 'CHAPA-REFERENCE-1',
      amount: 75,
      currency: 'ETB',
      mode: 'test',
      status: 'pending'
    };
    let savedAttemptStatus;
    let attemptUnset;
    t.mock.method(ChapaPayment, 'findOne', async () => attempt);
    t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
    t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
      savedAttemptStatus = update.$set.status;
      attemptUnset = update.$unset;
      return { ...attempt, ...update.$set };
    });
    const invoiceUpdate = t.mock.method(Payment, 'findOneAndUpdate', async () => {
      throw new Error('An unconfirmed provider state must not settle the invoice.');
    });
    t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
    t.mock.method(axios, 'get', async () => ({
      data: {
        status: 'success',
        data: {
          status: providerStatus,
          merchant_reference: attempt.merchantReference,
          chapa_reference: attempt.chapaReference,
          amount: '7500',
          currency: 'ETB'
        }
      }
    }));
    const res = responseStub();

    await verifyChapaPayment({
      body: { txRef: attempt.merchantReference },
      user: { _id: savedInvoice.parent._id, role: 'parent' }
    }, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.status, providerStatus);
    assert.equal(savedAttemptStatus, providerStatus);
    assert.equal(savedInvoice.status, 'pending');
    assert.equal(invoiceUpdate.mock.callCount(), 0);
    if (providerStatus === 'cancelled' || providerStatus === 'expired' || providerStatus === 'failed') {
      assert.equal(attemptUnset.activeInvoice, '');
    }
  });
}

test('repeated verification of an already verified transaction returns its receipt without another provider call', async t => {
  const savedInvoice = {
    ...invoice(),
    status: 'paid',
    amountPaid: 100,
    method: 'chapa',
    chapaTxRef: 'MINT-test-reference'
  };
  const attempt = {
    _id: 'attempt-1',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-test-reference',
    chapaReference: 'CHAPA-REFERENCE-1',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'success',
    verifiedAt: new Date(),
    receiptNumber: 'RCT-INV-10001-TEST-REFERENCE',
    receiptGeneratedAt: new Date()
  };
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  const providerCall = t.mock.method(axios, 'get', async () => {
    throw new Error('Already verified payments must not need another provider call.');
  });

  const res = responseStub();

  await verifyChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.receiptNumber, attempt.receiptNumber);
  assert.equal(providerCall.mock.callCount(), 0);
});

test('verification refuses an invoice reference mismatch before contacting Chapa', async t => {
  const savedInvoice = invoice();
  savedInvoice.chapaTxRef = 'MINT-unrelated';
  savedInvoice.chapaAmount = 75;
  const attempt = {
    _id: 'attempt-reference-mismatch',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-test-reference',
    chapaReference: 'CHAPA-REFERENCE-1',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending'
  };
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  const providerCall = t.mock.method(axios, 'get', async () => {
    throw new Error('A mismatched invoice reference must not reach Chapa.');
  });
  const res = responseStub();

  await verifyChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'CHAPA_INVOICE_MISMATCH');
  assert.equal(providerCall.mock.callCount(), 0);
  assert.equal(savedInvoice.status, 'pending');
});

test('a Chapa amount mismatch never marks the invoice paid or creates a receipt', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-1',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-test-reference',
    chapaReference: 'CHAPA-REFERENCE-1',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending'
  };
  let savedStatus;
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    savedStatus = update.$set.status;
    return { ...attempt, ...update.$set };
  });
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  const invoiceSettlement = t.mock.method(Payment, 'findOneAndUpdate', async () => {
    throw new Error('Mismatched payment must not settle the invoice.');
  });
  t.mock.method(axios, 'get', async () => ({
    data: {
      status: 'success',
      data: {
        status: 'success',
        tx_ref: attempt.merchantReference,
        chapa_reference: attempt.chapaReference,
        amount: '74',
        currency: 'ETB'
      }
    }
  }));
  const res = responseStub();

  await verifyChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(savedStatus, 'unverified');
  assert.equal(savedInvoice.status, 'pending');
  assert.equal(invoiceSettlement.mock.callCount(), 0);
});

test('Chapa credential rejection is a verification service error and leaves the invoice unpaid', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-invalid-credentials',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-bad-creds',
    chapaReference: 'CHAPA-INVALID-CREDENTIALS',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending'
  };
  savedInvoice.chapaTxRef = attempt.merchantReference;
  savedInvoice.chapaAmount = attempt.amount;
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  const attemptUpdate = t.mock.method(ChapaPayment, 'findOneAndUpdate', async () => {
    throw new Error('Credential failures must not mutate payment attempts.');
  });
  const invoiceUpdate = t.mock.method(Payment, 'findOneAndUpdate', async () => {
    throw new Error('Credential failures must not settle invoices.');
  });
  const providerError = new Error('Chapa authorization rejected.');
  providerError.isAxiosError = true;
  providerError.response = { status: 401, data: { message: 'Unauthorized' } };
  t.mock.method(axios, 'get', async () => { throw providerError; });
  const res = responseStub();

  await verifyChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'CHAPA_CREDENTIALS_REJECTED');
  assert.equal(attemptUpdate.mock.callCount(), 0);
  assert.equal(invoiceUpdate.mock.callCount(), 0);
  assert.equal(savedInvoice.status, 'pending');
});

test('Chapa DNS failures during verification are explicit and leave the invoice pending', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-dns-verification',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-dns-verify',
    chapaReference: 'CHAPA-DNS-VERIFICATION',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending'
  };
  savedInvoice.chapaTxRef = attempt.merchantReference;
  savedInvoice.chapaAmount = attempt.amount;
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  const attemptUpdate = t.mock.method(ChapaPayment, 'findOneAndUpdate', async () => {
    throw new Error('DNS failure must not change the attempt status.');
  });
  const invoiceUpdate = t.mock.method(Payment, 'findOneAndUpdate', async () => {
    throw new Error('DNS failure must not settle the invoice.');
  });
  const providerError = Object.assign(new Error('getaddrinfo ENOTFOUND api.chapa.global'), {
    isAxiosError: true,
    code: 'ENOTFOUND'
  });
  t.mock.method(axios, 'get', async () => { throw providerError; });
  const res = responseStub();

  await verifyChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'CHAPA_DNS_ERROR');
  assert.equal(res.body.status, 'pending');
  assert.match(res.body.message, /official API hostname.*DNS/i);
  assert.match(res.body.message, /https:\/\/api\.chapa\.global\/v2/);
  assert.equal(attemptUpdate.mock.callCount(), 0);
  assert.equal(invoiceUpdate.mock.callCount(), 0);
  assert.equal(savedInvoice.status, 'pending');
});

test('verification does not send a transaction to credentials from the wrong Chapa environment', async t => {
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-environment-mismatch',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-env-mismatch',
    amount: 75,
    currency: 'ETB',
    mode: 'live',
    status: 'pending'
  };
  savedInvoice.chapaTxRef = attempt.merchantReference;
  savedInvoice.chapaAmount = attempt.amount;
  const originalSecret = process.env.CHAPA_SECRET_KEY;
  process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-unit_test_key';
  t.after(() => { process.env.CHAPA_SECRET_KEY = originalSecret; });
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  const providerCall = t.mock.method(axios, 'get', async () => {
    throw new Error('The provider must not be called with mismatched credentials.');
  });
  const res = responseStub();

  await verifyChapaPayment({
    body: { txRef: attempt.merchantReference },
    user: { _id: savedInvoice.parent._id, role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'CHAPA_ENVIRONMENT_MISMATCH');
  assert.equal(providerCall.mock.callCount(), 0);
});

for (const providerError of [
  Object.assign(new Error('timeout'), { isAxiosError: true, code: 'ECONNABORTED' }),
  Object.assign(new Error('unavailable'), { isAxiosError: true, response: { status: 503 } })
]) {
  test(`Chapa ${providerError.code || providerError.response.status} verification failure is retryable`, async t => {
    const savedInvoice = invoice();
    const attempt = {
      _id: 'attempt-provider-unavailable',
      parent: savedInvoice.parent._id,
      child: savedInvoice.child._id,
      invoice: savedInvoice._id,
      merchantReference: `MINT-${providerError.code || providerError.response.status}`,
      chapaReference: `CHAPA-provider-${providerError.code || providerError.response.status}`,
      amount: 75,
      currency: 'ETB',
      mode: 'test',
      status: 'pending'
    };
    savedInvoice.chapaTxRef = attempt.merchantReference;
    savedInvoice.chapaAmount = attempt.amount;
    t.mock.method(ChapaPayment, 'findOne', async () => attempt);
    t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
    const attemptUpdate = t.mock.method(ChapaPayment, 'findOneAndUpdate', async () => {
      throw new Error('A transient provider error must not mutate the attempt.');
    });
    const invoiceUpdate = t.mock.method(Payment, 'findOneAndUpdate', async () => {
      throw new Error('A transient provider error must not settle the invoice.');
    });
    t.mock.method(axios, 'get', async () => { throw providerError; });
    const res = responseStub();

    await verifyChapaPayment({
      body: { txRef: attempt.merchantReference },
      user: { _id: savedInvoice.parent._id, role: 'parent' }
    }, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'CHAPA_VERIFICATION_UNAVAILABLE');
    assert.equal(attemptUpdate.mock.callCount(), 0);
    assert.equal(invoiceUpdate.mock.callCount(), 0);
    assert.equal(savedInvoice.status, 'pending');
  });
}

for (const mismatch of [
  { label: 'currency', overrides: { currency: 'USD' } },
  { label: 'transaction reference', overrides: { merchant_reference: 'MINT-different' } },
  { label: 'provider reference', overrides: { chapa_reference: null } }
]) {
  test(`a Chapa ${mismatch.label} mismatch never settles the invoice or creates a receipt`, async t => {
    const savedInvoice = invoice();
    const attempt = {
      _id: 'attempt-verification-mismatch',
      parent: savedInvoice.parent._id,
      child: savedInvoice.child._id,
      invoice: savedInvoice._id,
      merchantReference: 'MINT-verify-mismatch',
      chapaReference: 'CHAPA-VERIFICATION-MISMATCH',
      amount: 75,
      currency: 'ETB',
      mode: 'test',
      status: 'pending'
    };
    savedInvoice.chapaTxRef = attempt.merchantReference;
    savedInvoice.chapaAmount = attempt.amount;
    let savedAttemptStatus;
    t.mock.method(ChapaPayment, 'findOne', async () => attempt);
    t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
      savedAttemptStatus = update.$set.status;
      return { ...attempt, ...update.$set };
    });
    t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
    t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
    const invoiceSettlement = t.mock.method(Payment, 'findOneAndUpdate', async () => {
      throw new Error('A mismatched Chapa transaction must not settle the invoice.');
    });
    t.mock.method(axios, 'get', async () => ({
      data: {
        status: 'success',
        data: {
          status: 'success',
          merchant_reference: attempt.merchantReference,
          chapa_reference: attempt.chapaReference,
          amount: '7500',
          currency: 'ETB',
          ...mismatch.overrides
        }
      }
    }));
    const res = responseStub();

    await verifyChapaPayment({
      body: { txRef: attempt.merchantReference },
      user: { _id: savedInvoice.parent._id, role: 'parent' }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(savedAttemptStatus, 'unverified');
    assert.equal(savedInvoice.status, 'pending');
    assert.equal(invoiceSettlement.mock.callCount(), 0);
    assert.equal(res.body.data, undefined);
  });
}

test('Chapa webhook signature covers the exact raw body and pending events do not settle invoices', async t => {
  const previousSecret = process.env.CHAPA_WEBHOOK_SECRET;
  process.env.CHAPA_WEBHOOK_SECRET = 'webhook-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = previousSecret;
  });
  const attempt = {
    _id: 'attempt-1',
    merchantReference: 'MINT-test-reference',
    chapaReference: null,
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending'
  };
  let savedStatus;
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    savedStatus = update.$set.status;
    Object.assign(attempt, update.$set);
    return attempt;
  });
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  const body = {
    type: 'API',
    event: 'payment.pending',
    data: {
      status: 'pending',
      mode: 'test',
      amount: '7500',
      currency: 'ETB',
      merchant_reference: attempt.merchantReference,
      chapa_reference: 'CHAPA-REFERENCE-1'
    }
  };
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const res = responseStub();

  await handleChapaWebhook({
    headers: { 'x-chapa-signature': signature },
    body,
    rawBody
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(savedStatus, 'pending');
  assert.equal(attempt.chapaReference, 'CHAPA-REFERENCE-1');
});

test('duplicate successful webhooks verify the same transaction and settle the invoice only once', async t => {
  const previousSecret = process.env.CHAPA_WEBHOOK_SECRET;
  process.env.CHAPA_WEBHOOK_SECRET = 'webhook-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = previousSecret;
  });
  const savedInvoice = invoice();
  const attempt = {
    _id: 'attempt-duplicate-webhook',
    parent: savedInvoice.parent._id,
    child: savedInvoice.child._id,
    invoice: savedInvoice._id,
    merchantReference: 'MINT-duplicate',
    chapaReference: 'CHAPA-DUPLICATE-1',
    amount: 75,
    currency: 'ETB',
    mode: 'test',
    status: 'pending'
  };
  savedInvoice.chapaTxRef = attempt.merchantReference;
  let settlementCalls = 0;
  t.mock.method(ChapaPayment, 'findOne', async () => attempt);
  t.mock.method(ChapaPayment, 'findById', async () => attempt);
  t.mock.method(ChapaPayment, 'updateOne', async (_filter, update) => {
    if (attempt.status !== 'success') Object.assign(attempt, update.$set);
    return { modifiedCount: attempt.status === 'success' ? 0 : 1 };
  });
  t.mock.method(ChapaPayment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(attempt, update.$set);
    return attempt;
  });
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, update) => {
    settlementCalls += 1;
    Object.assign(savedInvoice, update.$set);
    return savedInvoice;
  });
  const providerCall = t.mock.method(axios, 'get', async () => ({
    data: {
      status: 'success',
      data: {
        status: 'success',
        tx_ref: attempt.merchantReference,
        chapa_reference: attempt.chapaReference,
        amount: '7500',
        currency: 'ETB'
      }
    }
  }));
  const body = {
    type: 'API',
    event: 'payment.success',
    data: {
      status: 'success',
      mode: 'test',
      amount: '7500',
      currency: 'ETB',
      tx_ref: attempt.merchantReference,
      chapa_reference: attempt.chapaReference
    }
  };
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  for (let index = 0; index < 2; index += 1) {
    const res = responseStub();
    await handleChapaWebhook({
      headers: { 'x-chapa-signature': signature },
      body,
      rawBody
    }, res);
    assert.equal(res.statusCode, 200);
  }

  assert.equal(providerCall.mock.callCount(), 2);
  assert.equal(settlementCalls, 1);
  assert.equal(savedInvoice.status, 'paid');
  assert.equal(attempt.status, 'success');
  assert.ok(attempt.receiptNumber);
});

test('Chapa webhook rejects the legacy chapa-signature header', async t => {
  const previousSecret = process.env.CHAPA_WEBHOOK_SECRET;
  process.env.CHAPA_WEBHOOK_SECRET = 'webhook-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = previousSecret;
  });
  const body = { type: 'API', data: { merchant_reference: 'MINT-not-found' } };
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET)
    .update(process.env.CHAPA_WEBHOOK_SECRET)
    .digest('hex');
  const lookup = t.mock.method(ChapaPayment, 'findOne', async () => null);
  const res = responseStub();

  await handleChapaWebhook({
    headers: { 'chapa-signature': signature },
    body,
    rawBody
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body, 'Invalid webhook signature.');
  assert.equal(lookup.mock.callCount(), 0);
});

test('Chapa webhook rejects invalid signatures without touching transaction records', async t => {
  const previousSecret = process.env.CHAPA_WEBHOOK_SECRET;
  process.env.CHAPA_WEBHOOK_SECRET = 'webhook-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = previousSecret;
  });
  const lookup = t.mock.method(ChapaPayment, 'findOne', async () => {
    throw new Error('An invalid signature must be rejected before a database lookup.');
  });
  const body = {
    webhook_type: 'payment',
    event: 'payment.pending',
    status: 'pending',
    amount: '7500',
    currency: 'ETB',
    merchant_reference: 'MINT-test-reference',
    chapa_reference: 'CHAPA-REFERENCE-1'
  };
  const res = responseStub();

  await handleChapaWebhook({
    headers: { 'x-chapa-signature': '0'.repeat(64) },
    body,
    rawBody: Buffer.from(JSON.stringify(body))
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(lookup.mock.callCount(), 0);
});

test('parent payment history query is scoped to the authenticated parent', async t => {
  let filter;
  t.mock.method(ChapaPayment, 'find', receivedFilter => {
    filter = receivedFilter;
    return queryStub([{
      _id: 'attempt-1',
      merchantReference: 'MINT-parent-attempt',
      parent: 'parent-1',
      amount: 75,
      currency: 'ETB',
      status: 'pending'
    }]);
  });
  t.mock.method(ChapaPayment, 'countDocuments', async () => 1);
  t.mock.method(ChapaPayment, 'aggregate', async () => [{
    totalCount: 1,
    paidCount: 0,
    totalPaid: 0
  }]);
  const res = responseStub();

  await require('../controllers/chapaPaymentController').getPaymentHistory({
    user: { _id: 'parent-1', role: 'parent' },
    query: {}
  }, res);

  assert.deepEqual(filter, { parent: 'parent-1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].merchantReference, 'MINT-parent-attempt');
});

test('admin payment history applies status, provider method, and inclusive date filters', async t => {
  let filter;
  t.mock.method(ChapaPayment, 'find', receivedFilter => {
    filter = receivedFilter;
    return queryStub([]);
  });
  t.mock.method(ChapaPayment, 'countDocuments', async () => 0);
  t.mock.method(ChapaPayment, 'aggregate', async () => []);
  const res = responseStub();

  await getPaymentHistory({
    user: { _id: 'admin-1', role: 'admin' },
    query: {
      status: 'failed',
      method: 'telebirr',
      startDate: '2025-02-01',
      endDate: '2025-02-05'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(filter.status, 'failed');
  assert.equal(filter.paymentMethod.test('Telebirr'), true);
  assert.equal(filter.createdAt.$gte.getFullYear(), 2025);
  assert.equal(filter.createdAt.$gte.getMonth(), 1);
  assert.equal(filter.createdAt.$gte.getDate(), 1);
  assert.equal(filter.createdAt.$lte.getFullYear(), 2025);
  assert.equal(filter.createdAt.$lte.getMonth(), 1);
  assert.equal(filter.createdAt.$lte.getDate(), 5);
  assert.equal(filter.createdAt.$lte.getHours(), 23);
  assert.equal(filter.createdAt.$lte.getMinutes(), 59);
});

test('payment history rejects invalid status and reversed date ranges', async () => {
  const res = responseStub();
  await getPaymentHistory({
    user: { _id: 'admin-1', role: 'admin' },
    query: { status: 'settled' }
  }, res);
  assert.equal(res.statusCode, 400);

  const reversedRangeResponse = responseStub();
  await getPaymentHistory({
    user: { _id: 'admin-1', role: 'admin' },
    query: { startDate: '2025-02-06', endDate: '2025-02-05' }
  }, reversedRangeResponse);
  assert.equal(reversedRangeResponse.statusCode, 400);
});

test('a parent cannot verify another parent’s transaction', async t => {
  t.mock.method(ChapaPayment, 'findOne', async () => ({
    merchantReference: 'MINT-other-parent',
    parent: '507f1f77bcf86cd799439099'
  }));
  const providerCall = t.mock.method(axios, 'get', async () => {
    throw new Error('An unowned transaction must not be sent to Chapa.');
  });
  const res = responseStub();

  await verifyChapaPayment({
    body: { txRef: 'MINT-other-parent' },
    user: { _id: '507f1f77bcf86cd799439012', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(providerCall.mock.callCount(), 0);
});
