const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    isFreeMode: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
