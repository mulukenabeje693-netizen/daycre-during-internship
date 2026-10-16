const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-unit_test_key';
process.env.ONLINE_PAYMENTS_ENABLED = 'true';

const axios = require('axios');
const Payment = require('../models/Payment');
const Child = require('../models/Child');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const SystemSetting = require('../models/SystemSetting');
const {
  createPayment,
  getPayments,
  getPayment,
  getPaymentSummary,
  chapaPrepare,
  chapaInitialize,
  chapaVerify,
  chapaWebhook,
  getInvoiceList,
  generateTestInvoice,
  getPaymentStatus,
  getReceipts,
  getReceiptById
} = require('../controllers/paymentController');
const { getSettings, setOnlinePayments } = require('../controllers/settingsController');
const { isChapaConfigured } = require('../utils/chapaConfig');
const { isValidChapaReference } = require('../utils/chapaReference');

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

const queryStub = value => {
  const query = {
    populate() { return query; },
    select() { return query; },
    sort() { return query; },
    limit() { return query; },
    maxTimeMS() { return query; },
    lean() { return query; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
  return query;
};

const invoiceForParent = () => ({
  _id: 'invoice-1',
  invoiceNumber: 'INV-00001',
  parent: { _id: 'parent-1', fullName: 'Daycare Parent', email: 'parent@example.test' },
  child: { _id: 'child-1', firstName: 'Test', lastName: 'Child', parents: ['parent-1'] },
  amount: 100,
  currency: 'ETB',
  status: 'pending',
  method: null,
  chapaTxRef: null
});

test('online payments can be enabled through the setting controller', async t => {
  const setting = {
    onlinePaymentsEnabled: false,
    isFreeMode: true,
    async save() {}
  };
  t.mock.method(SystemSetting, 'findOne', async () => setting);

  const res = responseStub();
  await setOnlinePayments({ body: { enabled: true } }, res);
  const persistedRes = responseStub();
  await getSettings({}, persistedRes);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.onlinePaymentsEnabled, true);
  assert.equal(setting.onlinePaymentsEnabled, true);
  assert.equal(setting.isFreeMode, false);
  assert.equal(persistedRes.body.data.paymentSettingEnabled, true);
});

test('public payment settings explain which server or administrator gate blocks checkout', async t => {
  const previousSecret = process.env.CHAPA_SECRET_KEY;
  const previousOnlinePayments = process.env.ONLINE_PAYMENTS_ENABLED;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CHAPA_SECRET_KEY;
    else process.env.CHAPA_SECRET_KEY = previousSecret;
    if (previousOnlinePayments === undefined) delete process.env.ONLINE_PAYMENTS_ENABLED;
    else process.env.ONLINE_PAYMENTS_ENABLED = previousOnlinePayments;
  });

  process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-settings_test_key';
  process.env.ONLINE_PAYMENTS_ENABLED = 'true';
  const setting = { onlinePaymentsEnabled: false };
  t.mock.method(SystemSetting, 'findOne', async () => setting);

  const adminDisabled = responseStub();
  await getSettings({}, adminDisabled);
  assert.match(adminDisabled.body.data.onlinePaymentsDisabledReason, /daycare administrator/i);

  setting.onlinePaymentsEnabled = true;
  process.env.ONLINE_PAYMENTS_ENABLED = 'false';
  const runtimeDisabled = responseStub();
  await getSettings({}, runtimeDisabled);
  assert.match(runtimeDisabled.body.data.onlinePaymentsDisabledReason, /ONLINE_PAYMENTS_ENABLED=true/);

  delete process.env.CHAPA_SECRET_KEY;
  process.env.ONLINE_PAYMENTS_ENABLED = 'true';
  const chapaUnconfigured = responseStub();
  await getSettings({}, chapaUnconfigured);
  assert.match(chapaUnconfigured.body.data.onlinePaymentsDisabledReason, /CHAPA_SECRET_KEY/);
});

test('new invoices ignore client-supplied paid and Chapa verification fields', async t => {
  let createdInvoice;
  t.mock.method(Child, 'findById', () => queryStub({ parents: ['parent-1'] }));
  t.mock.method(Payment, 'create', async values => {
    createdInvoice = values;
    return { _id: 'invoice-new' };
  });
  t.mock.method(Payment, 'findById', () => queryStub({ _id: 'invoice-new' }));

  const res = responseStub();
  await createPayment({
    body: {
      parent: 'parent-1',
      child: 'child-1',
      amount: 100,
      type: 'other',
      dueDate: new Date('2026-11-01'),
      status: 'paid',
      method: 'chapa',
      chapaTxRef: 'forged-reference',
      verifiedAt: new Date(),
      receiptNumber: 'FORGED'
    },
    user: { _id: 'admin-1' }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdInvoice.status, 'pending');
  assert.equal(createdInvoice.method, null);
  assert.equal(createdInvoice.chapaTxRef, undefined);
  assert.equal(createdInvoice.verifiedAt, undefined);
  assert.equal(createdInvoice.receiptNumber, undefined);
});

test('staff cannot create an invoice pairing an unrelated parent and child', async t => {
  t.mock.method(Child, 'findById', () => queryStub({ parents: ['different-parent'] }));
  const createInvoice = t.mock.method(Payment, 'create', async () => {
    throw new Error('An invoice must not be created for an unrelated parent.');
  });
  const res = responseStub();

  await createPayment({
    body: {
      parent: 'parent-1',
      child: 'child-1',
      amount: 100,
      type: 'other',
      dueDate: new Date('2026-11-01')
    },
    user: { _id: 'staff-1' }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /not linked to this child/i);
  assert.equal(createInvoice.mock.callCount(), 0);
});

test('the Chapa initializer refuses checkout while the administrator has disabled it', async t => {
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: true }) };
    }
  }));
  const findInvoice = t.mock.method(Payment, 'findById', () => {
    throw new Error('Disabled checkout must not load or initialize an invoice.');
  });
  const res = responseStub();

  await chapaInitialize({
    params: { id: 'invoice-1' },
    user: { _id: 'parent-1', role: 'parent' },
    body: {},
    headers: {}
  }, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /Online payments are disabled/);
  assert.equal(findInvoice.mock.callCount(), 0);
});

test('preparing checkout persists a short unique reference for the owned invoice', async t => {
  const invoice = invoiceForParent();
  let update;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, updateDocument) => {
    update = updateDocument;
    Object.assign(invoice, updateDocument.$set);
    return invoice;
  });

  const res = responseStub();
  await chapaPrepare({
    params: { id: invoice._id },
    user: { _id: 'parent-1', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.invoiceId, invoice._id);
  assert.equal(res.body.amount, invoice.amount);
  assert.equal(res.body.currency, 'ETB');
  assert.ok(isValidChapaReference(res.body.txRef));
  assert.ok(res.body.txRef.length <= 20);
  assert.equal(invoice.chapaTxRef, res.body.txRef);
  assert.equal(update.$set.chapaStatus, 'pending');
  assert.equal(update.$set.chapaAmount, invoice.amount);
});

