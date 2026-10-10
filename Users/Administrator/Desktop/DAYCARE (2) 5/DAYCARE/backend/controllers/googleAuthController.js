const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const https  = require('https');

// ── Verify Google ID token by calling Google's tokeninfo endpoint ─────────────
// We avoid the google-auth-library package to keep zero extra dependencies.
const verifyGoogleToken = (idToken) => {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const payload = JSON.parse(data);
          if (payload.error) return reject(new Error(payload.error_description || 'Invalid token'));
          resolve(payload);
        } catch {
          reject(new Error('Failed to parse Google response'));
        }
      });
    }).on('error', reject);
  });
};

// ── Generate JWT ──────────────────────────────────────────────────────────────
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '24h' });

// @desc    Sign in / register via Google ID token
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google ID token is required' });
    }

    // Verify token with Google
    const payload = await verifyGoogleToken(idToken);

    // Validate the audience matches our client ID
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && payload.aud !== clientId) {
      return res.status(401).json({ success: false, message: 'Token audience mismatch' });
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Google account has no email' });
    }

    // Find existing user by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      // Link googleId if they registered manually before
      if (!user.googleId) {
        user.googleId = googleId;
        user.avatar   = user.avatar || picture || null;
        await user.save();
      }
    } else {
      // New user — auto-register as parent
      user = await User.create({
        fullName: name || email.split('@')[0],
        email,
        googleId,
        avatar: picture || null,
        role: 'parent',
        password: null   // OAuth user — no password needed
      });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      token,
      user: {
        id:       user._id,
        _id:      user._id,
        fullName: user.fullName,
        email:    user.email,
        role:     user.role,
        avatar:   user.avatar
      }
    });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ success: false, message: err.message || 'Google authentication failed' });
  }
};

module.exports = { googleAuth };
