const express = require('express');
const router = express.Router();
const { getAppointments, getAppointment, createAppointment, updateAppointment, deleteAppointment, getUpcoming } = require('../controllers/appointmentController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/upcoming', getUpcoming);

router.route('/')
  .get(getAppointments)
  .post(createAppointment);

router.route('/:id')
  .get(getAppointment)
  .put(updateAppointment)
  .delete(deleteAppointment);

module.exports = router;
