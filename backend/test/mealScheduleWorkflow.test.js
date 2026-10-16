const test = require('node:test');
const assert = require('node:assert/strict');
const Meal = require('../models/Meal');
const Classroom = require('../models/Classroom');
const Child = require('../models/Child');
const { authorize } = require('../middleware/auth');
const { getMeals, createMeal, updateMeal, deleteMeal, recordMealIntake } = require('../controllers/mealController');
const mealsRouter = require('../routes/meals');

const teacherId = '507f1f77bcf86cd799439011';
const classroomId = '507f1f77bcf86cd799439012';
const childId = '507f1f77bcf86cd799439013';
const mealId = '507f1f77bcf86cd799439014';
const baseMeal = {
  name: 'Garden Lunch',
  type: 'lunch',
  date: '2026-10-15',
  time: '12:30',
  items: 'Rice and vegetables',
  classroom: classroomId
};

const responseStub = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

const queryList = value => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  limit() { return this; },
  lean() { return this; },
  maxTimeMS() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

const classroomQuery = ids => ({
  select() { return this; },
  lean: async () => ids.map(_id => ({ _id }))
});

const childQuery = value => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  lean() { return this; },
  maxTimeMS() { return Promise.resolve(value); }
});

const simpleChildListQuery = value => ({
  select() { return this; },
  lean() { return this; },
  maxTimeMS() { return Promise.resolve(value); }
});

const eligibleChild = {
  _id: childId,
  firstName: 'Actual',
  lastName: 'Child',
  allergies: 'Peanuts',
  classroom: { _id: classroomId }
};

test('meal staff role permissions exclude parents from meal management', () => {
  const allowStaff = authorize('admin', 'staff', 'teacher');
  const denied = responseStub();
  allowStaff({ user: { role: 'parent' } }, denied, () => assert.fail('Parent must not manage meal schedules.'));
  assert.equal(denied.statusCode, 403);
  let allowed = false;
  allowStaff({ user: { role: 'teacher' } }, responseStub(), () => { allowed = true; });
  assert.equal(allowed, true);
});

test('meal listing is limited to authenticated application roles', () => {
  const route = mealsRouter.stack.find(layer => layer.route?.path === '/');
  assert.ok(route);
  const authorizeList = route.route.stack[0].handle;
  let parentAllowed = false;
  authorizeList({ user: { role: 'parent' } }, responseStub(), () => { parentAllowed = true; });
  assert.equal(parentAllowed, true);
  const denied = responseStub();
  authorizeList({ user: { role: 'unrelated' } }, denied, () => assert.fail('Unknown roles must not access meals.'));
  assert.equal(denied.statusCode, 403);
});

test('meal intake route requires authenticated meal-management roles', () => {
  const route = mealsRouter.stack.find(layer => layer.route?.path === '/:id/intake');
  assert.ok(route);
  const authorizeRole = route.route.stack[0].handle;
  let allowed = false;
  authorizeRole({ user: { role: 'teacher' } }, responseStub(), () => { allowed = true; });
  assert.equal(allowed, true);
  const denied = responseStub();
  authorizeRole({ user: { role: 'parent' } }, denied, () => assert.fail('Parent must not record meal intake.'));
  assert.equal(denied.statusCode, 403);
});

test('meal creation validates required fields, calendar dates, and time', async () => {
  const invalidDate = responseStub();
  await createMeal({
    user: { _id: teacherId, role: 'teacher' },
    body: { ...baseMeal, date: '2026-02-30' }
  }, invalidDate);
  assert.equal(invalidDate.statusCode, 400);

  const invalidTime = responseStub();
  await createMeal({
    user: { _id: teacherId, role: 'teacher' },
    body: { ...baseMeal, time: '25:90' }
  }, invalidTime);
  assert.equal(invalidTime.statusCode, 400);

  const missing = responseStub();
  await createMeal({ user: { _id: teacherId, role: 'teacher' }, body: { name: 'Lunch' } }, missing);
  assert.equal(missing.statusCode, 400);
  const noClassroom = responseStub();
  await createMeal({
    user: { _id: teacherId, role: 'teacher' },
    body: { ...baseMeal, classroom: '', children: [childId] }
  }, noClassroom);
  assert.equal(noClassroom.statusCode, 400);
  assert.match(noClassroom.body.message, /valid classroom/i);
});