test('preparing checkout rejects an invoice owned by another parent', async t => {
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub({
    ...invoiceForParent(),
    parent: { _id: 'different-parent', fullName: 'Other Parent' }
  }));
  const write = t.mock.method(Payment, 'findOneAndUpdate', async () => {
    throw new Error('An unowned invoice cannot be prepared.');
  });
  const res = responseStub();

  await chapaPrepare({
    params: { id: 'invoice-1' },
    user: { _id: 'parent-1', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(write.mock.callCount(), 0);
});

test('preparing checkout does not rotate the reference while initialization is in progress', async t => {
  const invoice = {
    ...invoiceForParent(),
    chapaTxRef: 'MINT-in-progress',
    chapaInitAttemptedAt: new Date(),
    chapaInitStartedAt: new Date()
  };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  const referenceLookup = t.mock.method(axios, 'get', async () => {
    throw new Error('An active initialization must not be verified or rotated.');
  });
  const write = t.mock.method(Payment, 'findOneAndUpdate', async () => {
    throw new Error('An active initialization must not be replaced.');
  });
  const res = responseStub();

  await chapaPrepare({
    params: { id: invoice._id },
    user: { _id: 'parent-1', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(referenceLookup.mock.callCount(), 0);
  assert.equal(write.mock.callCount(), 0);
});

test('preparing checkout replaces legacy oversized transaction references', async t => {
  const invoice = {
    ...invoiceForParent(),
    chapaTxRef: `MINT-${'a'.repeat(24)}-${'1'.repeat(13)}-${'f'.repeat(16)}`,
    chapaStatus: 'pending',
    chapaInitAttemptedAt: new Date()
  };
  let preparedReference;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, update) => {
    preparedReference = update.$set.chapaTxRef;
    return { ...invoice, ...update.$set };
  });

  const res = responseStub();
  await chapaPrepare({
    params: { id: invoice._id },
    user: { _id: 'parent-1', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.notEqual(preparedReference, invoice.chapaTxRef);
  assert.ok(isValidChapaReference(preparedReference));
  assert.ok(preparedReference.length <= 20);
  assert.equal(res.body.txRef, preparedReference);
});

test('preparing checkout replaces a provider-rejected reference instead of reusing it', async t => {
  const invoice = {
    ...invoiceForParent(),
    chapaTxRef: 'MINT-rejected-ref',
    chapaStatus: 'pending',
    chapaInitAttemptedAt: new Date()
  };
  let preparedReference;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  t.mock.method(axios, 'get', async () => {
    const error = new Error('Invalid transaction reference');
    error.response = { status: 400, data: { message: 'Invalid transaction reference' } };
    throw error;
  });
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, update) => {
    preparedReference = update.$set.chapaTxRef;
    return { ...invoice, ...update.$set };
  });

  const res = responseStub();
  await chapaPrepare({
    params: { id: invoice._id },
    user: { _id: 'parent-1', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.notEqual(preparedReference, invoice.chapaTxRef);
  assert.ok(isValidChapaReference(preparedReference));
  assert.ok(preparedReference.length <= 20);
  assert.equal(res.body.txRef, preparedReference);
});

test('preparing checkout replaces references rejected in a successful HTTP response', async t => {
  const invoice = {
    ...invoiceForParent(),
    chapaTxRef: 'MINT-rejected-resp',
    chapaStatus: 'pending',
    chapaInitAttemptedAt: new Date()
  };
  let preparedReference;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  t.mock.method(axios, 'get', async () => ({
    data: { status: 'failed', message: 'Invalid transaction reference' }
  }));
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, update) => {
    preparedReference = update.$set.chapaTxRef;
    return { ...invoice, ...update.$set };
  });

  const res = responseStub();
  await chapaPrepare({
    params: { id: invoice._id },
    user: { _id: 'parent-1', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.notEqual(preparedReference, invoice.chapaTxRef);
  assert.equal(res.body.txRef, preparedReference);
});

test('Chapa initialization followed by server verification marks the invoice paid and saves a receipt', async t => {
  const invoice = { ...invoiceForParent(), amountPaid: 25 };
  const stored = { ...invoice };
  let providerTxRef;
  let paidTransitionFilter;

  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  t.mock.method(Payment, 'findOne', () => queryStub(stored));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(Payment, 'findOneAndUpdate', (filter, update) => {
    if (update.$set.chapaInitStartedAt) {
      providerTxRef = update.$set.chapaTxRef;
      Object.assign(invoice, update.$set);
      Object.assign(stored, update.$set);
      return Promise.resolve({ ...invoice });
    }
    if (update.$set.status === 'paid') paidTransitionFilter = filter;
    Object.assign(invoice, update.$set);
    Object.assign(stored, update.$set);
    return queryStub(stored);
  });
  t.mock.method(axios, 'post', async (_url, payload, config) => {
    assert.equal(config.timeout, 30_000);
    assert.equal(payload.amount, '75');
    assert.equal(payload.currency, 'ETB');
    assert.equal(payload.tx_ref, providerTxRef);
    return { data: { status: 'success', data: { checkout_url: 'https://checkout.chapa.co/checkout/test' } } };
  });
  t.mock.method(axios, 'get', async (url, config) => {
    assert.equal(config.timeout, 30_000);
    assert.ok(url.endsWith(encodeURIComponent(providerTxRef)));
    return {
      data: {
        status: 'success',
        data: {
          status: 'success',
          tx_ref: providerTxRef,
          amount: '75',
          currency: 'ETB',
          reference: 'chapa-reference-1'
        }
      }
    };
  });

  const parentRequest = {
    user: { _id: 'parent-1', role: 'parent', fullName: 'Daycare Parent', email: 'parent@example.test' },
    params: { id: 'invoice-1' },
    body: {},
    headers: { origin: 'http://localhost:3000' }
  };

  const prepareRes = responseStub();
  await chapaPrepare(parentRequest, prepareRes);
  assert.equal(prepareRes.statusCode, 200);
  assert.equal(invoice.chapaTxRef, prepareRes.body.txRef);
  assert.ok(isValidChapaReference(invoice.chapaTxRef));
  assert.ok(invoice.chapaTxRef.length <= 20);

  const initRes = responseStub();
  await chapaInitialize({
    ...parentRequest,
    body: { txRef: prepareRes.body.txRef }
  }, initRes);
  assert.equal(initRes.statusCode, 200);
  assert.equal(initRes.body.success, true);
  assert.match(initRes.body.checkoutUrl, /^https:\/\/checkout\.chapa\.co\//);
  assert.ok(isValidChapaReference(initRes.body.txRef));
  assert.ok(initRes.body.txRef.length <= 20);
  assert.equal(stored.chapaTxRef, initRes.body.txRef);

  const verifyRes = responseStub();
  await chapaVerify({
    user: parentRequest.user,
    body: { txRef: initRes.body.txRef }
  }, verifyRes);

  assert.equal(verifyRes.statusCode, 200);
  assert.equal(verifyRes.body.data.status, 'paid');
  assert.equal(verifyRes.body.data.method, 'chapa');
  assert.equal(verifyRes.body.data.chapaStatus, 'success');
  assert.equal(verifyRes.body.data.chapaReference, 'chapa-reference-1');
  assert.equal(paidTransitionFilter.chapaTxRef, providerTxRef);
  assert.equal(verifyRes.body.data.amountPaid, 100);
  assert.equal(verifyRes.body.data.chapaAmount, 75);
  assert.equal(verifyRes.body.data.receiptNumber, 'RCT-INV-00001');
  assert.ok(verifyRes.body.data.receiptGeneratedAt);
  assert.ok(verifyRes.body.data.verifiedAt);
});

test('Chapa initialization rejects a missing prepared reference without contacting Chapa', async t => {
  const invoice = invoiceForParent();
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  const providerRequest = t.mock.method(axios, 'post', async () => {
    throw new Error('An unprepared checkout must not be sent to Chapa.');
  });
  const res = responseStub();

  await chapaInitialize({
    params: { id: invoice._id },
    user: { _id: 'parent-1', role: 'parent' },
    body: {},
    headers: {}
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Prepare checkout before initializing/);
  assert.equal(providerRequest.mock.callCount(), 0);
});

test('Chapa initialization rejects a reference that does not belong to the invoice', async t => {
  const invoice = { ...invoiceForParent(), chapaTxRef: 'MINT-valid-reference' };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  const providerRequest = t.mock.method(axios, 'post', async () => {
    throw new Error('A mismatched reference must not be sent to Chapa.');
  });
  const res = responseStub();

  await chapaInitialize({
    params: { id: invoice._id },
    user: { _id: 'parent-1', role: 'parent' },
    body: { txRef: 'MINT-notinvoice' },
    headers: {}
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Invalid transaction reference/);
  assert.equal(providerRequest.mock.callCount(), 0);
});

test('failed Chapa initialization does not return a checkout URL or mark the invoice paid', async t => {
  const invoice = { ...invoiceForParent(), chapaTxRef: 'MINT-prepared' };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, update) => ({
    ...invoice,
    ...update.$set
  }));
  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(axios, 'post', async () => {
    const error = new Error('Chapa initialization rejected the transaction.');
    error.response = { status: 400, data: { message: 'Invalid transaction reference' } };
    throw error;
  });
  const res = responseStub();

  await chapaInitialize({
    params: { id: invoice._id },
    user: { _id: 'parent-1', role: 'parent' },
    body: { txRef: invoice.chapaTxRef },
    headers: {}
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'CHAPA_REFERENCE_REJECTED');
  assert.equal(res.body.checkoutUrl, undefined);
  assert.equal(invoice.status, 'pending');
});

test('repeated initialization returns the saved checkout URL without creating another Chapa transaction', async t => {
  const invoice = {
    ...invoiceForParent(),
    chapaTxRef: 'MINT-prepared',
    chapaStatus: 'pending',
    chapaCheckoutUrl: 'https://checkout.chapa.co/checkout/existing'
  };
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  const providerRequest = t.mock.method(axios, 'post', async () => {
    throw new Error('Repeated initialization must reuse the persisted checkout URL.');
  });
  const res = responseStub();

  await chapaInitialize({
    params: { id: invoice._id },
    user: { _id: 'parent-1', role: 'parent' },
    body: { txRef: invoice.chapaTxRef },
    headers: {}
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.checkoutUrl, invoice.chapaCheckoutUrl);
  assert.equal(res.body.txRef, invoice.chapaTxRef);
  assert.equal(providerRequest.mock.callCount(), 0);
});

test('concurrent Pay Now requests initialize Chapa only once', async t => {
  const invoice = {
    ...invoiceForParent(),
    chapaTxRef: 'MINT-concurrent'
  };
  let releaseProvider;
  let markProviderStarted;
  const providerStarted = new Promise(resolve => {
    markProviderStarted = resolve;
  });
  const providerGate = new Promise(resolve => {
    releaseProvider = resolve;
  });
  let initRequests = 0;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(invoice, update.$set);
    return invoice;
  });
  t.mock.method(axios, 'post', async () => {
    initRequests += 1;
    markProviderStarted();
    await providerGate;
    return { data: { status: 'success', data: { checkout_url: 'https://checkout.chapa.co/checkout/test' } } };
  });
  t.mock.method(Payment, 'updateOne', async (_filter, update) => {
    Object.assign(invoice, update.$set);
    if (update.$unset) {
      for (const field of Object.keys(update.$unset)) delete invoice[field];
    }
    return { modifiedCount: 1 };
  });

  const request = () => ({
    params: { id: invoice._id },
    user: { _id: 'parent-1', role: 'parent' },
    body: { txRef: invoice.chapaTxRef },
    headers: {}
  });
  const firstResponse = responseStub();
  const firstRequest = chapaInitialize(request(), firstResponse);
  await providerStarted;

  const secondResponse = responseStub();
  await chapaInitialize(request(), secondResponse);

  releaseProvider();
  await firstRequest;

  assert.equal(secondResponse.statusCode, 409);
  assert.equal(secondResponse.body.status, 'processing');
  assert.equal(firstResponse.statusCode, 200);
  assert.equal(initRequests, 1);
});

test('Chapa initialization retains the transaction reference when its checkout URL is missing', async t => {
  const invoice = { ...invoiceForParent(), chapaTxRef: 'MINT-prepared' };
  let storedReference;
  let savedState;
  t.mock.method(SystemSetting, 'findOne', () => ({
    select() {
      return { lean: async () => ({ isFreeMode: false, onlinePaymentsEnabled: true }) };
    }
  }));
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, update) => {
    storedReference = update.$set.chapaTxRef;
    return { ...invoice, chapaTxRef: storedReference };
  });
  t.mock.method(Payment, 'updateOne', async (_filter, update) => {
    savedState = update;
    return { modifiedCount: 1 };
  });
  t.mock.method(axios, 'post', async () => ({ data: { status: 'success', data: {} } }));
  const res = responseStub();

  await chapaInitialize({
    params: { id: invoice._id },
    user: { _id: 'parent-1', role: 'parent' },
    body: { txRef: invoice.chapaTxRef },
    headers: {}
  }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'CHAPA_CHECKOUT_UNAVAILABLE');
  assert.equal(res.body.txRef, storedReference);
  assert.equal(res.body.checkoutUrl, undefined);
  assert.ok(isValidChapaReference(storedReference));
  assert.ok(storedReference.length <= 20);
  assert.equal(savedState.$set.chapaStatus, 'pending');
  assert.equal(savedState.$unset.chapaInitStartedAt, '');
  assert.equal(savedState.$unset.chapaTxRef, undefined);
  assert.equal(savedState.$unset.chapaInitAttemptedAt, undefined);
});

test('a declined Chapa transaction stays unpaid and its failed status is recorded', async t => {
  const invoice = { ...invoiceForParent(), chapaTxRef: 'tx-failed' };
  let savedStatus;
  const updateInvoice = t.mock.method(Payment, 'findOneAndUpdate', async () => {
    throw new Error('Unsuccessful provider status must never mark an invoice paid.');
  });
  t.mock.method(Payment, 'findOne', () => queryStub(invoice));
  t.mock.method(Payment, 'updateOne', async (_filter, update) => {
    savedStatus = update.$set.chapaStatus;
    return { modifiedCount: 1 };
  });
  t.mock.method(axios, 'get', async () => ({
    data: { status: 'success', data: { status: 'failed', tx_ref: 'tx-failed', amount: 100, currency: 'ETB' } }
  }));

  const res = responseStub();
  await chapaVerify({
    user: { _id: 'parent-1', role: 'parent' },
    body: { txRef: 'tx-failed' }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.status, 'failed');
  assert.equal(savedStatus, 'failed');
  assert.equal(invoice.status, 'pending');
  assert.equal(updateInvoice.mock.callCount(), 0);
});

test('pending and cancelled provider states are stored without paying the invoice', async t => {
  const statuses = ['pending', 'cancelled', 'canceled', 'expired'];
  const savedStatuses = [];
  t.mock.method(Payment, 'findOne', filter => queryStub({
    ...invoiceForParent(),
    chapaTxRef: filter.chapaTxRef
  }));
  t.mock.method(Payment, 'updateOne', async (_filter, update) => {
    savedStatuses.push(update.$set.chapaStatus);
    return { modifiedCount: 1 };
  });
  t.mock.method(Payment, 'findOneAndUpdate', async () => {
    throw new Error('A pending or cancelled transaction must not mark an invoice paid.');
  });
  t.mock.method(axios, 'get', async url => {
    const txRef = decodeURIComponent(url.split('/').pop());
    const providerStatus = txRef.replace('tx-', '');
    return {
      data: {
        status: 'success',
        data: { status: providerStatus, tx_ref: txRef, amount: 100, currency: 'ETB' }
      }
    };
  });

  for (const providerStatus of statuses) {
    const res = responseStub();
    await chapaVerify({
      user: { _id: 'parent-1', role: 'parent' },
      body: { txRef: `tx-${providerStatus}` }
    }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.status, providerStatus === 'canceled' ? 'cancelled' : providerStatus);
  }

  assert.deepEqual(savedStatuses, ['pending', 'cancelled', 'cancelled', 'expired']);
});

test('Chapa webhook verifies the signed raw body and records nested pending transactions', async t => {
  const previousSecret = process.env.CHAPA_WEBHOOK_SECRET;
  process.env.CHAPA_WEBHOOK_SECRET = 'webhook-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = previousSecret;
  });
  let savedStatus;
  t.mock.method(Payment, 'updateOne', async (_filter, update) => {
    savedStatus = update.$set.chapaStatus;
    return { modifiedCount: 1 };
  });
  const body = { event: 'charge.pending', data: { tx_ref: 'tx-webhook', status: 'pending' } };
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const res = responseStub();

  await chapaWebhook({
    headers: { 'x-chapa-signature': signature },
    body,
    rawBody
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(savedStatus, 'pending');
});

test('successful Chapa webhooks re-verify with Chapa and remain idempotent', async t => {
  const previousSecret = process.env.CHAPA_WEBHOOK_SECRET;
  process.env.CHAPA_WEBHOOK_SECRET = 'webhook-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = previousSecret;
  });
  const invoice = { ...invoiceForParent(), chapaTxRef: 'tx-webhook-success' };
  let paidTransitions = 0;
  t.mock.method(Payment, 'findOne', async () => invoice);
  t.mock.method(Payment, 'findOneAndUpdate', async (_filter, update) => {
    paidTransitions += 1;
    Object.assign(invoice, update.$set);
    return invoice;
  });
  t.mock.method(Payment, 'updateOne', async (_filter, update) => {
    Object.assign(invoice, update.$set);
    return { modifiedCount: 1 };
  });
  t.mock.method(axios, 'get', async () => ({
    data: {
      status: 'success',
      data: {
        status: 'success',
        tx_ref: 'tx-webhook-success',
        amount: 100,
        currency: 'ETB',
        reference: 'chapa-reference-webhook'
      }
    }
  }));
  const body = { event: 'charge.success', data: { tx_ref: 'tx-webhook-success', status: 'success' } };
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const request = {
    headers: { 'x-chapa-signature': signature },
    body,
    rawBody
  };

  const firstResponse = responseStub();
  await chapaWebhook(request, firstResponse);
  const originalReceiptDate = invoice.receiptGeneratedAt;
  const secondResponse = responseStub();
  await chapaWebhook(request, secondResponse);

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(paidTransitions, 1);
  assert.equal(invoice.status, 'paid');
  assert.equal(invoice.chapaStatus, 'success');
  assert.equal(invoice.chapaReference, 'chapa-reference-webhook');
  assert.equal(invoice.receiptNumber, 'RCT-INV-00001');
  assert.equal(invoice.receiptGeneratedAt, originalReceiptDate);
});

test('Chapa webhook rejects invalid signatures without changing payment state', async t => {
  const previousSecret = process.env.CHAPA_WEBHOOK_SECRET;
  process.env.CHAPA_WEBHOOK_SECRET = 'webhook-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = previousSecret;
  });
  const updateStatus = t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  const res = responseStub();

  await chapaWebhook({
    headers: { 'x-chapa-signature': '0'.repeat(64) },
    body: { tx_ref: 'tx-webhook', status: 'success' },
    rawBody: Buffer.from('{"tx_ref":"tx-webhook","status":"success"}')
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(updateStatus.mock.callCount(), 0);
});

test('test Chapa keys are never considered configured in production', () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousSecretKey = process.env.CHAPA_SECRET_KEY;
  process.env.NODE_ENV = 'production';
  try {
    process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-key_123';
    assert.equal(isChapaConfigured(), false);
    process.env.CHAPA_SECRET_KEY = 'CHAPA_TEST_key_123';
    assert.equal(isChapaConfigured(), false);
    process.env.CHAPA_SECRET_KEY = 'CHASECK-key_123';
    assert.equal(isChapaConfigured(), true);
    process.env.CHAPA_SECRET_KEY = 'CHAPA_LIVE_key_123';
    assert.equal(isChapaConfigured(), true);
  } finally {
    process.env.NODE_ENV = previousEnvironment;
    process.env.CHAPA_SECRET_KEY = previousSecretKey;
  }
});

test('official Chapa sandbox keys are recognized outside production', () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousSecretKey = process.env.CHAPA_SECRET_KEY;
  process.env.NODE_ENV = 'development';
  try {
    process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-key_123';
    assert.equal(isChapaConfigured(), true);
    process.env.CHAPA_SECRET_KEY = 'CHAPA_TEST_key_123';
    assert.equal(isChapaConfigured(), true);
  } finally {
    process.env.NODE_ENV = previousEnvironment;
    process.env.CHAPA_SECRET_KEY = previousSecretKey;
  }
});

test('invoice listing returns only outstanding invoices for the authenticated parent', async t => {
  const invoice = { ...invoiceForParent(), status: 'overdue', amount: 100, amountPaid: 25 };
  let invoiceFilter;
  let paidFilter;
  t.mock.method(Child, 'distinct', async (field, filter) => {
    assert.equal(field, '_id');
    assert.deepEqual(filter, filter.status
      ? { parents: 'parent-1', status: 'active' }
      : { parents: 'parent-1' });
    return ['child-1'];
  });
  t.mock.method(Payment, 'find', filter => {
    if (filter.sandboxTestInvoice) return queryStub([]);
    invoiceFilter = filter;
    return queryStub([invoice]);
  });
  t.mock.method(Payment, 'findOne', filter => {
    paidFilter = filter;
    return queryStub({ _id: 'paid-invoice' });
  });
  const res = responseStub();

  await getInvoiceList({ user: { _id: 'parent-1', role: 'parent' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(invoiceFilter, {
    parent: 'parent-1',
    child: { $in: ['child-1'] },
    status: { $in: ['pending', 'overdue'] },
    amount: { $gt: 0 },
    $expr: { $gt: [{ $subtract: ['$amount', { $ifNull: ['$amountPaid', 0] }] }, 0] }
  });
  assert.deepEqual(paidFilter, { parent: 'parent-1', child: { $in: ['child-1'] }, status: 'paid' });
  assert.equal(res.body.hasPaidInvoices, true);
  assert.equal(res.body.data[0].amount, 100);
  assert.equal(res.body.data[0].amountPaid, 25);
  assert.equal(res.body.data[0].outstandingBalance, 75);
  assert.equal(res.body.testInvoiceState, 'available');
});

test('paid invoice status is authoritative when legacy amountPaid is zero', async t => {
  t.mock.method(Child, 'distinct', async () => ['child-1']);
  t.mock.method(Payment, 'find', filter => filter.sandboxTestInvoice
    ? queryStub([])
    : queryStub([{
      ...invoiceForParent(),
      status: 'paid',
      amount: 100,
      amountPaid: 0
    }]));
  t.mock.method(Payment, 'findOne', () => queryStub({ _id: 'paid-invoice' }));
  const res = responseStub();

  await getInvoiceList({ user: { _id: 'parent-1', role: 'parent' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].amountPaid, 100);
  assert.equal(res.body.data[0].outstandingBalance, 0);
  assert.equal(res.body.testInvoiceState, 'available');
});

test('invoice listing includes outstanding invoices for linked children that are not active', async t => {
  const linkedInvoice = {
    ...invoiceForParent(),
    child: { _id: 'inactive-child-1', firstName: 'Linked', lastName: 'Child' },
    amount: 100,
    amountPaid: 0,
    status: 'pending'
  };
  t.mock.method(Child, 'distinct', async (_field, filter) =>
    filter.status === 'active' ? [] : ['inactive-child-1']
  );
  t.mock.method(Payment, 'find', filter =>
    filter.sandboxTestInvoice ? queryStub([]) : queryStub([linkedInvoice])
  );
  t.mock.method(Payment, 'findOne', () => queryStub(null));
  const res = responseStub();

  await getInvoiceList({ user: { _id: 'parent-1', role: 'parent' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.data[0]._id, 'invoice-1');
  assert.equal(res.body.testInvoiceState, 'no-active-children');
});

test('invoice listing returns a genuine empty state when the parent has no payable invoices', async t => {
  t.mock.method(Child, 'distinct', async (_field, filter) => {
    assert.deepEqual(filter, filter.status
      ? { parents: 'parent-1', status: 'active' }
      : { parents: 'parent-1' });
    return filter.status ? [] : ['inactive-child-1'];
  });
  t.mock.method(Payment, 'find', filter => {
    assert.equal(filter.parent, 'parent-1');
    assert.deepEqual(filter.child, filter.sandboxTestInvoice
      ? { $in: [] }
      : { $in: ['inactive-child-1'] });
    return queryStub([]);
  });
  t.mock.method(Payment, 'findOne', filter => {
    assert.deepEqual(filter.child, { $in: ['inactive-child-1'] });
    return queryStub(null);
  });
  const res = responseStub();

  await getInvoiceList({ user: { _id: 'parent-1', role: 'parent' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.count, 0);
  assert.equal(res.body.hasPaidInvoices, false);
  assert.equal(res.body.testInvoiceState, 'no-active-children');
  assert.deepEqual(res.body.data, []);
});

test('invoice list explains when prior sandbox invoices consume every active child slot', async t => {
  t.mock.method(Child, 'distinct', async () => ['child-1']);
  t.mock.method(Payment, 'find', filter => filter.sandboxTestInvoice
    ? queryStub([{ child: 'child-1' }])
    : queryStub([]));
  t.mock.method(Payment, 'findOne', () => queryStub(null));
  const res = responseStub();

  await getInvoiceList({ user: { _id: 'parent-1', role: 'parent' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
  assert.equal(res.body.testInvoiceState, 'already-issued');
});

test('teacher invoice lists only include children in the assigned classroom', async t => {
  let invoiceFilter;
  let paidFilter;
  t.mock.method(Classroom, 'findOne', () => queryStub({ _id: 'classroom-1' }));
  t.mock.method(Child, 'distinct', async (_field, filter) => {
    assert.deepEqual(filter, { classroom: 'classroom-1' });
    return ['classroom-child'];
  });
  t.mock.method(Payment, 'find', filter => {
    invoiceFilter = filter;
    return queryStub([]);
  });
  t.mock.method(Payment, 'findOne', filter => {
    paidFilter = filter;
    return queryStub(null);
  });
  const res = responseStub();

  await getInvoiceList({ user: { _id: 'teacher-1', role: 'teacher' } }, res);

  const expectedScope = { child: { $in: ['classroom-child'] } };
  assert.equal(res.statusCode, 200);
  assert.deepEqual(invoiceFilter, {
    ...expectedScope,
    status: { $in: ['pending', 'overdue'] },
    amount: { $gt: 0 },
    $expr: { $gt: [{ $subtract: ['$amount', { $ifNull: ['$amountPaid', 0] }] }, 0] }
  });
  assert.deepEqual(paidFilter, { ...expectedScope, status: 'paid' });
});

test('invoice list reports a clear server error when the database query fails', async t => {
  t.mock.method(Child, 'distinct', async () => ['child-1']);
  t.mock.method(Payment, 'find', () => {
    throw new Error('database connection details must not be exposed');
  });
  t.mock.method(Payment, 'findOne', () => queryStub(null));
  const res = responseStub();

  await getInvoiceList({ user: { _id: 'parent-1', role: 'parent' } }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Could not load invoices/);
  assert.doesNotMatch(res.body.message, /database connection details/);
});

test('test invoice endpoint creates an invoice for an unused active child of the authenticated parent', async t => {
  const previousAllow = process.env.ALLOW_TEST_INVOICES;
  const previousAmount = process.env.CHAPA_TEST_INVOICE_AMOUNT;
  process.env.ALLOW_TEST_INVOICES = 'true';
  process.env.CHAPA_TEST_INVOICE_AMOUNT = '7';
  t.after(() => {
    if (previousAllow === undefined) delete process.env.ALLOW_TEST_INVOICES;
    else process.env.ALLOW_TEST_INVOICES = previousAllow;
    if (previousAmount === undefined) delete process.env.CHAPA_TEST_INVOICE_AMOUNT;
    else process.env.CHAPA_TEST_INVOICE_AMOUNT = previousAmount;
  });

  const parent = { _id: 'parent-1', role: 'parent' };
  const child = { _id: 'child-1' };
  let activeChildFilter;
  let created;
  t.mock.method(User, 'findById', parentId => {
    assert.equal(parentId, parent._id);
    return queryStub(parent);
  });
  t.mock.method(Child, 'find', filter => {
    activeChildFilter = filter;
    return queryStub([child]);
  });
  t.mock.method(Payment, 'find', filter => {
    assert.deepEqual(filter, {
      parent: parent._id,
      child: { $in: [child._id] },
      sandboxTestInvoice: true
    });
    return queryStub([]);
  });
  t.mock.method(Payment, 'create', async document => {
    created = document;
    return { _id: 'test-invoice-1' };
  });
  const savedInvoice = {
    _id: 'test-invoice-1',
    parent: parent._id,
    child: child._id,
    amount: 7,
    amountPaid: 0,
    status: 'pending',
    sandboxTestInvoice: true,
    notes: 'Test invoice for Chapa sandbox checkout only.'
  };
  t.mock.method(Payment, 'findById', () => queryStub(savedInvoice));

  const res = responseStub();
  await generateTestInvoice({
    user: parent,
    params: {},
    body: { parentId: 'another-parent' }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(activeChildFilter, { parents: parent._id, status: 'active' });
  assert.equal(created.parent, parent._id);
  assert.equal(created.child, child._id);
  assert.equal(created.amount, 7);
  assert.match(created.invoiceNumber, /^TEST-[A-F0-9-]{36}$/);
  assert.equal(created.status, 'pending');
  assert.equal(created.amountPaid, undefined);
  assert.equal(created.sandboxTestInvoice, true);
  assert.match(created.notes, /sandbox checkout only/);
  assert.equal(res.body.data._id, savedInvoice._id);
});

test('test invoice can be generated again for a child after its prior test invoice is paid', async t => {
  const previousAllow = process.env.ALLOW_TEST_INVOICES;
  const previousAmount = process.env.CHAPA_TEST_INVOICE_AMOUNT;
  process.env.ALLOW_TEST_INVOICES = 'true';
  process.env.CHAPA_TEST_INVOICE_AMOUNT = '7';
  t.after(() => {
    if (previousAllow === undefined) delete process.env.ALLOW_TEST_INVOICES;
    else process.env.ALLOW_TEST_INVOICES = previousAllow;
    if (previousAmount === undefined) delete process.env.CHAPA_TEST_INVOICE_AMOUNT;
    else process.env.CHAPA_TEST_INVOICE_AMOUNT = previousAmount;
  });

  const parent = { _id: 'parent-1', role: 'parent' };
  let created;
  t.mock.method(User, 'findById', () => queryStub(parent));
  t.mock.method(Child, 'find', () => queryStub([
    { _id: 'newest-child' },
    { _id: 'available-child' }
  ]));
  t.mock.method(Payment, 'find', () => queryStub([{
    _id: 'paid-test-invoice',
    parent: parent._id,
    child: 'newest-child',
    amount: 7,
    amountPaid: 0,
    status: 'paid',
    sandboxTestInvoice: true
  }]));
  t.mock.method(Payment, 'create', async document => {
    created = document;
    return { _id: 'new-test-invoice' };
  });
  t.mock.method(Payment, 'findById', () => queryStub({ _id: 'new-test-invoice' }));

  const res = responseStub();
  await generateTestInvoice({ user: parent, params: {}, body: {} }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(created.child, 'newest-child');
});

test('test invoice generation does not create another invoice for an unsettled prior test invoice', async t => {
  const previousAllow = process.env.ALLOW_TEST_INVOICES;
  const previousAmount = process.env.CHAPA_TEST_INVOICE_AMOUNT;
  process.env.ALLOW_TEST_INVOICES = 'true';
  process.env.CHAPA_TEST_INVOICE_AMOUNT = '7';
  t.after(() => {
    if (previousAllow === undefined) delete process.env.ALLOW_TEST_INVOICES;
    else process.env.ALLOW_TEST_INVOICES = previousAllow;
    if (previousAmount === undefined) delete process.env.CHAPA_TEST_INVOICE_AMOUNT;
    else process.env.CHAPA_TEST_INVOICE_AMOUNT = previousAmount;
  });
  const parent = { _id: 'parent-1', role: 'parent' };
  t.mock.method(User, 'findById', () => queryStub(parent));
  t.mock.method(Child, 'find', () => queryStub([{ _id: 'child-1' }]));
  t.mock.method(Payment, 'find', () => queryStub([{
    parent: parent._id,
    child: 'child-1',
    amount: 7,
    status: 'cancelled',
    sandboxTestInvoice: true
  }]));
  const createInvoice = t.mock.method(Payment, 'create', async () => {
    throw new Error('Duplicate test invoice creation is not allowed.');
  });

  const res = responseStub();
  await generateTestInvoice({ user: parent, params: {}, body: {} }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /unpaid or unsettled sandbox test invoice/);
  assert.equal(createInvoice.mock.callCount(), 0);
});

test('sandbox test invoice index allows settled history but enforces one payable invoice per parent and child', () => {
  const sandboxIndex = Payment.schema.indexes().find(([keys, options]) =>
    keys.parent === 1 &&
    keys.child === 1 &&
    options.unique === true &&
    options.partialFilterExpression?.sandboxTestInvoice === true
  );

  assert.ok(sandboxIndex);
  assert.deepEqual(sandboxIndex[1].partialFilterExpression, {
    sandboxTestInvoice: true,
    status: { $in: ['pending', 'overdue'] }
  });
});

test('a concurrent sandbox invoice request returns the invoice created by the competing request', async t => {
  const previousAllow = process.env.ALLOW_TEST_INVOICES;
  const previousAmount = process.env.CHAPA_TEST_INVOICE_AMOUNT;
  process.env.ALLOW_TEST_INVOICES = 'true';
  process.env.CHAPA_TEST_INVOICE_AMOUNT = '7';
  t.after(() => {
    if (previousAllow === undefined) delete process.env.ALLOW_TEST_INVOICES;
    else process.env.ALLOW_TEST_INVOICES = previousAllow;
    if (previousAmount === undefined) delete process.env.CHAPA_TEST_INVOICE_AMOUNT;
    else process.env.CHAPA_TEST_INVOICE_AMOUNT = previousAmount;
  });
  const parent = { _id: 'parent-1', role: 'parent' };
  const activeInvoice = {
    _id: 'competing-invoice',
    parent: parent._id,
    child: 'child-1',
    amount: 7,
    amountPaid: 0,
    status: 'pending',
    sandboxTestInvoice: true
  };
  t.mock.method(User, 'findById', () => queryStub(parent));
  t.mock.method(Child, 'find', () => queryStub([{ _id: 'child-1' }]));
  t.mock.method(Payment, 'find', () => queryStub([]));
  t.mock.method(Payment, 'create', async () => {
    const error = new Error('A concurrent request already created the payable invoice.');
    error.code = 11000;
    throw error;
  });
  t.mock.method(Payment, 'findOne', filter => {
    assert.deepEqual(filter, {
      parent: parent._id,
      child: 'child-1',
      sandboxTestInvoice: true,
      status: { $in: ['pending', 'overdue'] }
    });
    return queryStub(activeInvoice);
  });

  const res = responseStub();
  await generateTestInvoice({ user: parent, params: {}, body: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.alreadyUsed, true);
  assert.equal(res.body.data._id, activeInvoice._id);
});

test('test invoice generation is unavailable unless a non-production Chapa test invoice is explicitly configured', async t => {
  const previousAllow = process.env.ALLOW_TEST_INVOICES;
  const previousAmount = process.env.CHAPA_TEST_INVOICE_AMOUNT;
  delete process.env.ALLOW_TEST_INVOICES;
  process.env.CHAPA_TEST_INVOICE_AMOUNT = '7';
  t.after(() => {
    if (previousAllow === undefined) delete process.env.ALLOW_TEST_INVOICES;
    else process.env.ALLOW_TEST_INVOICES = previousAllow;
    if (previousAmount === undefined) delete process.env.CHAPA_TEST_INVOICE_AMOUNT;
    else process.env.CHAPA_TEST_INVOICE_AMOUNT = previousAmount;
  });
  const parentLookup = t.mock.method(User, 'findById', () => {
    throw new Error('Disabled test invoice generation must not query the database.');
  });

  const res = responseStub();
  await generateTestInvoice({
    user: { _id: 'parent-1', role: 'parent' },
    params: {},
    body: {}
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'TEST_INVOICE_DISABLED');
  assert.match(res.body.message, /ALLOW_TEST_INVOICES=true/);
  assert.equal(parentLookup.mock.callCount(), 0);
});

test('test invoice endpoint reports a useful sanitized database error to the parent', async t => {
  const previousAllow = process.env.ALLOW_TEST_INVOICES;
  const previousAmount = process.env.CHAPA_TEST_INVOICE_AMOUNT;
  process.env.ALLOW_TEST_INVOICES = 'true';
  process.env.CHAPA_TEST_INVOICE_AMOUNT = '7';
  t.after(() => {
    if (previousAllow === undefined) delete process.env.ALLOW_TEST_INVOICES;
    else process.env.ALLOW_TEST_INVOICES = previousAllow;
    if (previousAmount === undefined) delete process.env.CHAPA_TEST_INVOICE_AMOUNT;
    else process.env.CHAPA_TEST_INVOICE_AMOUNT = previousAmount;
  });

  const parent = { _id: 'parent-1', role: 'parent' };
  t.mock.method(User, 'findById', () => queryStub(parent));
  t.mock.method(Child, 'find', () => queryStub([{ _id: 'child-1' }]));
  t.mock.method(Payment, 'find', () => queryStub([]));
  t.mock.method(Payment, 'create', async () => {
    const error = new Error('Database failure for mongodb+srv://dbuser:dbpassword@cluster.example/daycare CHAPA_SECRET_KEY=hidden-secret');
    error.name = 'DatabaseError';
    throw error;
  });

  const res = responseStub();
  await generateTestInvoice({ user: parent, params: {}, body: {} }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.code, 'TEST_INVOICE_FAILURE');
  assert.equal(res.body.stage, 'invoice creation');
  assert.match(res.body.message, /MongoDB connection redacted/);
  assert.match(res.body.message, /Chapa secret redacted/);
  assert.doesNotMatch(res.body.message, /dbpassword|hidden-secret/);
});

test('test invoice generation returns an existing invoice rather than creating a duplicate', async t => {
  const previousAllow = process.env.ALLOW_TEST_INVOICES;
  const previousAmount = process.env.CHAPA_TEST_INVOICE_AMOUNT;
  process.env.ALLOW_TEST_INVOICES = 'true';
  process.env.CHAPA_TEST_INVOICE_AMOUNT = '7';
  t.after(() => {
    if (previousAllow === undefined) delete process.env.ALLOW_TEST_INVOICES;
    else process.env.ALLOW_TEST_INVOICES = previousAllow;
    if (previousAmount === undefined) delete process.env.CHAPA_TEST_INVOICE_AMOUNT;
    else process.env.CHAPA_TEST_INVOICE_AMOUNT = previousAmount;
  });
  const existing = {
    _id: 'existing-test-invoice',
    status: 'pending',
    amount: 7,
    amountPaid: 0,
    sandboxTestInvoice: true
  };
  t.mock.method(User, 'findById', () => queryStub({ _id: 'parent-1' }));
  t.mock.method(Child, 'find', () => queryStub([{ _id: 'child-1' }]));
  t.mock.method(Payment, 'find', () => queryStub([existing]));
  const createInvoice = t.mock.method(Payment, 'create', async () => {
    throw new Error('Duplicate test invoice creation is not allowed.');
  });

  const res = responseStub();
  await generateTestInvoice({
    user: { _id: 'parent-1', role: 'parent' },
    params: {},
    body: {}
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.alreadyUsed, true);
  assert.equal(res.body.data._id, existing._id);
  assert.equal(createInvoice.mock.callCount(), 0);
});

test('non-parent roles cannot create a test invoice', async t => {
  const parentLookup = t.mock.method(User, 'findById', () => {
    throw new Error('Unauthorized test invoice request must not query users.');
  });
  const res = responseStub();

  await generateTestInvoice({
    user: { _id: 'teacher-1', role: 'teacher' },
    params: {},
    body: {}
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(parentLookup.mock.callCount(), 0);
});

test('teacher payment and receipt access is scoped to the assigned classroom', async t => {
  const paymentFilters = [];
  const detailFilters = [];
  t.mock.method(Classroom, 'findOne', () => queryStub({ _id: 'classroom-1' }));
  t.mock.method(Child, 'distinct', async () => ['classroom-child']);
  t.mock.method(Payment, 'find', filter => {
    paymentFilters.push(filter);
    return queryStub([]);
  });
  t.mock.method(Payment, 'findOne', filter => {
    detailFilters.push(filter);
    return queryStub(null);
  });

  const historyResponse = responseStub();
  await getPayments({ user: { _id: 'teacher-1', role: 'teacher' }, query: {} }, historyResponse);
  const detailResponse = responseStub();
  await getPayment({
    params: { id: '507f1f77bcf86cd799439011' },
    user: { _id: 'teacher-1', role: 'teacher' }
  }, detailResponse);
  const receiptListResponse = responseStub();
  await getReceipts({ user: { _id: 'teacher-1', role: 'teacher' } }, receiptListResponse);
  const receiptDetailResponse = responseStub();
  await getReceiptById({
    params: { id: '507f1f77bcf86cd799439011' },
    user: { _id: 'teacher-1', role: 'teacher' }
  }, receiptDetailResponse);

  const expectedScope = { child: { $in: ['classroom-child'] } };
  assert.deepEqual(paymentFilters, [
    expectedScope,
    { ...expectedScope, status: 'paid' }
  ]);
  assert.deepEqual(detailFilters, [
    { _id: '507f1f77bcf86cd799439011', ...expectedScope },
    { _id: '507f1f77bcf86cd799439011', ...expectedScope }
  ]);
  assert.equal(receiptListResponse.statusCode, 200);
  assert.equal(receiptDetailResponse.statusCode, 404);
  assert.equal(detailResponse.statusCode, 404);
});

test('payment list reports recorded partial payments and outstanding balances', async t => {
  t.mock.method(Payment, 'find', () => queryStub([
    { _id: 'partial', amount: 100, amountPaid: 35, status: 'pending' },
    { _id: 'paid', amount: 80, amountPaid: 80, status: 'paid' }
  ]));
  const res = responseStub();

  await getPayments({
    user: { _id: 'admin-1', role: 'admin' },
    query: {}
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.map(({ amountPaid, outstandingBalance }) => ({
    amountPaid,
    outstandingBalance
  })), [
    { amountPaid: 35, outstandingBalance: 65 },
    { amountPaid: 80, outstandingBalance: 0 }
  ]);
  assert.deepEqual(res.body.stats, {
    totalPaid: 115,
    totalPending: 65,
    totalOverdue: 0
  });
});

test('payment summary returns invoice counts and collected partial balances', async t => {
  t.mock.method(Payment, 'aggregate', () => ({
    option: async () => [
      { _id: 'paid', total: 100, collected: 100, count: 1, unpaidCount: 0, partiallyPaidCount: 0 },
      { _id: 'pending', total: 200, collected: 25, count: 2, unpaidCount: 1, partiallyPaidCount: 1 },
      { _id: 'overdue', total: 50, collected: 0, count: 1, unpaidCount: 1, partiallyPaidCount: 0 }
    ]
  }));
  t.mock.method(Payment, 'find', () => queryStub([]));
  const res = responseStub();

  await getPaymentSummary({
    user: { _id: 'admin-1', role: 'admin' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.stats, {
    totalPaid: 100,
    totalCollected: 125,
    totalPending: 200,
    totalOverdue: 50,
    totalInvoices: 4,
    paidInvoices: 1,
    unpaidInvoices: 2,
    partiallyPaidInvoices: 1
  });
});

test('payment status lookup is scoped to the authenticated parent', async t => {
  let filter;
  let selectedFields;
  t.mock.method(Payment, 'findOne', receivedFilter => {
    filter = receivedFilter;
    return {
      select(fields) {
        selectedFields = fields;
        return { lean: async () => ({
          _id: 'invoice-1',
          parent: 'parent-1',
          status: 'pending',
          chapaStatus: 'pending',
          chapaCheckoutUrl: 'https://checkout.chapa.co/checkout/example'
        }) };
      }
    };
  });
  const res = responseStub();

  await getPaymentStatus({
    params: { id: '507f1f77bcf86cd799439011' },
    user: { _id: 'parent-1', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(filter, { _id: '507f1f77bcf86cd799439011', parent: 'parent-1' });
  assert.equal(res.body.data.status, 'pending');
  assert.match(selectedFields, /verifiedAt/);
  assert.equal(res.body.data.chapaInitialized, true);
  assert.equal(res.body.data.chapaCheckoutUrl, undefined);
});

test('parent receipt history is restricted to confirmed receipts owned by that parent', async t => {
  let filter;
  const receipt = { ...invoiceForParent(), status: 'paid', receiptNumber: 'RCT-INV-00001' };
  t.mock.method(Payment, 'find', receivedFilter => {
    filter = receivedFilter;
    return queryStub([receipt]);
  });
  const res = responseStub();

  await getReceipts({ user: { _id: 'parent-1', role: 'parent' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(filter, { status: 'paid', parent: 'parent-1' });
  assert.deepEqual(res.body.data, [{
    ...receipt,
    amountPaid: receipt.amount,
    outstandingBalance: 0
  }]);
});

test('parent cannot retrieve another parent receipt by ID', async t => {
  let filter;
  t.mock.method(Payment, 'findOne', receivedFilter => {
    filter = receivedFilter;
    return queryStub(null);
  });
  const res = responseStub();

  await getReceiptById({
    params: { id: '507f1f77bcf86cd799439011' },
    user: { _id: 'parent-1', role: 'parent' }
  }, res);

  assert.deepEqual(filter, {
    _id: '507f1f77bcf86cd799439011',
    parent: 'parent-1'
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
});

test('transaction and receipt unique indexes ignore null defaults', () => {
  const indexes = Payment.schema.indexes();
  const txRefIndex = indexes.find(([keys]) => keys.chapaTxRef);
  const receiptIndex = indexes.find(([keys]) => keys.receiptNumber);

  assert.deepEqual(txRefIndex?.[1]?.partialFilterExpression, {
    chapaTxRef: { $type: 'string', $gt: '' }
  });
  assert.deepEqual(receiptIndex?.[1]?.partialFilterExpression, {
    receiptNumber: { $type: 'string', $gt: '' }
  });
  assert.equal(txRefIndex?.[1]?.sparse, undefined);
  assert.equal(receiptIndex?.[1]?.sparse, undefined);
});
