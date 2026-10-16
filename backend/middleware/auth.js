const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - check for valid JWT
const protect = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }

  try {
    req.user = await User.findById(decoded.id)
      .select('fullName email phone role avatar approvalStatus status')
      .lean();
  } catch (error) {
    console.error('Authentication user lookup failed:', error.message);
    return res.status(503).json({
      success: false,
      code: 'AUTH_SERVICE_UNAVAILABLE',
      message: 'Authentication is temporarily unavailable. Please retry without signing in again.'
    });
  }

  if (!req.user) {
    return res.status(401).json({ success: false, message: 'User not found in system' });
  }

  return next();
};

// Restrict access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role (${req.user ? req.user.role : 'guest'}) is not authorized to access this resource`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
