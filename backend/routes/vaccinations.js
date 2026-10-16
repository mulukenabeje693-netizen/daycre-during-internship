const express = require('express');
const router = express.Router();
const {
  getVaccinations,
  createVaccination,
  updateVaccination,
  deleteVaccination
} = require('../controllers/vaccinationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', authorize('admin', 'reception', 'teacher', 'parent'), getVaccinations);
router.post('/', authorize('admin', 'reception', 'teacher'), createVaccination);

router.put('/:childId/:logId', authorize('admin', 'reception', 'teacher'), updateVaccination);
router.delete('/:childId/:logId', authorize('admin', 'reception', 'teacher'), deleteVaccination);

module.exports = router;
