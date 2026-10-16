const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendOtpEmail, sendVerificationOtp } = require('../utils/emailService');

// Generate JWT Helper
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '24h'
  });
};

// ─── In-memory OTP store for registration email verification ─────────────────
// Map<email, { hash: string, expiresAt: number }>
// Kept in-process (no DB write needed) — expires in 5 minutes.
const registrationOtpStore = new Map();

// ── Phone validation helpers ──────────────────────────────────────────────────
const ETHIO_TELECOM_RE = /^(?:\+251|0)9\d{8}$/;
const SAFARICOM_ET_RE = /^(?:\+251|0)7\d{8}$/;

/**
 * Normalise a phone to +251XXXXXXXXX for equality checks and DB lookups.
 * Returns null when blank/falsy.
 */
function normalizePhone(value) {
  if (!value) return null;
  const v = String(value).trim().replace(/[\s\-]/g, '');
  if (!v) return null;
  if (v.startsWith('+251')) return v;
  if (v.startsWith('251')) return `+${v}`;
  if (v.startsWith('0')) return `+251${v.slice(1)}`;
  return v;
}

/**
 * Validate one Ethiopian phone string.
 * Returns null when valid (or empty/undefined), otherwise an error message string.
 */
function validateEthPhone(value) {
  if (!value || !String(value).trim()) return null; // optional — empty is fine
  const cleaned = String(value).trim().replace(/[\s\-]/g, '');
  if (ETHIO_TELECOM_RE.test(cleaned) || SAFARICOM_ET_RE.test(cleaned)) return null;
  return 'Invalid phone number. Must be a valid Ethio Telecom (09…) or Safaricom (07…) 10-digit number.';
}

// @desc    Check whether a phone number is already registered in the system
// @route   GET /api/auth/check-phone?phone=09XXXXXXXX[&excludeId=<userId>]
// @access  Public (used during registration before account exists)
//          Pass `excludeId` when checking from an edit/update flow to avoid
//          flagging the user's own current phone number as "taken".
const checkPhoneAvailability = async (req, res) => {
  try {
    const raw = String(req.query.phone || '').trim();
    if (!raw) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const normalized = normalizePhone(raw);
    if (!normalized) {
      return res.status(400).json({ success: false, available: false, message: 'Invalid phone format.' });
    }

    // Build a regex that matches all stored representations of this number
    // e.g. +251911234567, 0911234567, 251911234567
    const local = normalized.replace(/^\+251/, '0');     // +2519… → 09…
    const intl = normalized.replace(/^\+/, '');          // +251…  → 251…
    const phoneRegex = new RegExp(`^(\\+?${intl}|${local})$`);

    // Build the query — exclude the requester's own document when an ID is supplied
    const excludeId = String(req.query.excludeId || '').trim();
    const baseQuery = {
      $or: [
        { phone: { $regex: phoneRegex } },
        { 'emergencyContact.phone': { $regex: phoneRegex } },
      ],
    };
    if (excludeId) {
      // Only add the exclusion when a valid-looking ObjectId is provided
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(excludeId)) {
        baseQuery._id = { $ne: excludeId };
      }
    }

    // Check primary phone AND emergency contact phone fields
    const existing = await User.findOne(baseQuery).select('_id').lean();

    if (existing) {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'This phone number is already registered in the system. Please use a different phone number.',
      });
    }

    return res.status(200).json({ success: true, available: true });
  } catch (error) {
    console.error('[Auth] checkPhoneAvailability error:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to check phone availability.' });
  }
};

// @desc    Send a 6-digit OTP to verify an email during registration
// @route   POST /api/auth/send-otp
// @access  Public
const sendRegistrationOtp = async (req, res) => {
  try {
    // 1. Input validation
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }

    // 2. Check if email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'A user with this email address already exists' });
    }

    // 3. Generate 6-digit OTP and store its SHA-256 hash (plain OTP only lives in the email)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = crypto.createHash('sha256').update(otp).digest('hex');
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes

    registrationOtpStore.set(email, { hash, expiresAt: expires });

    // 3. Send to the dynamic recipient via the registration verification email template
    console.log('Sending OTP to:', email);
    await sendVerificationOtp(email, otp);

    console.log(`[Auth] Registration OTP sent to: ${email}`);

    // 4. Clean JSON success response
    return res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Nodemailer Send Error:', error);
    if (res.headersSent) return;
    return res.status(500).json({ success: false, message: error.message || 'Failed to send OTP.' });
  }
};