test('meal creation persists valid schedule, servings, status default and authorized children', async t => {
  t.mock.method(Classroom, 'find', () => classroomQuery([classroomId]));
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter._id, { $in: [childId] });
    return childQuery([eligibleChild]);
  });
  t.mock.method(Meal, 'findOne', filter => {
    assert.equal(filter.date, baseMeal.date);
    return { select() { return this; }, lean: async () => null };
  });
  let created;
  t.mock.method(Meal, 'create', async value => {
    created = value;
    return { _id: mealId };
  });
  t.mock.method(Meal, 'findById', () => ({
    populate() { return this; },
    lean: async () => ({ ...created, _id: mealId, children: [eligibleChild] })
  }));
  const res = responseStub();

  await createMeal({
    user: { _id: teacherId, role: 'teacher' },
    body: { ...baseMeal, servings: '18', children: [childId], createdBy: 'untrusted' }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(created.createdBy, teacherId);
  assert.equal(created.status, 'scheduled');
  assert.equal(created.servings, 18);
  assert.equal(created.classroom, classroomId);
  assert.deepEqual(created.children, [childId]);
});

test('identical schedule submission returns conflict without creating a duplicate', async t => {
  t.mock.method(Classroom, 'find', () => classroomQuery([classroomId]));
  t.mock.method(Child, 'find', () => childQuery([eligibleChild]));
  t.mock.method(Meal, 'findOne', () => ({
    select() { return this; },
    lean: async () => ({ _id: mealId })
  }));
  const create = t.mock.method(Meal, 'create', async () => assert.fail('Duplicate must not be created.'));
  const res = responseStub();

  await createMeal({ user: { _id: teacherId, role: 'teacher' }, body: { ...baseMeal, children: [childId] } }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(create.mock.callCount(), 0);
});

test('parent meal listing is scoped to linked children and includes only their meal intake', async t => {
  const rows = [{
    _id: mealId,
    name: baseMeal.name,
    classroom: { _id: classroomId, name: 'Private Room' },
    createdBy: { _id: teacherId, fullName: 'Private Nanny' },
    children: [
      { _id: childId, firstName: 'Linked', lastName: 'Child', allergies: 'Peanuts' },
      { _id: '507f1f77bcf86cd799439099', firstName: 'Unlinked', lastName: 'Child' }
    ],
    intake: [
      {
        child: { _id: childId, firstName: 'Linked' },
        status: 'eaten',
        quantity: 100,
        recordedBy: { _id: teacherId, fullName: 'Meal Nanny' },
        recordedAt: new Date('2026-10-15T09:00:00Z')
      },
      { child: { _id: '507f1f77bcf86cd799439099', firstName: 'Unlinked' }, status: 'refused' }
    ]
  }];
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, { parents: '507f1f77bcf86cd799439015' });
    return simpleChildListQuery([{ _id: childId, firstName: 'Linked', lastName: 'Child', allergies: 'Peanuts' }]);
  });
  t.mock.method(Meal, 'find', filter => {
    assert.deepEqual(filter.date, { $gte: '2026-10-15', $lte: '2026-10-20' });
    assert.deepEqual(filter.children, { $in: [childId] });
    return queryList(rows);
  });
  const res = responseStub();
  await getMeals({
    query: { dateFrom: '2026-10-15', dateTo: '2026-10-20', limit: '500' },
    user: { _id: '507f1f77bcf86cd799439015', role: 'parent' }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data[0].children.map(child => child.firstName), ['Linked']);
  assert.deepEqual(res.body.data[0].intake.map(entry => entry.status), ['eaten']);
  assert.equal(Object.hasOwn(res.body.data[0].intake[0], 'recordedBy'), false);
  assert.equal(res.body.data[0].intake[0].recordedByName, 'Meal Nanny');
  assert.equal(res.body.data[0].createdByName, 'Private Nanny');
  assert.equal(Object.hasOwn(res.body.data[0], 'classroom'), false);
  assert.equal(Object.hasOwn(res.body.data[0], 'createdBy'), false);
  assert.equal(res.body.data[0].intake.length, 1);

  const invalid = responseStub();
  await getMeals({
    query: { dateFrom: '2026-10-21', dateTo: '2026-10-20' },
    user: { _id: '507f1f77bcf86cd799439015', role: 'parent' }
  }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test('parent meal listing returns a successful empty state when no meal belongs to linked children', async t => {
  t.mock.method(Child, 'find', () => simpleChildListQuery([{ _id: childId }]));
  t.mock.method(Meal, 'find', filter => {
    assert.deepEqual(filter.children, { $in: [childId] });
    return queryList([]);
  });
  const res = responseStub();

  await getMeals({
    query: {},
    user: { _id: '507f1f77bcf86cd799439015', role: 'parent' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 0);
  assert.deepEqual(res.body.data, []);
});

test('parent cannot request meal data for a child not linked to their account', async t => {
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      parents: '507f1f77bcf86cd799439015',
      _id: '507f1f77bcf86cd799439099'
    });
    return simpleChildListQuery([]);
  });
  const findMeals = t.mock.method(Meal, 'find', () => assert.fail('No meal query should run for an unlinked child.'));
  const response = responseStub();

  await getMeals({
    query: { childId: '507f1f77bcf86cd799439099' },
    user: { _id: '507f1f77bcf86cd799439015', role: 'parent' }
  }, response);

  assert.equal(response.statusCode, 404);
  assert.equal(findMeals.mock.callCount(), 0);
});

