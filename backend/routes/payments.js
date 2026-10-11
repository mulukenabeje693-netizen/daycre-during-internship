const express = require('express');
const router = express.Router();
const { getPayments, getPayment, getPaymentSummary, createPayment, markAsPaid, parentPay, updatePayment, deletePayment, checkOverdue, chapaInitialize, chapaVerify, generateTestInvoice, chapaWebhook, chapaVerifyFallback } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

// Webhook MUST be before protect middleware
router.post('/chapa-webhook', chapaWebhook);

router.use(protect);

router.put('/check-overdue', authorize('admin'), checkOverdue);
router.get('/summary', authorize('admin', 'staff', 'reception', 'teacher', 'parent'), getPaymentSummary);
router.post('/chapa-verify',    authorize('parent'), chapaVerify);
router.post('/generate-test',   authorize('parent'), generateTestInvoice);
router.get('/verify/:tx_ref', authorize('admin', 'staff', 'reception'), chapaVerifyFallback);

router.route('/')
  .get(getPayments)
  .post(authorize('admin', 'staff', 'reception', 'parent'), createPayment);

router.route('/:id')
  .get(getPayment)
  .put(authorize('admin', 'staff', 'reception'), updatePayment)
  .delete(authorize('admin'), deletePayment);

router.put('/:id/pay',        authorize('admin', 'staff', 'reception'), markAsPaid);
router.put('/:id/parent-pay', authorize('parent'), parentPay);
router.post('/:id/chapa-init', authorize('parent'), chapaInitialize);

module.exports = router;