// @desc    Verify the registration OTP entered by the user
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyRegistrationOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const record = registrationOtpStore.get(email);

    if (!record) {
      return res.status(400).json({ success: false, message: 'No OTP was requested for this email. Please request a new code.' });
    }

    if (Date.now() > record.expiresAt) {
      registrationOtpStore.delete(email);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (inputHash !== record.hash) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP code. Please try again.' });
    }

    // Verified — remove from store so it can't be reused
    registrationOtpStore.delete(email);

    console.log(`[Auth] Registration OTP verified for: ${email}`);
    return res.status(200).json({ success: true, message: 'Email verified successfully.' });
  } catch (error) {
    console.error('[Auth] verifyRegistrationOtp error:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to verify OTP.' });
  }
};
// @access  Public
const loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;
    email = String(email || '').trim().toLowerCase();

    console.log(`[Auth] Login attempt for: ${email}`);

    // Validate inputs
    if (!email || !password) {
      console.log('[Auth] Missing email or password');
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    // Check for user with field projection optimization
    const user = await User.findOne({ email })
      .select('fullName email phone role avatar password approvalStatus status isBlocked')
      .maxTimeMS(8000);
    if (!user) {
      console.log(`[Auth] No user found for: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is blocked
    if (user.isBlocked) {
      console.log(`[Auth] Blocked account login attempt for: ${email}`);
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked by the administrator. Please contact the daycare for assistance.'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log(`[Auth] Invalid password for: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    console.log(`[Auth] Login success for: ${email}`);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        avatar: user.avatar || null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { fullName, email, phone, organization, password, role, status } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (status !== undefined && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be active or inactive.' });
    }

    // ── Phone validation ──────────────────────────────────────────────────────
    const primaryPhoneErr = validateEthPhone(phone);
    if (primaryPhoneErr) {
      return res.status(400).json({ success: false, message: `Primary phone: ${primaryPhoneErr}` });
    }

    // Parse emergencyContact — may arrive as a JSON string (multipart/form-data)
    // or as a plain object (application/json).
    let emergencyContact = {};
    if (req.body.emergencyContact) {
      if (typeof req.body.emergencyContact === 'string') {
        try { emergencyContact = JSON.parse(req.body.emergencyContact); } catch (_) { /* ignore malformed */ }
      } else {
        emergencyContact = req.body.emergencyContact;
      }
    }

    const emergencyPhoneErr = validateEthPhone(emergencyContact.phone);
    if (emergencyPhoneErr) {
      return res.status(400).json({ success: false, message: `Emergency contact phone: ${emergencyPhoneErr}` });
    }

    // Duplicate-phone check (format-insensitive)
    const normalizedPrimary = normalizePhone(phone);
    const normalizedEmergency = normalizePhone(emergencyContact.phone);
    if (normalizedPrimary && normalizedEmergency && normalizedPrimary === normalizedEmergency) {
      return res.status(400).json({
        success: false,
        message: 'Emergency contact phone must be different from the primary phone number.'
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Duplicate phone check (system-wide) ──────────────────────────────────
    if (normalizedPrimary) {
      const localPrimary = normalizedPrimary.replace(/^\+251/, '0');
      const intlPrimary = normalizedPrimary.replace(/^\+/, '');
      const primaryRegex = new RegExp(`^(\\+?${intlPrimary}|${localPrimary})$`);
      const phoneConflict = await User.findOne({
        $or: [
          { phone: { $regex: primaryRegex } },
          { 'emergencyContact.phone': { $regex: primaryRegex } },
        ],
      }).select('_id').lean();
      if (phoneConflict) {
        return res.status(400).json({
          success: false,
          message: 'This phone number is already associated with an existing account.',
        });
      }
    }

    if (normalizedEmergency) {
      const localEmerg = normalizedEmergency.replace(/^\+251/, '0');
      const intlEmerg = normalizedEmergency.replace(/^\+/, '');
      const emergRegex = new RegExp(`^(\\+?${intlEmerg}|${localEmerg})$`);
      const emergConflict = await User.findOne({
        $or: [
          { phone: { $regex: emergRegex } },
          { 'emergencyContact.phone': { $regex: emergRegex } },
        ],
      }).select('_id').lean();
      if (emergConflict) {
        return res.status(400).json({
          success: false,
          message: 'The emergency contact phone number is already associated with an existing account.',
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Check if user exists
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists'
      });
    }

    // Build ID image URLs from uploaded files (if any)
    let idFrontUrl = null;
    let idBackUrl = null;
    let idVerifiedAt = null;

    if (req.files?.idFront?.[0]) {
      idFrontUrl = `/uploads/ids/${req.files.idFront[0].filename}`;
    }
    if (req.files?.idBack?.[0]) {
      idBackUrl = `/uploads/ids/${req.files.idBack[0].filename}`;
    }
    if (idFrontUrl && idBackUrl) {
      idVerifiedAt = new Date();
    }

    // For parent registration (self-reg OR reception-created), both ID sides are required
    const isParentReg = (role === 'parent' || !role);
    if (isParentReg && (!idFrontUrl || !idBackUrl)) {
      return res.status(400).json({
        success: false,
        message: 'ID verification is required. Please upload both sides of your ID card to complete registration.'
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      email: normalizedEmail,
      phone,
      organization,
      password,
      role: role || 'parent',
      status: status || 'active',
      emergencyContact,
      idFrontUrl,
      idBackUrl,
      idVerifiedAt,
      isIdVerified: !!(idFrontUrl && idBackUrl),
    });

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || null,
        organization: user.organization,
        role: user.role,
        avatar: user.avatar || null,
        idFrontUrl: user.idFrontUrl,
        idBackUrl: user.idBackUrl,
        idVerifiedAt: user.idVerifiedAt,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    // req.user is populated in the 'protect' middleware
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create a password reset token and email OTP to the user
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  const genericMessage = 'If an account exists for this email, a password reset OTP has been sent.';

  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const user = await User.findOne({ email });

    // If no account exists, return a clear 404 — do NOT send an OTP
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address. Please check your email or register.'
      });
    }

    // Generate a secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store hashed OTP + 15-minute expiry in the database
    user.passwordResetTokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save({ validateBeforeSave: false });

    // Send the OTP to the user's real email address via Gmail SMTP
    try {
      await sendOtpEmail(email, otp);
    } catch (emailError) {
      // Log the real SMTP error so it's visible in the server console
      console.error('[Auth] Failed to send OTP email:', emailError.message);

      // In development, surface the SMTP error to the client so it's easy to debug
      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({
          success: false,
          message: `Email sending failed: ${emailError.message}`,
          hint: 'Make sure EMAIL_USER and EMAIL_PASS are set correctly in your .env file.'
        });
      }

      return res.status(500).json({ success: false, message: 'Unable to send the OTP email. Please try again later.' });
    }

    return res.status(200).json({ success: true, message: genericMessage });
  } catch (error) {
    console.error('[Auth] forgotPassword error:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to process the password reset request.' });
  }
};

// @desc    Verify OTP for password reset
// @route   POST /api/auth/verify-reset-otp
// @access  Public
const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }

    return res.status(200).json({ success: true, token: otp, message: 'OTP verified successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to verify OTP.' });
  }
};

