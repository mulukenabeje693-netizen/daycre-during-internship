const mongoose = require('mongoose');

const teacherAttendanceSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
  },
  status: {
    type: String,
    enum: ['present', 'late', 'absent', 'on-leave'],
    required: true,
    default: 'absent'
  },
  checkIn: {
    type: String,
    default: '-'
  },
  checkOut: {
    type: String,
    default: '-'
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  note: {
    type: String
  }
}, {
  timestamps: true
});

// Compound index to ensure one record per teacher per day
teacherAttendanceSchema.index({ teacher: 1, date: 1 }, { unique: true });
// Standalone date index for the range query in getTodayAttendance
teacherAttendanceSchema.index({ date: 1 });

module.exports = mongoose.model('TeacherAttendance', teacherAttendanceSchema);
