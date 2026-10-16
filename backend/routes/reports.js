const express = require('express');
const router = express.Router();
const { getReports, getReport, createReport, updateReport, acknowledgeReport } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getReports)
  .post(authorize('admin', 'teacher'), createReport);

router.route('/:id')
  .get(getReport)
  .put(authorize('admin', 'teacher'), updateReport);

router.put('/:id/acknowledge', authorize('parent'), acknowledgeReport);

module.exports = router;
