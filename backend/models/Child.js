const mongoose = require('mongoose');

const childSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    enrollmentDate: {
      type: Date,
      default: Date.now
    },
    classroom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      default: null
    },
    parents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    parentName: {
      type: String,
      trim: true,
      default: ''
    },
    allergies: {
      type: String,
      trim: true,
      default: ''
    },
    medicalNotes: {
      type: String,
      trim: true,
      default: ''
    },
    vaccinationStatus: {
      type: String,
      enum: ['up-to-date', 'incomplete', 'unknown'],
      default: 'unknown'
    },
    vaccinationLog: [
      {
        name: { type: String, trim: true },
        dateGiven: { type: Date },
        provider: { type: String, trim: true },
        notes: { type: String, trim: true },
        status: { type: String, enum: ['Up to Date', 'Upcoming', 'Overdue'], default: 'Up to Date' },
        givenBy: { type: String, trim: true },
        addedAt: { type: Date, default: Date.now }
      }
    ],
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relationship: { type: String, trim: true }
    },
    photoUrl: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'waitlist', 'pending', 'approved', 'disapproved'],
      default: 'active'
    },
    approvalNote: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual: full name
childSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual: age in years
childSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - new Date(this.dateOfBirth).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

// ── Indexes ────────────────────────────────────────────────
// Critical for parent dashboard: query children by parent array
childSchema.index({ parents: 1 });
// Teacher classroom queries
childSchema.index({ classroom: 1, status: 1 });
// Status-only filter (admin/reception listing)
childSchema.index({ status: 1 });

module.exports = mongoose.model('Child', childSchema);
