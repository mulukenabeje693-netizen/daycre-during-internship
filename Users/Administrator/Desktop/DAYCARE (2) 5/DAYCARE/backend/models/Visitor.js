const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Visitor name is required'],
      trim: true
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    purpose: {
      type: String,
      required: [true, 'Purpose of visit is required'],
      trim: true
    },
    host: {
      type: String,
      trim: true,
      default: ''
    },
    visitingChild: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Child',
      default: null
    },
    relationship: {
      type: String,
      enum: ['parent', 'guardian', 'relative', 'official', 'vendor', 'other'],
      default: 'other'
    },
    checkIn: {
      type: Date,
      default: Date.now
    },
    checkOut: {
      type: Date,
      default: null
    },
    badgeNumber: {
      type: String,
      trim: true,
      match: [/^\d*$/, 'Badge number must contain digits only'],
      default: ''
    },
    status: {
      type: String,
      enum: ['checked-in', 'checked-out'],
      default: 'checked-in'
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Visitor', visitorSchema);
