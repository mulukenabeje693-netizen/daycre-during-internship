const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const { getSettings, getPaymentMethods, togglePaymentMode, setOnlinePayments } = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');

const paymentSettingsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => req.user?._id ? `user:${req.user._id}` : req.ip,
  message: { success: false, message: 'Too many settings changes. Wait a minute and try again.' }
});

router.get('/', getSettings);
router.get('/payment-methods', protect, authorize('parent'), getPaymentMethods);
router.post('/toggle-payment-mode', protect, authorize('admin'), paymentSettingsRateLimit, togglePaymentMode);
router.put('/online-payments', protect, authorize('admin'), paymentSettingsRateLimit, setOnlinePayments);

module.exports = router;
