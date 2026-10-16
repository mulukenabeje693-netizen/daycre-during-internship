const mongoose = require('mongoose');

const chapaPaymentSchema = new mongoose.Schema(
  {
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    child: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Child',
      required: true
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true
    },
    activeInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: undefined
    },
    merchantReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 20,
      match: /^MINT-[A-Za-z0-9_-]{1,15}$/
    },
    chapaReference: {
      type: String,
      default: null,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    providerAmountCents: {
      type: Number,
      min: 1,
      validate: {
        validator: value => value === undefined || Number.isSafeInteger(value),
        message: 'Chapa provider amount must be a whole number of cents.'
      },
      default: undefined
    },
    currency: {
      type: String,
      required: true,
      enum: ['ETB'],
      default: 'ETB'
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'success', 'failed', 'cancelled', 'expired', 'incomplete', 'blocked', 'auth_needed', 'unverified'],
      default: 'pending'
    },
    checkoutUrl: {
      type: String,
      default: null
    },
    paymentMethod: {
      type: String,
      default: null
    },
    serviceFee: {
      type: Number,
      min: 0,
      default: null
    },
    mode: {
      type: String,
      enum: ['test', 'live'],
      required: true
    },
    initializedAt: {
      type: Date,
      default: null
    },
    initializationStartedAt: {
      type: Date,
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    providerCreatedAt: {
      type: Date,
      default: null
    },
    providerUpdatedAt: {
      type: Date,
      default: null
    },
    receiptNumber: {
      type: String,
      default: null,
      trim: true
    },
    receiptGeneratedAt: {
      type: Date,
      default: null
    },
    lastWebhookEvent: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

chapaPaymentSchema.index(
  { activeInvoice: 1 },
  {
    unique: true,
    partialFilterExpression: { activeInvoice: { $type: 'objectId' } }
  }
);
chapaPaymentSchema.index(
  { chapaReference: 1 },
  {
    unique: true,
    partialFilterExpression: { chapaReference: { $type: 'string', $gt: '' } }
  }
);
chapaPaymentSchema.index(
  { receiptNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { receiptNumber: { $type: 'string', $gt: '' } }
  }
);
chapaPaymentSchema.index({ parent: 1, createdAt: -1 });
chapaPaymentSchema.index({ invoice: 1, createdAt: -1 });

module.exports = mongoose.model('ChapaPayment', chapaPaymentSchema);
