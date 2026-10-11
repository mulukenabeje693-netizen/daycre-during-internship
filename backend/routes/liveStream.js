const express = require('express');
const router = express.Router();
const {
  getLiveStreamRooms,
  updateCameraSettings
} = require('../controllers/liveStreamController');
const { protect } = require('../middleware/auth');

// All live stream routes require an authenticated session
router.use(protect);

// GET /api/live-stream/rooms - Returns rooms filtered strictly by user role
router.get('/rooms', getLiveStreamRooms);

// PUT /api/live-stream/rooms/:id/settings - Update camera privacy or angle
router.put('/rooms/:id/settings', updateCameraSettings);

module.exports = router;
