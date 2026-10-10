const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema(
  {
    child: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Child',
      required: true
    },
    classroom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true
    },
    date: {
      type: Date,
      required: true,
      default: () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    meals: {
      breakfast: {
        ate: { type: String, enum: ['all', 'most', 'some', 'none', 'n/a'], default: 'n/a' },
        notes: { type: String, default: '' }
      },
      lunch: {
        ate: { type: String, enum: ['all', 'most', 'some', 'none', 'n/a'], default: 'n/a' },
        notes: { type: String, default: '' }
      },
      snack: {
        ate: { type: String, enum: ['all', 'most', 'some', 'none', 'n/a'], default: 'n/a' },
        notes: { type: String, default: '' }
      }
    },
    naps: [
      {
        start: Date,
        end: Date,
        quality: { type: String, enum: ['good', 'fair', 'poor'], default: 'good' }
      }
    ],
    activities: [
      {
        name: String,
        description: String,
        category: {
          type: String,
          enum: ['art', 'music', 'outdoor', 'reading', 'math', 'science', 'social', 'other'],
          default: 'other'
        }
      }
    ],
    mood: {
      type: String,
      enum: ['happy', 'calm', 'tired', 'fussy', 'excited', 'sad', 'cranky', 'sleepy', 'energetic', 'sick'],
      default: 'happy'
    },
    health: {
      temperature: { type: Number, default: null },
      notes: { type: String, default: '' }
    },
    teacherNotes: {
      type: String,
      trim: true,
      default: ''
    },
    parentAcknowledged: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Unique: one report per child per day
dailyReportSchema.index({ child: 1, date: 1 }, { unique: true });
// Fast classroom+date queries (teacher dashboard, report listing)
dailyReportSchema.index({ classroom: 1, date: -1 });
// Fast parent queries by child sorted by date
dailyReportSchema.index({ child: 1, date: -1 });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
