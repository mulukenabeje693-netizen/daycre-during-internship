const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Meal name is required'],
      trim: true
    },
    type: {
      type: String,
      enum: ['breakfast', 'lunch', 'snack', 'dinner'],
      required: true,
      default: 'lunch'
    },
    date: {
      type: String, // "YYYY-MM-DD" string for easy filtering
      required: true
    },
    time: {
      type: String,
      required: true
    },
    items: {
      type: String,
      required: true
    },
    servings: {
      type: Number,
      min: 1,
      max: 1000
    },
    classroom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      default: null
    },
    allergies: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['scheduled', 'prepared', 'served', 'cancelled'],
      default: 'scheduled'
    },
    children: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Child'
    }],
    intake: [{
      child: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Child',
        required: true
      },
      status: {
        type: String,
        enum: ['eaten', 'partially_eaten', 'not_eaten', 'refused'],
        required: true
      },
      quantity: {
        type: Number,
        min: 0,
        max: 100
      },
      notes: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
      },
      recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      recordedAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// Indexes for fast date & meal type lookups
mealSchema.index({ date: -1, time: 1 });
mealSchema.index({ type: 1, date: -1 });
mealSchema.index({ classroom: 1, date: -1 });

module.exports = mongoose.model('Meal', mealSchema);
