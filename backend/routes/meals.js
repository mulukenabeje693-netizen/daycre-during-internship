const express = require('express');
const router = express.Router();
const { getMeals, getMealStudents, createMeal, updateMeal, deleteMeal, recordMealIntake } = require('../controllers/mealController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/students', authorize('admin', 'staff', 'teacher'), getMealStudents);

router.route('/')
  .get(authorize('admin', 'staff', 'teacher', 'reception', 'parent'), getMeals)
  .post(authorize('admin', 'staff', 'teacher'), createMeal);

router.put('/:id/intake', authorize('admin', 'staff', 'teacher'), recordMealIntake);

router.route('/:id')
  .put(authorize('admin', 'staff', 'teacher'), updateMeal)
  .delete(authorize('admin', 'staff', 'teacher'), deleteMeal);

module.exports = router;
