const test = require('node:test');
const assert = require('node:assert/strict');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const Meal = require('../models/Meal');
const mealsRouter = require('../routes/meals');
const { getMealStudents, createMeal } = require('../controllers/mealController');

const teacherId = '507f1f77bcf86cd799439011';
const classroomId = '507f1f77bcf86cd799439012';
const childId = '507f1f77bcf86cd799439013';

const responseStub = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const childQuery = value => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  lean() { return this; },
  maxTimeMS() { return Promise.resolve(value); }
});

const classroomQuery = ids => ({
  select(fields) {
    assert.equal(fields, '_id');
    return this;
  },
  lean: async () => ids.map(_id => ({ _id }))
});

const eligibleChild = {
  _id: childId,
  firstName: 'Real',
  lastName: 'Child',
  status: 'approved',
  classroom: { _id: classroomId, name: 'Sunshine' }
};

test('meal student route is authenticated and role-restricted', () => {
  assert.ok(mealsRouter.stack.some(layer => layer.name === 'protect'));
  const studentsRoute = mealsRouter.stack.find(layer =>
    layer.route?.path === '/students' && layer.route.methods.get
  );
  assert.ok(studentsRoute);
  assert.equal(studentsRoute.route.stack.length, 2);
});

test('meal student list is scoped to the authenticated teacher classroom and eligible enrollment states', async t => {
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
  const res = responseStub();

  await getMealStudents({ user: { _id: teacherId, role: 'teacher' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.data[0].firstName, 'Real');
  assert.equal(res.body.data[0].lastName, 'Child');
});

test('meal student list filters by a selected classroom assigned to the authenticated teacher', async t => {
  t.mock.method(Classroom, 'find', filter => {
    assert.deepEqual(filter, { status: 'active', teacher: teacherId, _id: classroomId });
    return classroomQuery([classroomId]);
  });
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: [classroomId] },
      status: { $in: ['active', 'approved'] }
    });
    return childQuery([eligibleChild]);
  });
  const response = responseStub();

  await getMealStudents({
    user: { _id: teacherId, role: 'teacher' },
    query: { classroomId }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data.map(child => child._id), [childId]);
});

test('meal student list rejects invalid and unassigned classroom IDs', async t => {
  const invalid = responseStub();
  await getMealStudents({
    user: { _id: teacherId, role: 'teacher' },
    query: { classroomId: 'not-an-object-id' }
  }, invalid);
  assert.equal(invalid.statusCode, 400);

  t.mock.method(Classroom, 'find', filter => {
    assert.deepEqual(filter, { status: 'active', teacher: teacherId, _id: classroomId });
    return classroomQuery([]);
  });
  const unauthorized = responseStub();
  await getMealStudents({
    user: { _id: teacherId, role: 'teacher' },
    query: { classroomId }
  }, unauthorized);
  assert.equal(unauthorized.statusCode, 404);
  assert.match(unauthorized.body.message, /not assigned/i);
});

test('meal creation persists selected child references and returns populated child names', async t => {
  t.mock.method(Classroom, 'find', () => classroomQuery([classroomId]));
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: [classroomId] },
      status: { $in: ['active', 'approved'] },
      _id: { $in: [childId] }
    });
    return childQuery([eligibleChild]);
  });
  let created;
  t.mock.method(Meal, 'create', async value => {
    created = value;
    return { _id: 'meal-record' };
  });
  t.mock.method(Meal, 'findOne', () => ({
    select() { return this; },
    lean: async () => null
  }));
  t.mock.method(Meal, 'findById', () => {
    const query = {
      populate() { return this; },
      lean: async () => ({ ...created, _id: 'meal-record', children: [eligibleChild] })
    };
    return query;
  });
  const res = responseStub();

  await createMeal({
    user: { _id: teacherId, role: 'teacher' },
    body: {
      name: 'Lunch',
      type: 'lunch',
      date: '2026-10-14',
      time: '12:00',
      items: 'Soup',
      classroom: classroomId,
      children: [childId],
      createdBy: 'untrusted-user'
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(created.children, [childId]);
  assert.equal(created.createdBy, teacherId);
  assert.equal(created.status, 'scheduled');
  assert.equal(res.body.data.children[0].firstName, 'Real');
});

test('meal creation rejects pending or out-of-classroom child records', async t => {
  t.mock.method(Classroom, 'find', () => classroomQuery([classroomId]));
  t.mock.method(Child, 'find', () => childQuery([]));
  const create = t.mock.method(Meal, 'create', async () => {
    throw new Error('Ineligible child was persisted.');
  });
  const res = responseStub();

  await createMeal({
    user: { _id: teacherId, role: 'teacher' },
    body: {
      name: 'Lunch',
      type: 'lunch',
      date: '2026-10-14',
      time: '12:00',
      items: 'Soup',
      classroom: classroomId,
      children: [childId]
    }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /no longer eligible/i);
  assert.equal(create.mock.callCount(), 0);
});
