const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    onlinePaymentsEnabled: {
      type: Boolean,
      default: false
    },
    isFreeMode: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
