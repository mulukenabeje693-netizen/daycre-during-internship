require('dotenv').config();
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
const connectDB = require('../config/db');
const Payment = require('../models/Payment');
const ChapaPayment = require('../models/ChapaPayment');

const paymentReferenceIndexes = [
  {
    field: 'chapaTxRef',
    key: { chapaTxRef: 1 },
    partialFilterExpression: { chapaTxRef: { $type: 'string', $gt: '' } }
  },
  {
    field: 'receiptNumber',
    key: { receiptNumber: 1 },
    partialFilterExpression: { receiptNumber: { $type: 'string', $gt: '' } }
  }
];

const chapaReferenceIndexes = [
  {
    field: 'merchantReference',
    key: { merchantReference: 1 },
    partialFilterExpression: undefined
  },
  {
    field: 'chapaReference',
    key: { chapaReference: 1 },
    partialFilterExpression: { chapaReference: { $type: 'string', $gt: '' } }
  },
  {
    field: 'receiptNumber',
    key: { receiptNumber: 1 },
    partialFilterExpression: { receiptNumber: { $type: 'string', $gt: '' } }
  },
  {
    field: 'activeInvoice',
    key: { activeInvoice: 1 },
    partialFilterExpression: { activeInvoice: { $type: 'objectId' } },
    valueType: 'objectId'
  }
];

const sandboxInvoiceIndex = {
  key: { parent: 1, child: 1 },
  partialFilterExpression: {
    sandboxTestInvoice: true,
    status: { $in: ['pending', 'overdue'] }
  }
};

const findDuplicates = async (model, field, valueType = 'string') => model.aggregate([
  {
    $match: {
      [field]: valueType === 'string'
        ? { $type: 'string', $gt: '' }
        : { $type: valueType }
    }
  },
  { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
  { $limit: 1 }
]);

const migratePaymentIndexes = async () => {
  await connectDB();
  try {
    for (const index of paymentReferenceIndexes) {
      const duplicates = await findDuplicates(Payment, index.field);
      if (duplicates.length > 0) {
        throw new Error(`Duplicate ${index.field} values exist. Resolve them before migrating payment indexes.`);
      }
    }
    const activeSandboxInvoiceDuplicates = await Payment.aggregate([
      {
        $match: {
          sandboxTestInvoice: true,
          status: { $in: ['pending', 'overdue'] }
        }
      },
      { $group: { _id: { parent: '$parent', child: '$child' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 }
    ]);
    if (activeSandboxInvoiceDuplicates.length > 0) {
      throw new Error('Multiple unpaid sandbox test invoices exist for one parent and child. Resolve them before migrating sandbox invoice indexes.');
    }
    for (const index of chapaReferenceIndexes) {
      const duplicates = await findDuplicates(ChapaPayment, index.field, index.valueType);
      if (duplicates.length > 0) {
        throw new Error(`Duplicate ChapaPayment.${index.field} values exist. Resolve them before migrating payment indexes.`);
      }
    }

    const existingIndexes = await Payment.collection.indexes();
    for (const target of paymentReferenceIndexes) {
      const existing = existingIndexes.find(index =>
        Object.keys(index.key).length === 1 &&
        index.key[target.field] === 1 &&
        index.unique === true
      );
      if (existing && (existing.sparse || JSON.stringify(existing.partialFilterExpression) !== JSON.stringify(target.partialFilterExpression))) {
        await Payment.collection.dropIndex(existing.name);
      }
      await Payment.collection.createIndex(target.key, {
        unique: true,
        partialFilterExpression: target.partialFilterExpression
      });
    }

    const currentIndexes = await Payment.collection.indexes();
    const existingSandboxInvoiceIndex = currentIndexes.find(index =>
      index.unique === true &&
      Object.keys(index.key).length === 2 &&
      index.key.parent === 1 &&
      index.key.child === 1 &&
      index.partialFilterExpression?.sandboxTestInvoice === true
    );
    if (
      existingSandboxInvoiceIndex &&
      JSON.stringify(existingSandboxInvoiceIndex.partialFilterExpression) !==
        JSON.stringify(sandboxInvoiceIndex.partialFilterExpression)
    ) {
      await Payment.collection.dropIndex(existingSandboxInvoiceIndex.name);
    }
    await Payment.collection.createIndex(sandboxInvoiceIndex.key, {
      unique: true,
      partialFilterExpression: sandboxInvoiceIndex.partialFilterExpression
    });

    for (const index of chapaReferenceIndexes) {
      const options = { unique: true };
      if (index.partialFilterExpression) {
        options.partialFilterExpression = index.partialFilterExpression;
      }
      await ChapaPayment.collection.createIndex(index.key, options);
    }

    await ChapaPayment.collection.createIndex({ parent: 1, createdAt: -1 });
    await ChapaPayment.collection.createIndex({ invoice: 1, createdAt: -1 });
    console.info('Invoice, Chapa transaction, and receipt indexes are ready.');
  } finally {
    await mongoose.disconnect();
  }
};

migratePaymentIndexes().catch(error => {
  console.error('Payment index migration failed:', error.message);
  process.exitCode = 1;
});
