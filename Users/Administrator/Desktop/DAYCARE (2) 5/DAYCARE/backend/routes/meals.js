const express = require('express');
const router = express.Router();
const { getMeals, createMeal, updateMeal, deleteMeal } = require('../controllers/mealController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getMeals)
  .post(authorize('admin', 'staff', 'teacher'), createMeal);

router.route('/:id')
  .put(authorize('admin', 'staff', 'teacher'), updateMeal)
  .delete(authorize('admin', 'staff', 'teacher'), deleteMeal);

module.exports = router;