test('teacher meal listing is restricted to schedules containing children in assigned classrooms', async t => {
  t.mock.method(Classroom, 'find', filter => {
    assert.deepEqual(filter, { status: 'active', teacher: teacherId });
    return classroomQuery([classroomId]);
  });
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: [classroomId] },
      status: { $in: ['active', 'approved'] }
    });
    return childQuery([eligibleChild]);
  });
  t.mock.method(Meal, 'find', filter => {
    assert.deepEqual(filter.children, { $in: [childId] });
    return queryList([{ _id: mealId, children: [{ _id: childId, firstName: 'Actual' }] }]);
  });
  const response = responseStub();
  await getMeals({ query: {}, user: { _id: teacherId, role: 'teacher' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.count, 1);
});

test('meal update validates status transition, then persists a reschedule', async t => {
  const existing = { _id: mealId, ...baseMeal, createdBy: teacherId, status: 'scheduled', children: [childId] };
  let updateQuery;
  t.mock.method(Classroom, 'find', () => classroomQuery([classroomId]));
  t.mock.method(Child, 'find', () => childQuery([eligibleChild]));
  t.mock.method(Meal, 'findOne', filter => ({
    lean: async () => {
      if (filter._id && typeof filter._id === 'object') return null;
      return existing;
    },
    select() { return this; }
  }));
  t.mock.method(Meal, 'findOneAndUpdate', (filter, updates) => {
    updateQuery = { filter, updates };
    return {
      populate() { return this; },
      lean: async () => ({ ...existing, ...updates })
    };
  });
  const res = responseStub();
  await updateMeal({
    params: { id: mealId },
    body: { date: '2026-10-17', status: 'prepared' },
    user: { _id: teacherId, role: 'teacher' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updateQuery.updates.date, '2026-10-17');
  assert.deepEqual(updateQuery.filter.children, { $in: [childId] });
  assert.equal(res.body.data.status, 'prepared');
});

test('served meals cannot be edited and invalid IDs are rejected', async t => {
  t.mock.method(Meal, 'findOne', () => ({
    lean: async () => ({ _id: mealId, ...baseMeal, status: 'served', children: [childId] }),
    select() { return this; }
  }));
  t.mock.method(Classroom, 'find', () => classroomQuery([classroomId]));
  t.mock.method(Child, 'find', () => childQuery([eligibleChild]));
  const served = responseStub();
  await updateMeal({
    params: { id: mealId },
    body: { date: '2026-10-17' },
    user: { _id: teacherId, role: 'teacher' }
  }, served);
  assert.equal(served.statusCode, 409);

  const invalid = responseStub();
  await updateMeal({ params: { id: 'bad-id' }, body: { date: '2026-10-17' }, user: { role: 'admin' } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test('deleting a meal is scoped to its owner for teachers', async t => {
  t.mock.method(Meal, 'findOne', filter => ({
    lean: async () => ({ _id: mealId, createdBy: teacherId, children: [childId] })
  }));
  t.mock.method(Classroom, 'find', () => classroomQuery([classroomId]));
  t.mock.method(Child, 'find', () => childQuery([eligibleChild]));
  t.mock.method(Meal, 'findOneAndDelete', async filter => {
    assert.equal(filter._id, mealId);
    assert.deepEqual(filter.children, { $in: [childId] });
    return { _id: mealId };
  });
  const res = responseStub();
  await deleteMeal({ params: { id: mealId }, user: { _id: teacherId, role: 'teacher' } }, res);
  assert.equal(res.statusCode, 200);
});

test('teacher intake records persist only for assigned children and replace their previous intake', async t => {
  const existingMeal = {
    _id: mealId,
    status: 'served',
    children: [childId],
    intake: [{ child: childId, status: 'partially_eaten', recordedBy: teacherId }]
  };
  t.mock.method(Meal, 'findById', async () => existingMeal);
  t.mock.method(Classroom, 'find', () => classroomQuery([classroomId]));
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: [classroomId] },
      status: { $in: ['active', 'approved'] }
    });
    return childQuery([eligibleChild]);
  });
  let update;
  t.mock.method(Meal, 'findOneAndUpdate', (filter, updateDoc) => {
    update = { filter, updateDoc };
    return {
      populate() { return this; },
      lean: async () => ({ ...existingMeal, intake: updateDoc.$set.intake })
    };
  });
  const response = responseStub();

  await recordMealIntake({
    params: { id: mealId },
    user: { _id: teacherId, role: 'teacher' },
    body: { records: [{ childId, status: 'eaten', quantity: 90, notes: 'Finished most of lunch.' }] }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(update.filter.children, { $all: [childId] });
  assert.equal(update.updateDoc.$set.intake.length, 1);
  assert.equal(update.updateDoc.$set.intake[0].status, 'eaten');
  assert.equal(update.updateDoc.$set.intake[0].recordedBy, teacherId);
});

test('teacher cannot record intake for a child outside assigned classroom or meal', async t => {
  const otherChildId = '507f1f77bcf86cd799439099';
  t.mock.method(Meal, 'findById', async () => ({ _id: mealId, status: 'served', children: [otherChildId], intake: [] }));
  t.mock.method(Classroom, 'find', () => classroomQuery([classroomId]));
  t.mock.method(Child, 'find', () => childQuery([eligibleChild]));
  const update = t.mock.method(Meal, 'findOneAndUpdate', async () => assert.fail('Unauthorized intake must not persist.'));
  const response = responseStub();
  await recordMealIntake({
    params: { id: mealId },
    user: { _id: teacherId, role: 'teacher' },
    body: { records: [{ childId: otherChildId, status: 'eaten' }] }
  }, response);
  assert.equal(response.statusCode, 403);
  assert.equal(update.mock.callCount(), 0);
});

test('intake cannot be recorded before a meal is marked served', async t => {
  t.mock.method(Meal, 'findById', async () => ({ _id: mealId, status: 'prepared', children: [childId], intake: [] }));
  const update = t.mock.method(Meal, 'findOneAndUpdate', async () => assert.fail('Unserved meal intake must not persist.'));
  const response = responseStub();
  await recordMealIntake({
    params: { id: mealId },
    user: { _id: teacherId, role: 'teacher' },
    body: { records: [{ childId, status: 'eaten' }] }
  }, response);
  assert.equal(response.statusCode, 409);
  assert.equal(update.mock.callCount(), 0);
});

test('meal status schema supports scheduled, prepared, served and cancelled states', () => {
  assert.deepEqual(Meal.schema.path('status').enumValues, ['scheduled', 'prepared', 'served', 'cancelled']);
  assert.deepEqual(Meal.schema.path('intake').schema.path('status').enumValues, [
    'eaten', 'partially_eaten', 'not_eaten', 'refused'
  ]);
});
