const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const {
  getPayments, getPayment, getPaymentSummary, createPayment, markAsPaid, parentPay,
  updatePayment, deletePayment, checkOverdue, generateTestInvoice, getInvoiceList,
  getPaymentStatus, getReceipts, getReceiptById, prepareManualBankTransfer,
  submitManualBankTransfer, getManualBankTransfers, reviewManualBankTransfer
} = require('../controllers/paymentController');
const {
  prepareChapaPayment,
  initializeChapaPayment,
  verifyChapaPayment,
  handleChapaWebhook,
  getPaymentHistory
} = require('../controllers/chapaPaymentController');
const { protect, authorize } = require('../middleware/auth');

const paymentRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => req.user?._id ? `user:${req.user._id}` : req.ip,
  message: { success: false, message: 'Too many payment requests. Wait a minute and try again.' }
});
const verificationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => req.user?._id ? `verification:${req.user._id}` : req.ip,
  handler: (req, res) => {
    const retryAfterSeconds = 60;
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      code: 'PAYMENT_RATE_LIMITED',
      retryAfterSeconds,
      message: 'Verification has been requested too often. Wait one minute before trying again.'
    });
  }
});
const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many webhook requests.'
});

// Webhook MUST be before protect middleware
router.post('/chapa-webhook', webhookRateLimit, handleChapaWebhook);

router.use(protect);

router.put('/check-overdue', authorize('admin'), checkOverdue);
router.get('/summary', authorize('admin', 'staff', 'reception', 'teacher', 'parent'), getPaymentSummary);
router.post('/chapa-verify', authorize('parent'), verificationRateLimit, verifyChapaPayment);
router.post('/generate-test',   authorize('admin', 'parent'), generateTestInvoice);
router.post('/generate-test/:parentId', authorize('admin'), generateTestInvoice);
router.get('/verify/:tx_ref', authorize('admin', 'staff', 'reception', 'parent'), verificationRateLimit, (req, res) => {
  req.body = { ...(req.body || {}), txRef: req.params.tx_ref };
  return verifyChapaPayment(req, res);
});

router.get('/invoices', authorize('admin', 'staff', 'reception', 'teacher', 'parent'), getInvoiceList);
router.get('/history', authorize('admin', 'staff', 'reception', 'parent'), getPaymentHistory);
router.post('/initialize', authorize('parent'), paymentRateLimit, initializeChapaPayment);
router.post('/verify', authorize('parent'), verificationRateLimit, verifyChapaPayment);
router.get('/receipts', authorize('parent', 'admin', 'staff', 'reception', 'teacher'), getReceipts);
router.get('/receipts/:id', authorize('parent', 'admin', 'staff', 'reception', 'teacher'), getReceiptById);
router.get('/manual-transfers', authorize('admin'), getManualBankTransfers);
router.post('/:id/manual-transfer-review', authorize('admin'), paymentRateLimit, reviewManualBankTransfer);
router.get('/:id/status', authorize('parent'), getPaymentStatus);

router.route('/')
  .get(authorize('admin', 'staff', 'reception', 'teacher', 'parent'), getPayments)
  .post(authorize('admin', 'staff', 'reception'), createPayment);

router.route('/:id')
  .get(authorize('admin', 'staff', 'reception', 'teacher', 'parent'), getPayment)
  .put(authorize('admin', 'staff', 'reception'), updatePayment)
  .delete(authorize('admin'), deletePayment);

router.put('/:id/pay',        authorize('admin', 'staff', 'reception'), markAsPaid);
router.put('/:id/parent-pay', authorize('parent'), parentPay);
router.post('/:id/chapa-prepare', authorize('parent'), paymentRateLimit, prepareChapaPayment);
router.post('/:id/chapa-init', authorize('parent'), paymentRateLimit, initializeChapaPayment);
router.post('/:id/bank-transfer/prepare', authorize('parent'), paymentRateLimit, prepareManualBankTransfer);
router.post('/:id/bank-transfer/submit', authorize('parent'), paymentRateLimit, submitManualBankTransfer);

module.exports = router;
