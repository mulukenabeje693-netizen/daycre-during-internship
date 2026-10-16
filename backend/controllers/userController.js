const path = require('path');
const fs = require('fs');
const User = require('../models/User');

// @desc    Update user avatar
// @route   POST /api/auth/avatar
// @access  Private
const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Remove previous avatar file if present and stored locally
    if (user.avatar && !user.avatar.startsWith('data:')) {
      try {
        const oldPath = path.join(__dirname, '..', user.avatar.replace(/^\/+/, ''));
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (err) {
        // ignore unlink errors
      }
    }

    // Save as persistent base64 data URL so avatar survives cloud container restarts (Render, etc.)
    const fileBuffer = fs.readFileSync(req.file.path);
    const mimeType = req.file.mimetype || 'image/jpeg';
    user.avatar = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    await user.save();

    // Clean up temporary disk file
    try {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } catch (_) {}

    // Exclude sensitive fields
    const safeUser = user.toObject();
    delete safeUser.password;

    return res.status(200).json({ success: true, user: safeUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update current user's profile
// @route   PATCH /api/auth/me
// @access  Private
const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Fields allowed for all users (personal)
    const personalFields = ['fullName', 'email', 'phone', 'organization'];
    // Work fields allowed only for admin
    const workFields = ['role', 'department', 'location', 'shift', 'employeeId'];

    const updates = {};

    // Apply personal fields
    personalFields.forEach((f) => {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) updates[f] = req.body[f];
    });

    // Apply emergency contact if provided
    if (req.body.emergencyContact && typeof req.body.emergencyContact === 'object') {
      updates.emergencyContact = {
        name:         req.body.emergencyContact.name         || '',
        phone:        req.body.emergencyContact.phone        || '',
        relationship: req.body.emergencyContact.relationship || '',
      };
    }

    // Apply work fields only if requester is admin
    if (req.user.role === 'admin') {
      workFields.forEach((f) => {
        if (Object.prototype.hasOwnProperty.call(req.body, f)) updates[f] = req.body[f];
      });
    }

    // If email is changing, ensure it's normalized
    if (updates.email) updates.email = String(updates.email || '').trim().toLowerCase();

    // Prevent updating avatar via this endpoint
    delete updates.avatar;

    Object.assign(user, updates);
    await user.save();

    const safeUser = user.toObject();
    delete safeUser.password;

    return res.status(200).json({ success: true, user: safeUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change current user's password
// @route   PATCH /api/auth/me/password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both currentPassword and newPassword are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const bcrypt = require('bcryptjs');

    // Fetch user with password field (normally excluded)
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password || '');
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    // Hash the new password once here
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Use updateOne to bypass the pre-save hook (which would double-hash)
    await User.updateOne(
      { _id: req.user._id },
      { $set: { password: hashedPassword } }
    );

    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete current user account
// @route   DELETE /api/auth/me
// @access  Private
const deleteMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Remove avatar file if stored locally
    if (user.avatar) {
      try {
        const avatarPath = path.join(__dirname, '..', user.avatar.replace(/^\/+/, ''));
        if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
      } catch (_) { /* ignore */ }
    }

    await User.findByIdAndDelete(userId);
    return res.status(200).json({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { updateAvatar, updateMe, changePassword, deleteMe };
