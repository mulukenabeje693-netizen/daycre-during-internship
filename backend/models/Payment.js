const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
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
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null
    },
    invoiceNumber: {
      type: String,
      unique: true
    },
    type: {
      type: String,
      enum: ['monthly-fee', 'registration', 'activity', 'meal', 'other'],
      default: 'monthly-fee'
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: 0
    },
    amountPaid: {
      type: Number,
      min: 0,
      default: 0
    },
    currency: {
      type: String,
      enum: ['ETB'],
      default: 'ETB'
    },
    billingPeriodStart: {
      type: Date,
      default: null
    },
    billingPeriodEnd: {
      type: Date,
      default: null
    },
    dueDate: {
      type: Date,
      required: true
    },
    paidDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'cancelled'],
      default: 'pending'
    },
    method: {
      type: String,
      enum: ['cash', 'card', 'bank-transfer', 'check', 'chapa', 'other'],
      default: null
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    chapaTxRef: {
      type: String,
      default: null
    },
    chapaAmount: {
      type: Number,
      min: 0,
      default: null
    },
    chapaCheckoutUrl: {
      type: String,
      default: null
    },
    chapaInitAttemptedAt: {
      type: Date,
      default: null
    },
    chapaStatus: {
      type: String,
      enum: ['pending', 'processing', 'failed', 'cancelled', 'expired', 'incomplete', 'blocked', 'auth_needed', 'success', 'unverified'],
      default: null
    },
    chapaInitStartedAt: {
      type: Date,
      default: null
    },
    chapaReference: {
      type: String,
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    receiptNumber: {
      type: String,
      default: null
    },
    receiptGeneratedAt: {
      type: Date,
      default: null
    },
    bankTransferReference: {
      type: String,
      default: null,
      trim: true
    },
    bankTransferProviderReference: {
      type: String,
      default: null,
      trim: true
    },
    bankTransferStatus: {
      type: String,
      enum: ['prepared', 'pending_verification', 'verified', 'rejected'],
      default: null
    },
    bankTransferSubmittedAt: {
      type: Date,
      default: null
    },
    bankTransferVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    bankTransferVerifiedAt: {
      type: Date,
      default: null
    },
    bankTransferDecisionNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    bankTransferAudit: [{
      action: {
        type: String,
        enum: ['prepared', 'submitted', 'approved', 'rejected'],
        required: true
      },
      actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      reference: {
        type: String,
        trim: true,
        default: ''
      },
      note: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    mode: {
      type: String,
      enum: ['test', 'live'],
      default: null
    },
    sandboxTestInvoice: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────
// Speeds up: countDocuments by status, payment list by parent,
// overdue checks by dueDate, and the dashboard summary aggregation.
paymentSchema.index({ status: 1 });
paymentSchema.index({ parent: 1 });
paymentSchema.index({ parent: 1, status: 1 });
paymentSchema.index({ dueDate: 1, status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index(
  { parent: 1, child: 1, type: 1, billingPeriodStart: 1 },
  {
    unique: true,
    partialFilterExpression: { billingPeriodStart: { $type: 'date' } }
  }
);
paymentSchema.index(
  { parent: 1, child: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sandboxTestInvoice: true,
      status: { $in: ['pending', 'overdue'] }
    }
  }
);
paymentSchema.index(
  { chapaTxRef: 1 },
  {
    unique: true,
    partialFilterExpression: { chapaTxRef: { $type: 'string', $gt: '' } }
  }
);
paymentSchema.index(
  { receiptNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { receiptNumber: { $type: 'string', $gt: '' } }
  }
);
paymentSchema.index(
  { bankTransferReference: 1 },
  {
    unique: true,
    partialFilterExpression: { bankTransferReference: { $type: 'string', $gt: '' } }
  }
);
paymentSchema.index(
  { bankTransferProviderReference: 1 },
  {
    unique: true,
    partialFilterExpression: { bankTransferProviderReference: { $type: 'string', $gt: '' } }
  }
);

// Auto-generate invoice number before saving
paymentSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('Payment').countDocuments();
    this.invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
