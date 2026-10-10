const SystemSetting = require('../models/SystemSetting');
const Payment = require('../models/Payment');

const checkPaymentStatus = async (req, res, next) => {
  try {
    const settings = await SystemSetting.findOne();
    const isFreeMode = settings ? settings.isFreeMode : false;

    // 1. If Free Mode is ON, bypass validation
    if (isFreeMode) {
      return next();
    }

    // 2. If Payment Mode is ON, check if parent has overdue/pending payments
    // Ensure the route applying this middleware knows user role
    if (req.user && req.user.role === 'parent') {
      const pendingPayment = await Payment.findOne({
        parent: req.user._id,
        status: { $in: ['pending', 'overdue', 'unpaid'] }
      });

      if (pendingPayment) {
        return res.status(402).json({
          success: false,
          message: 'Payment Required: Please settle your outstanding invoices to access this feature.',
          paymentRequired: true
        });
      }
    }

    next();
  } catch (error) {
    console.error('Payment middleware error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = checkPaymentStatus;
