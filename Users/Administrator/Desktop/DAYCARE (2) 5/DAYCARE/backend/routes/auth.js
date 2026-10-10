const express = require('express');
const router = express.Router();
const { loginUser, getMe, registerUser, forgotPassword, verifyResetOtp, resetPassword, uploadId, sendRegistrationOtp, verifyRegistrationOtp, checkPhoneAvailability } = require('../controllers/authController');
const { validateId } = require('../controllers/idValidationController');
const { googleAuth } = require('../controllers/googleAuthController');
const { protect } = require('../middleware/auth');
const avatarUpload = require('../middleware/avatarUpload');
const idUpload = require('../middleware/idUpload');
const { updateAvatar, updateMe, changePassword, deleteMe } = require('../controllers/userController');

// Public routes
router.post('/login',    loginUser);
router.post('/register', idUpload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack',  maxCount: 1 },
]), registerUser);
router.post('/google',   googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

// Registration email OTP verification (public — no auth required)
router.post('/send-otp',   sendRegistrationOtp);
router.post('/verify-otp', verifyRegistrationOtp);

// Phone availability check (public — used during registration before account exists)
router.get('/check-phone', checkPhoneAvailability);

// Protected route
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.put('/update-profile', protect, updateMe);

// Returns the list of currently online user IDs (from in-memory socket map)
router.get('/online-users', protect, (req, res) => {
  const connectedUsers = req.app.get('connectedUsers');
  const onlineIds = connectedUsers ? [...connectedUsers.keys()] : [];
  return res.json({ success: true, onlineIds });
});

// Upload avatar
router.post('/avatar', protect, avatarUpload.single('avatar'), updateAvatar);
router.patch('/me', protect, updateMe);
router.patch('/me/password', protect, changePassword);
router.delete('/me', protect, deleteMe);

// Validate a single ID card image via GPT-4o Vision (public — used during registration)
router.post('/validate-id', validateId);

// Upload ID documents (authenticated user only)
router.post(
  '/upload-id',
  protect,
  idUpload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack',  maxCount: 1 },
  ]),
  uploadId
);

module.exports = router;
