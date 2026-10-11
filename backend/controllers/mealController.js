const Meal = require('../models/Meal');

// @desc    Get all meals
// @route   GET /api/meals
// @access  Private
const getMeals = async (req, res) => {
  try {
    const { date, type, limit } = req.query;
    let query = {};
    if (date) query.date = date;
    if (type) query.type = type;

    const maxLimit = Math.min(parseInt(limit) || 30, 100);

    const meals = await Meal.find(query)
      .select('name type date time items allergies notes createdBy createdAt')
      .populate('createdBy', 'fullName')
      .sort({ date: -1, time: 1 })
      .limit(maxLimit)
      .lean()
      .maxTimeMS(5000);

    return res.status(200).json({
      success: true,
      count: meals.length,
      data: meals
    });
  } catch (error) {
    console.error('getMeals error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch meals',
      data: []
    });
  }
};

// @desc    Create meal
// @route   POST /api/meals
// @access  Private (admin, staff)
const createMeal = async (req, res) => {
  try {
    const meal = await Meal.create({ ...req.body, createdBy: req.user._id });
    const populated = await Meal.findById(meal._id).populate('createdBy', 'fullName').lean();
    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update meal
// @route   PUT /api/meals/:id
// @access  Private (admin, staff)
const updateMeal = async (req, res) => {
  try {
    const meal = await Meal.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('createdBy', 'fullName').lean();

    if (!meal) {
      return res.status(404).json({ success: false, message: 'Meal not found' });
    }

    return res.status(200).json({ success: true, data: meal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete meal
// @route   DELETE /api/meals/:id
// @access  Private (admin, staff)
const deleteMeal = async (req, res) => {
  try {
    const meal = await Meal.findByIdAndDelete(req.params.id);
    if (!meal) {
      return res.status(404).json({ success: false, message: 'Meal not found' });
    }
    return res.status(200).json({ success: true, message: 'Meal deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMeals, createMeal, updateMeal, deleteMeal };
