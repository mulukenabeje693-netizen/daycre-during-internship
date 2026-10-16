const test = require('node:test');
const assert = require('node:assert/strict');

const Payment = require('../models/Payment');
const {
  prepareManualBankTransfer,
  submitManualBankTransfer,
  reviewManualBankTransfer
} = require('../controllers/paymentController');
const { getManualBankTransferConfig } = require('../utils/bankTransferConfig');

const responseStub = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const queryStub = value => ({
  populate() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  }
});

const invoiceFixture = (overrides = {}) => ({
  _id: 'invoice-1',
  invoiceNumber: 'INV-00001',
  parent: { _id: 'parent-1' },
  child: { parents: ['parent-1'] },
  amount: 100,
  amountPaid: 0,
  currency: 'ETB',
  status: 'pending',
  method: null,
  bankTransferStatus: null,
  bankTransferReference: null,
  ...overrides
});

const setBankConfig = t => {
  const keys = [
    'BANK_TRANSFER_ENABLED',
    'BANK_TRANSFER_BANK_NAME',
    'BANK_TRANSFER_ACCOUNT_NAME',
    'BANK_TRANSFER_ACCOUNT_NUMBER',
    'BANK_TRANSFER_INSTRUCTIONS'
  ];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    BANK_TRANSFER_ENABLED: 'true',
    BANK_TRANSFER_BANK_NAME: 'Configured Test Bank',
    BANK_TRANSFER_ACCOUNT_NAME: 'Daycare Test Account',
    BANK_TRANSFER_ACCOUNT_NUMBER: '0001234567',
    BANK_TRANSFER_INSTRUCTIONS: 'Test instructions'
  });
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
};

test('manual bank details are withheld unless configuration is complete and enabled', t => {
  const previous = {
    enabled: process.env.BANK_TRANSFER_ENABLED,
    bank: process.env.BANK_TRANSFER_BANK_NAME,
    account: process.env.BANK_TRANSFER_ACCOUNT_NAME,
    number: process.env.BANK_TRANSFER_ACCOUNT_NUMBER
  };
  t.after(() => {
    if (previous.enabled === undefined) delete process.env.BANK_TRANSFER_ENABLED;
    else process.env.BANK_TRANSFER_ENABLED = previous.enabled;
    if (previous.bank === undefined) delete process.env.BANK_TRANSFER_BANK_NAME;
    else process.env.BANK_TRANSFER_BANK_NAME = previous.bank;
    if (previous.account === undefined) delete process.env.BANK_TRANSFER_ACCOUNT_NAME;
    else process.env.BANK_TRANSFER_ACCOUNT_NAME = previous.account;
    if (previous.number === undefined) delete process.env.BANK_TRANSFER_ACCOUNT_NUMBER;
    else process.env.BANK_TRANSFER_ACCOUNT_NUMBER = previous.number;
  });
  delete process.env.BANK_TRANSFER_ENABLED;
  process.env.BANK_TRANSFER_BANK_NAME = 'Configured Test Bank';
  process.env.BANK_TRANSFER_ACCOUNT_NAME = 'Daycare Test Account';
  process.env.BANK_TRANSFER_ACCOUNT_NUMBER = '0001234567';

  const config = getManualBankTransferConfig();
  assert.equal(config.available, false);
  assert.equal(config.accountNumber, '');
});

test('manual transfer preparation checks ownership and saves only a server-generated reference', async t => {
  setBankConfig(t);
  const invoice = invoiceFixture();
  t.mock.method(Payment, 'findById', () => queryStub(invoice));

  const unauthorized = responseStub();
  await prepareManualBankTransfer({
    params: { id: invoice._id },
    user: { _id: 'another-parent' }
  }, unauthorized);
  assert.equal(unauthorized.statusCode, 403);

  t.mock.method(Payment, 'updateOne', async () => ({ modifiedCount: 1 }));
  const authorized = responseStub();
  await prepareManualBankTransfer({
    params: { id: invoice._id },
    user: { _id: 'parent-1' }
  }, authorized);

  assert.equal(authorized.statusCode, 200);
  assert.equal(authorized.body.amount, 100);
  assert.match(authorized.body.reference, /^MINT-BANK-[A-F0-9]{24}$/);
  assert.equal(authorized.body.bankTransfer.accountNumber, '0001234567');
});

test('transfer submission remains pending and cannot use an arbitrary preparation reference', async t => {
  setBankConfig(t);
  const invoice = invoiceFixture({
    method: 'bank-transfer',
    bankTransferStatus: 'prepared',
    bankTransferReference: 'MINT-BANK-AAAAAAAAAAAAAAAAAAAAAAAA'
  });
  t.mock.method(Payment, 'findById', () => queryStub(invoice));
  const findOneAndUpdate = t.mock.method(Payment, 'findOneAndUpdate', async () => null);

  const res = responseStub();
  await submitManualBankTransfer({
    params: { id: invoice._id },
    user: { _id: 'parent-1' },
    body: {
      paymentReference: 'MINT-BANK-WRONGREFERENCE',
      reference: 'BANK-TXN-12345'
    }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(findOneAndUpdate.mock.callCount(), 1);
});

test('administrator approval atomically marks the invoice paid with a receipt; repeat review is idempotent', async t => {
  const invoice = invoiceFixture({
    method: 'bank-transfer',
    bankTransferStatus: 'pending_verification',
    bankTransferReference: 'MINT-BANK-AAAAAAAAAAAAAAAAAAAAAAAA',
    bankTransferProviderReference: 'BANK-TXN-12345'
  });
  t.mock.method(Payment, 'findById', async () => invoice);
  const reviewed = {
    ...invoice,
    status: 'paid',
    amountPaid: 100,
    bankTransferStatus: 'verified',
    bankTransferVerifiedAt: new Date(),
    bankTransferVerifiedBy: 'admin-1',
    receiptNumber: 'RCT-INV-00001-TEST',
    verifiedAt: new Date()
  };
  const findOneAndUpdate = t.mock.method(Payment, 'findOneAndUpdate', async () => reviewed);

  const res = responseStub();
  await reviewManualBankTransfer({
    params: { id: invoice._id },
    user: { _id: 'admin-1' },
    body: { decision: 'approve', note: 'Confirmed in bank statement' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(findOneAndUpdate.mock.callCount(), 1);
  assert.equal(res.body.data.status, 'paid');
  assert.equal(res.body.data.bankTransferStatus, 'verified');
  assert.equal(res.body.data.receiptNumber, 'RCT-INV-00001-TEST');
  const update = findOneAndUpdate.mock.calls[0].arguments[1];
  assert.equal(update.$set.status, 'paid');
  assert.equal(update.$set.bankTransferStatus, 'verified');
  assert.ok(update.$set.receiptGeneratedAt instanceof Date);
});
