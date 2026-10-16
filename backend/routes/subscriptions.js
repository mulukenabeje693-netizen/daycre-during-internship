const express = require('express');
const { getMySubscription, startTrial } = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect, authorize('parent'));
router.get('/me', getMySubscription);
router.post('/trial', startTrial);

module.exports = router;
