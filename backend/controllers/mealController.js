const Meal = require('../models/Meal');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const mongoose = require('mongoose');

const MEAL_CHILD_STATUSES = ['active', 'approved'];
const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'];
const MEAL_STATUSES = ['scheduled', 'prepared', 'served', 'cancelled'];
const MEAL_FIELDS = ['name', 'type', 'date', 'time', 'items', 'allergies', 'notes', 'children', 'classroom', 'servings', 'status'];
const INTAKE_STATUSES = ['eaten', 'partially_eaten', 'not_eaten', 'refused'];

const makeError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const parseMealDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const getActiveClassroomIds = async (user, classroomId) => {
  const classroomQuery = { status: 'active' };
  if (user.role === 'teacher') classroomQuery.teacher = user._id;
  if (classroomId) classroomQuery._id = classroomId;
  const classrooms = await Classroom.find(classroomQuery).select('_id').lean();
  return classrooms.map(classroom => classroom._id);
};

const getEligibleMealChildren = async (user, childIds, classroomId) => {
  const classroomIds = await getActiveClassroomIds(user, classroomId);
  if (classroomIds.length === 0) return [];

  const query = {
    classroom: { $in: classroomIds },
    status: { $in: MEAL_CHILD_STATUSES }
  };
  if (childIds) query._id = { $in: childIds };

  return Child.find(query)
    .select('firstName lastName status classroom allergies')
    .populate('classroom', 'name')
    .sort({ lastName: 1, firstName: 1 })
    .lean()
    .maxTimeMS(5000);
};

const validateMealChildren = async (user, value, classroomId) => {
  if (!Array.isArray(value) || value.some(id => !mongoose.Types.ObjectId.isValid(id))) {
    throw makeError(400, 'Select valid children for this meal.');
  }
  if (classroomId && !mongoose.Types.ObjectId.isValid(classroomId)) {
    throw makeError(400, 'Select a valid classroom for this meal.');
  }
  const ids = [...new Set(value.map(String))];
  if (ids.length !== value.length) {
    throw makeError(400, 'A child can only be selected once for a meal.');
  }
  const classroomIds = await getActiveClassroomIds(user, classroomId);
  if (classroomId && classroomIds.length === 0) {
    throw makeError(409, 'The selected classroom is inactive or not assigned to your account.');
  }
  if (ids.length === 0) {
    throw makeError(400, 'Select at least one eligible child for this meal.');
  }
  const children = await getEligibleMealChildren(user, ids, classroomId);
  if (children.length !== ids.length) {
    throw makeError(409, 'One or more selected children are no longer eligible for meal records.');
  }
  return ids;
};

const pickMealFields = body =>
  Object.fromEntries(MEAL_FIELDS.filter(field => Object.hasOwn(body, field)).map(field => [field, body[field]]));

