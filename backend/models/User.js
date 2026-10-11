const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Please add a full name']
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email'
      ]
    },
    phone: {
      type: String,
      trim: true,
      unique: true,   // system-wide unique constraint — no two users may share the same phone number
      sparse: true,   // allows multiple null/empty values while enforcing uniqueness on real numbers
    },
    organization: {
      type: String,
      trim: true
    },
    password: {
      type: String,
      minlength: 6,
      // Not required for Google OAuth users
      default: null
    },
    googleId: {
      type: String,
      default: null,
      sparse: true
    },
    avatar: {
      type: String,
      default: null
    },
    passwordResetTokenHash: {
      type: String,
      default: null
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null
    },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'parent', 'teacher', 'reception', 'staff'],
      default: 'parent'
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'disapproved', 'resubmitted'],
      default: 'pending'
    },
    approvalNote: {
      type: String,
      trim: true,
      default: ''
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    lastOnline: {
      type: Date,
      default: null
    },
    emergencyContact: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      relationship: { type: String, trim: true, default: '' }
    },
    idFrontUrl: {
      type: String,
      default: null
    },
    idBackUrl: {
      type: String,
      default: null
    },
    idVerifiedAt: {
      type: Date,
      default: null
    },
    isIdVerified: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// ── Indexes ────────────────────────────────────────────────
// Speeds up: role-based countDocuments in admin-stats,
// staff/contacts lookups, and approval-status filters.
userSchema.index({ role: 1 });
userSchema.index({ role: 1, approvalStatus: 1 });

// Hash password before saving (only if password is set and modified)
userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password (safe for OAuth users with no password)
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
