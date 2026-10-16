const SystemSetting = require('../models/SystemSetting');
const { getManualBankTransferConfig } = require('../utils/bankTransferConfig');
const {
  getChapaSandboxInvoiceAmount,
  getChapaEnvironment,
  isChapaConfigured,
  getChapaConfigurationError,
  areOnlinePaymentsEnabledByEnvironment
} = require('../utils/chapaConfig');

const publicPaymentSettings = (settings) => {
  const chapaConfigured = isChapaConfigured();
  const onlinePaymentsEnvironmentEnabled = areOnlinePaymentsEnabledByEnvironment();
  const paymentSettingEnabled = settings.onlinePaymentsEnabled === true;
  const onlinePaymentsEnabled =
    paymentSettingEnabled && chapaConfigured && onlinePaymentsEnvironmentEnabled;
  const onlinePaymentsDisabledReason = onlinePaymentsEnabled
    ? ''
    : !chapaConfigured
      ? getChapaConfigurationError()
      : !onlinePaymentsEnvironmentEnabled
        ? 'Online checkout is blocked by the backend safety setting. Set ONLINE_PAYMENTS_ENABLED=true after validating Chapa configuration.'
        : 'Online payments are disabled by the daycare administrator. Ask an administrator to enable Chapa checkout.';

  return {
    isFreeMode: !onlinePaymentsEnabled,
    paymentSettingEnabled,
    onlinePaymentsEnabled,
    onlinePaymentsEnvironmentEnabled,
    chapaConfigured,
    chapaConfigurationError: getChapaConfigurationError(),
    onlinePaymentsDisabledReason,
    chapaEnvironment: getChapaEnvironment(),
    testInvoiceEnabled:
      getChapaSandboxInvoiceAmount() !== null
  };

};

exports.getPaymentMethods = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: { manualBankTransfer: getManualBankTransferConfig() }
    });
  } catch (error) {
    console.error('Error fetching configured payment methods:', error.message);
    res.status(500).json({ success: false, message: 'Could not load configured payment methods.' });
  }
};

// @desc    Get system settings
// @route   GET /api/settings
// @access  Public (or protected if needed, usually public so frontend knows state)
exports.getSettings = async (req, res) => {
  try {
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({ onlinePaymentsEnabled: false, isFreeMode: true });
    }
    res.status(200).json({ success: true, data: publicPaymentSettings(settings) });
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
      settings = await SystemSetting.create({ onlinePaymentsEnabled: false, isFreeMode: true });
    }
    const enablePayments = settings.onlinePaymentsEnabled !== true;
    if (enablePayments && !isChapaConfigured()) {
      return res.status(503).json({
        success: false,
        message: getChapaConfigurationError()
      });
    }
    if (enablePayments && !areOnlinePaymentsEnabledByEnvironment()) {
      return res.status(503).json({
        success: false,
        message: 'Set ONLINE_PAYMENTS_ENABLED=true on the backend before enabling online payments.'
      });
    }
    settings.onlinePaymentsEnabled = enablePayments;
    settings.isFreeMode = !enablePayments;
    await settings.save();

    res.status(200).json({ success: true, data: publicPaymentSettings(settings) });
  } catch (error) {
    console.error('Error toggling payment mode:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.setOnlinePayments = async (req, res) => {
  try {
    if (typeof req.body?.enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled must be a boolean.' });
    }

    if (req.body.enabled && !isChapaConfigured()) {
      return res.status(503).json({
        success: false,
        message: getChapaConfigurationError()
      });
    }
    if (req.body.enabled && !areOnlinePaymentsEnabledByEnvironment()) {
      return res.status(503).json({
        success: false,
        message: 'Set ONLINE_PAYMENTS_ENABLED=true on the backend before enabling online payments.'
      });
    }

    let settings = await SystemSetting.findOne();
    if (!settings) settings = new SystemSetting({ onlinePaymentsEnabled: false, isFreeMode: true });
    settings.onlinePaymentsEnabled = req.body.enabled;
    settings.isFreeMode = !req.body.enabled;
    await settings.save();

    res.status(200).json({ success: true, data: publicPaymentSettings(settings) });
  } catch (error) {
    console.error('Error updating online payment setting:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