const validateMealFields = (body, { creating = false } = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw makeError(400, 'Submit meal details as a valid object.');
  }
  const data = pickMealFields(body);
  const required = ['name', 'type', 'date', 'time', 'items', 'classroom', 'children'];
  if (creating && required.some(field => !Object.hasOwn(data, field))) {
    throw makeError(400, 'Meal name, type, date, time, menu items, classroom, and at least one child are required.');
  }

  if (Object.hasOwn(data, 'name')) {
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 120) {
      throw makeError(400, 'Enter a meal name between 1 and 120 characters.');
    }
    data.name = data.name.trim();
  }
  if (Object.hasOwn(data, 'type') && !MEAL_TYPES.includes(data.type)) {
    throw makeError(400, 'Select a valid meal type.');
  }
  if (Object.hasOwn(data, 'classroom') && !mongoose.Types.ObjectId.isValid(data.classroom)) {
    throw makeError(400, 'Select a valid classroom for this meal.');
  }
  if (Object.hasOwn(data, 'date') && !parseMealDate(data.date)) {
    throw makeError(400, 'Enter a valid meal date in YYYY-MM-DD format.');
  }
  if (Object.hasOwn(data, 'time') && (typeof data.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time))) {
    throw makeError(400, 'Enter a valid meal time in 24-hour HH:MM format.');
  }
  if (Object.hasOwn(data, 'items')) {
    if (typeof data.items !== 'string' || !data.items.trim() || data.items.trim().length > 2000) {
      throw makeError(400, 'Enter menu items between 1 and 2000 characters.');
    }
    data.items = data.items.trim();
  }
  for (const field of ['allergies', 'notes']) {
    if (Object.hasOwn(data, field)) {
      if (typeof data[field] !== 'string' || data[field].length > 1000) {
        throw makeError(400, `${field === 'allergies' ? 'Allergy information' : 'Preparation notes'} must be at most 1000 characters.`);
      }
      data[field] = data[field].trim();
    }
  }
  if (Object.hasOwn(data, 'servings') && data.servings !== '' && data.servings !== null) {
    const servings = Number(data.servings);
    if (!Number.isInteger(servings) || servings < 1 || servings > 1000) {
      throw makeError(400, 'Servings must be a whole number from 1 to 1000.');
    }
    data.servings = servings;
  } else if (Object.hasOwn(data, 'servings')) {
    delete data.servings;
  }
  if (Object.hasOwn(data, 'status') && !MEAL_STATUSES.includes(data.status)) {
    throw makeError(400, 'Select a valid meal status.');
  }
  return data;
};

const sendMealError = (res, error) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'The meal details contain invalid values.' });
  }
  console.error('Meal operation failed:', { errorName: error.name || 'Error' });
  return res.status(500).json({
    success: false,
    message: 'Could not complete the meal request. Please retry.'
  });
};

const canManageAllMeals = user => ['admin', 'staff'].includes(user.role);
const mealAccessQuery = async user => {
  if (user.role !== 'teacher') return {};
  const children = await getEligibleMealChildren(user);
  return { children: { $in: children.map(child => child._id) } };
};

const validateTeacherMealScope = async (user, meal) => {
  if (user.role !== 'teacher') return;
  const childIds = (meal.children || []).map(child => String(child._id || child));
  await validateMealChildren(user, childIds);
};

// @route GET /api/meals/students
const getMealStudents = async (req, res) => {
  try {
    const classroomId = req.query?.classroomId;
    if (classroomId !== undefined && !mongoose.Types.ObjectId.isValid(classroomId)) {
      throw makeError(400, 'Select a valid classroom.');
    }
    if (classroomId) {
      const accessibleClassrooms = await getActiveClassroomIds(req.user, classroomId);
      if (accessibleClassrooms.length === 0) {
        throw makeError(404, 'This classroom is inactive or is not assigned to your nanny account.');
      }
    }
    const children = await getEligibleMealChildren(req.user, undefined, classroomId);
    return res.status(200).json({
      success: true,
      count: children.length,
      reason: children.length === 0 ? 'no_eligible_children' : undefined,
      data: children
    });
  } catch (error) {
    return sendMealError(res, error);
  }
};

