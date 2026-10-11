const express = require('express');
const router = express.Router();
const { getSettings, togglePaymentMode } = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getSettings);
router.post('/toggle-payment-mode', protect, authorize('admin'), togglePaymentMode);

module.exports = router;
