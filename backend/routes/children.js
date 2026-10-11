const express = require('express');
const router = express.Router();
const { getChildren, getChild, createChild, updateChild, deleteChild, assignClassroom, approveChild, disapproveChild, updateChildAvatar } = require('../controllers/childController');
const avatarUpload = require('../middleware/avatarUpload');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getChildren)
  .post(authorize('admin', 'reception', 'parent'), createChild);

// Specific sub-resource routes MUST come before the generic /:id route
router.put('/:id/classroom', authorize('admin'), assignClassroom);
// Upload child avatar (parents allowed for their own children)
router.put('/:id/avatar', authorize('admin', 'reception', 'parent', 'teacher'), avatarUpload.single('avatar'), updateChildAvatar);
router.put('/:id/approve', authorize('admin'), approveChild);
router.put('/:id/disapprove', authorize('admin'), disapproveChild);

router.route('/:id')
  .get(getChild)
  .put(authorize('admin', 'reception', 'teacher'), updateChild)
  .delete(authorize('admin', 'reception'), deleteChild);

module.exports = router;