// @desc    Reset a password with a valid token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ success: false, message: 'Use at least 8 characters, including one uppercase letter and one number.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() }
    });

    if (!user) return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });

    user.password = password;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to reset the password.' });
  }
};

// @desc    Upload / replace ID documents for the authenticated user
// @route   POST /api/auth/upload-id
// @access  Private (requires valid JWT)
const uploadId = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!req.files?.idFront?.[0] && !req.files?.idBack?.[0]) {
      return res.status(400).json({
        success: false,
        message: 'At least one ID image (idFront or idBack) is required.'
      });
    }

    // Build URLs for whichever sides were uploaded
    let frontIdUrl = user.idFrontUrl; // keep existing if not replaced
    let backIdUrl = user.idBackUrl;

    if (req.files?.idFront?.[0]) {
      frontIdUrl = `/uploads/ids/${req.files.idFront[0].filename}`;
    }
    if (req.files?.idBack?.[0]) {
      backIdUrl = `/uploads/ids/${req.files.idBack[0].filename}`;
    }

    const bothPresent = !!(frontIdUrl && backIdUrl);

    user.idFrontUrl = frontIdUrl;
    user.idBackUrl = backIdUrl;
    user.isIdVerified = bothPresent;
    user.idVerifiedAt = bothPresent ? new Date() : user.idVerifiedAt;

    await user.save({ validateBeforeSave: false });

    console.log(`[Auth] ID documents saved for user: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: 'ID verification documents saved successfully',
      data: {
        frontIdUrl: user.idFrontUrl,
        backIdUrl: user.idBackUrl,
        isIdVerified: user.isIdVerified,
        idVerifiedAt: user.idVerifiedAt,
      }
    });
  } catch (error) {
    console.error('[Auth] uploadId error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to save ID documents.' });
  }
};

module.exports = {
  loginUser,
  getMe,
  registerUser,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  uploadId,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  checkPhoneAvailability,
};
