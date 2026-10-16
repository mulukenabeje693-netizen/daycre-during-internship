const express = require('express');
const router = express.Router();
const { getStaff, getStaffMember, updateStaff, deleteStaff, getParents, getParentOptions, assignChildToParent, getAdminStats, approveParent, disapproveParent, getStaffContacts, toggleBlockParent } = require('../controllers/staffController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/contacts', getStaffContacts);
router.use(authorize('admin', 'reception'));

router.get('/admin-stats', getAdminStats);
router.get('/parents/options', getParentOptions);
router.get('/parents', getParents);
router.put('/parents/:parentId/assign-child', assignChildToParent);
router.put('/parents/:parentId/approve', approveParent);
router.put('/parents/:parentId/disapprove', disapproveParent);
router.put('/parents/:parentId/block', authorize('admin'), toggleBlockParent);

router.route('/')
  .get(getStaff);

router.route('/:id')
  .get(getStaffMember)
  .put(authorize('admin', 'reception'), updateStaff)
  .delete(authorize('admin', 'reception'), deleteStaff);

module.exports = router;