// @route GET /api/meals
const getMeals = async (req, res) => {
  try {
    const { date, dateFrom, dateTo, type, status, limit, childId } = req.query;
    const query = {};
    if (date !== undefined) {
      if (!parseMealDate(date)) throw makeError(400, 'Enter a valid date filter in YYYY-MM-DD format.');
      query.date = date;
    } else {
      if (dateFrom !== undefined) {
        if (!parseMealDate(dateFrom)) throw makeError(400, 'Enter a valid start date filter in YYYY-MM-DD format.');
        query.date = { ...query.date, $gte: dateFrom };
      }
      if (dateTo !== undefined) {
        if (!parseMealDate(dateTo)) throw makeError(400, 'Enter a valid end date filter in YYYY-MM-DD format.');
        query.date = { ...query.date, $lte: dateTo };
      }
      if (dateFrom && dateTo && dateFrom > dateTo) throw makeError(400, 'Start date must be on or before end date.');
    }
    if (type !== undefined) {
      if (!MEAL_TYPES.includes(type)) throw makeError(400, 'Select a valid meal type filter.');
      query.type = type;
    }
    if (status !== undefined) {
      if (!MEAL_STATUSES.includes(status)) throw makeError(400, 'Select a valid meal status filter.');
      if (status === 'scheduled') {
        query.$or = [{ status: 'scheduled' }, { status: { $exists: false } }];
      } else {
        query.status = status;
      }
    }
    const requestedLimit = limit === undefined ? 100 : Number(limit);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) throw makeError(400, 'Meal limit must be a positive whole number.');
    const maxLimit = Math.min(requestedLimit, 500);

    let parentChildren = [];
    if (req.user.role === 'parent') {
      if (childId !== undefined && !mongoose.Types.ObjectId.isValid(childId)) {
        throw makeError(400, 'Select a valid child.');
      }
      const childQuery = { parents: req.user._id };
      if (childId !== undefined) childQuery._id = childId;
      parentChildren = await Child.find(childQuery)
        .select('_id firstName lastName allergies')
        .lean()
        .maxTimeMS(5000);
      if (childId !== undefined && parentChildren.length === 0) {
        throw makeError(404, 'This child is not linked to your parent account.');
      }
      query.children = { $in: parentChildren.map(child => child._id) };
    }

    if (req.user.role === 'teacher') {
      const children = await getEligibleMealChildren(req.user);
      query.children = { $in: children.map(child => child._id) };
    }

    let mealQuery = Meal.find(query)
      .select('name type date time items allergies notes servings status children classroom intake createdBy createdAt')
      .populate('createdBy', 'fullName')
      .populate('intake.recordedBy', 'fullName')
      .populate('classroom', 'name room')
      .sort({ date: -1, time: 1, _id: 1 });
    if (canManageAllMeals(req.user) || req.user.role === 'teacher' || req.user.role === 'parent') {
      const childFields = req.user.role === 'parent'
        ? 'firstName lastName allergies'
        : 'firstName lastName allergies classroom';
      mealQuery = mealQuery.populate('children', childFields)
        .populate('intake.child', 'firstName lastName');
    }
    const meals = await mealQuery
      .limit(maxLimit)
      .lean()
      .maxTimeMS(5000);

    const childVisibleToUser = canManageAllMeals(req.user)
      ? null
      : new Set((req.user.role === 'teacher'
          ? await getEligibleMealChildren(req.user)
          : parentChildren
        ).map(child => String(child._id)));
    const data = meals.map(meal => {
      if (req.user.role === 'parent') {
        const children = (meal.children || []).filter(child =>
          childVisibleToUser.has(String(child._id || child))
        );
        const visibleChildIds = new Set(children.map(child => String(child._id || child)));
        const intake = (meal.intake || [])
          .filter(entry => visibleChildIds.has(String(entry.child?._id || entry.child)))
          .map(({ recordedBy, ...parentIntake }) => ({
            ...parentIntake,
            recordedByName: recordedBy?.fullName || null
          }));
        const { classroom, createdBy, ...parentMeal } = meal;
        return {
          ...parentMeal,
          createdByName: createdBy?.fullName || null,
          children,
          intake
        };
      }
      if (!canManageAllMeals(req.user) && req.user.role !== 'teacher') {
        const { children, intake, ...publicMeal } = meal;
        return publicMeal;
      }
      if (req.user.role === 'teacher') {
        return {
          ...meal,
          children: (meal.children || []).filter(child => childVisibleToUser.has(String(child._id))),
          intake: (meal.intake || []).filter(entry =>
            childVisibleToUser.has(String(entry.child?._id || entry.child))
          )
        };
      }
      return meal;
    });
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    return sendMealError(res, error);
  }
};

