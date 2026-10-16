const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    planId: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['trialing', 'active', 'expired', 'past_due', 'cancelled'],
      required: true,
      default: 'trialing'
    },
    trialStartedAt: { type: Date, default: null },
    trialEndsAt: { type: Date, default: null },
    trialUsed: { type: Boolean, default: false },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false }
  },
  { timestamps: true }
);

subscriptionSchema.index({ status: 1, trialEndsAt: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
