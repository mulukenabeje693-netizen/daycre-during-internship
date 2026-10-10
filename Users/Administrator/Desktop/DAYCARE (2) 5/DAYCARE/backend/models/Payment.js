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

// Auto-generate invoice number before saving
paymentSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('Payment').countDocuments();
    this.invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