// @route POST /api/meals
const createMeal = async (req, res) => {
  try {
    const mealData = validateMealFields(req.body || {}, { creating: true });
    mealData.children = await validateMealChildren(req.user, mealData.children || [], mealData.classroom);
    if (mealData.status && mealData.status !== 'scheduled') {
      throw makeError(400, 'New meals must start with scheduled status.');
    }
    mealData.status = 'scheduled';
    const duplicate = await Meal.findOne({
      name: mealData.name,
      type: mealData.type,
      date: mealData.date,
      time: mealData.time,
      classroom: mealData.classroom || null,
      status: { $ne: 'cancelled' }
    }).select('_id').lean();
    if (duplicate) throw makeError(409, 'An identical meal is already scheduled for this date and time.');

    const meal = await Meal.create({ ...mealData, createdBy: req.user._id });
    const populated = await Meal.findById(meal._id)
      .populate('createdBy', 'fullName')
      .populate('children', 'firstName lastName allergies classroom')
      .populate('classroom', 'name room')
      .lean();
    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    return sendMealError(res, error);
  }
};

// @route PUT /api/meals/:id
const updateMeal = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw makeError(400, 'Invalid meal ID.');
    const updates = validateMealFields(req.body || {});
    if (Object.keys(updates).length === 0) throw makeError(400, 'Provide at least one meal field to update.');
    const targetClassroom = Object.hasOwn(updates, 'classroom') ? updates.classroom : undefined;
    if (Object.hasOwn(updates, 'children')) updates.children = await validateMealChildren(req.user, updates.children, targetClassroom);

    const accessQuery = { _id: req.params.id, ...await mealAccessQuery(req.user) };
    const existing = await Meal.findOne(accessQuery).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Meal not found or not available to edit.' });
    await validateTeacherMealScope(req.user, existing);
    const candidate = { ...existing, ...updates };
    if (Object.hasOwn(updates, 'classroom') || Object.hasOwn(updates, 'children')) {
      const classroomId = candidate.classroom?._id || candidate.classroom;
      updates.children = await validateMealChildren(
        req.user,
        (candidate.children || []).map(child => String(child._id || child)),
        classroomId || undefined
      );
    }
    const nextStatus = candidate.status || 'scheduled';
    const currentStatus = existing.status || 'scheduled';
    const allowedTransitions = {
      scheduled: ['scheduled', 'prepared', 'cancelled'],
      prepared: ['prepared', 'served', 'cancelled'],
      served: ['served'],
      cancelled: ['cancelled', 'scheduled']
    };
    if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
      throw makeError(409, `A meal cannot transition from ${currentStatus} to ${nextStatus}.`);
    }
    if (currentStatus === 'served' && Object.keys(updates).some(field => field !== 'status')) {
      throw makeError(409, 'A served meal cannot be edited.');
    }
    if (currentStatus === 'cancelled' && nextStatus !== 'scheduled' && Object.keys(updates).some(field => field !== 'status')) {
      throw makeError(409, 'A cancelled meal must be restored to scheduled before editing.');
    }

    const duplicate = await Meal.findOne({
      _id: { $ne: existing._id },
      name: candidate.name,
      type: candidate.type,
      date: candidate.date,
      time: candidate.time,
      classroom: candidate.classroom?._id || candidate.classroom || null,
      status: { $ne: 'cancelled' }
    }).select('_id').lean();
    if (duplicate && nextStatus !== 'cancelled') throw makeError(409, 'An identical meal is already scheduled for this date and time.');

    const meal = await Meal.findOneAndUpdate(accessQuery, updates, {
      new: true,
      runValidators: true
    })
      .populate('createdBy', 'fullName')
      .populate('children', 'firstName lastName allergies classroom')
      .populate('classroom', 'name room')
      .populate('intake.child', 'firstName lastName')
      .lean();
    if (!meal) return res.status(404).json({ success: false, message: 'Meal not found or no longer available to edit.' });
    return res.status(200).json({ success: true, data: meal });
  } catch (error) {
    return sendMealError(res, error);
  }
};

