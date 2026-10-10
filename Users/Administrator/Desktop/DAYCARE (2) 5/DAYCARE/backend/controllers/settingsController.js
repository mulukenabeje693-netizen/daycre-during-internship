const SystemSetting = require('../models/SystemSetting');

// @desc    Get system settings
// @route   GET /api/settings
// @access  Public (or protected if needed, usually public so frontend knows state)
exports.getSettings = async (req, res) => {
  try {
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({ isFreeMode: false });
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Toggle payment free mode
// @route   POST /api/settings/toggle-payment-mode
// @access  Admin only
exports.togglePaymentMode = async (req, res) => {
  try {
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({ isFreeMode: false });
    }
    settings.isFreeMode = !settings.isFreeMode;
    await settings.save();
    
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Error toggling payment mode:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