// @route DELETE /api/meals/:id
const deleteMeal = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw makeError(400, 'Invalid meal ID.');
    const accessQuery = { _id: req.params.id, ...await mealAccessQuery(req.user) };
    const existing = await Meal.findOne(accessQuery).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Meal not found or not available to delete.' });
    await validateTeacherMealScope(req.user, existing);
    const meal = await Meal.findOneAndDelete(accessQuery);
    if (!meal) return res.status(404).json({ success: false, message: 'Meal no longer exists.' });
    return res.status(200).json({ success: true, message: 'Meal deleted.' });
  } catch (error) {
    return sendMealError(res, error);
  }
};

// @route PUT /api/meals/:id/intake
const recordMealIntake = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw makeError(400, 'Invalid meal ID.');
    if (!Array.isArray(req.body?.records) || req.body.records.length === 0) {
      throw makeError(400, 'Submit at least one child meal-intake record.');
    }

    const meal = await Meal.findById(req.params.id);
    if (!meal) return res.status(404).json({ success: false, message: 'Meal not found.' });
    if (meal.status !== 'served') throw makeError(409, 'Record intake after the meal has been marked served.');

    const mealChildIds = new Set((meal.children || []).map(child => String(child._id || child)));
    const permittedChildren = req.user.role === 'teacher'
      ? new Set((await getEligibleMealChildren(req.user)).map(child => String(child._id)))
      : mealChildIds;
    const normalizedRecords = req.body.records.map(record => {
      if (!record || !mongoose.isValidObjectId(record.childId) || !INTAKE_STATUSES.includes(record.status)) {
        throw makeError(400, 'Each intake entry needs a valid child and intake status.');
      }
      const quantity = record.quantity === '' || record.quantity === undefined || record.quantity === null
        ? undefined
        : Number(record.quantity);
      if (quantity !== undefined && (!Number.isFinite(quantity) || quantity < 0 || quantity > 100)) {
        throw makeError(400, 'Eaten quantity must be a number from 0 to 100 percent.');
      }
      if (record.notes !== undefined && (typeof record.notes !== 'string' || record.notes.length > 500)) {
        throw makeError(400, 'Intake notes must be at most 500 characters.');
      }
      const childId = String(record.childId);
      if (!mealChildIds.has(childId) || !permittedChildren.has(childId)) {
        throw makeError(403, 'You can only record intake for a child assigned to this meal and your authorized classroom.');
      }
      return {
        child: childId,
        status: record.status,
        ...(quantity === undefined ? {} : { quantity }),
        notes: (record.notes || '').trim(),
        recordedBy: req.user._id,
        recordedAt: new Date()
      };
    });
    const recordIds = normalizedRecords.map(record => record.child);
    if (new Set(recordIds).size !== recordIds.length) {
      throw makeError(400, 'Submit only one intake entry per child.');
    }

    const nextIntake = (meal.intake || []).filter(entry =>
      !recordIds.includes(String(entry.child?._id || entry.child))
    );
    nextIntake.push(...normalizedRecords);
    const updated = await Meal.findOneAndUpdate(
      { _id: meal._id, children: { $all: recordIds } },
      { $set: { intake: nextIntake } },
      { new: true, runValidators: true }
    )
      .populate('children', 'firstName lastName allergies classroom')
      .populate('classroom', 'name room')
      .populate('intake.child', 'firstName lastName')
      .lean();
    if (!updated) return res.status(409).json({ success: false, message: 'Meal assignment changed. Refresh and try again.' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return sendMealError(res, error);
  }
};

module.exports = { getMeals, getMealStudents, createMeal, updateMeal, deleteMeal, recordMealIntake };
