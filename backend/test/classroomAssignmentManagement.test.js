const test = require('node:test');
const assert = require('node:assert/strict');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const { createClassroom, updateClassroom } = require('../controllers/classroomController');

const ids = {
  teacher: '507f1f77bcf86cd799439011',
  classroom: '507f1f77bcf86cd799439012'
};

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

const teacherQuery = teacher => ({
  select() { return this; },
  lean: async () => teacher
});

test('classroom creation persists only a valid, existing nanny reference', async t => {
  t.mock.method(User, 'findOne', filter => {
    assert.deepEqual(filter, {
      _id: ids.teacher,
      role: 'teacher',
      isBlocked: { $ne: true }
    });
    return teacherQuery({ _id: ids.teacher });
  });
  const create = t.mock.method(Classroom, 'create', async data => ({ _id: ids.classroom, ...data }));
  t.mock.method(Classroom, 'findById', () => ({
    populate: async () => ({ _id: ids.classroom, teacher: { _id: ids.teacher } })
  }));
  const res = responseStub();

  await createClassroom({
    body: { name: 'Sunshine Room', ageGroup: '2-3 years', capacity: 12, teacher: ids.teacher }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(create.mock.calls[0].arguments[0].teacher, ids.teacher);
});

test('classroom creation rejects a malformed nanny reference before writing', async t => {
  const create = t.mock.method(Classroom, 'create', async () => {
    throw new Error('Invalid nanny references must not be written.');
  });
  const res = responseStub();

  await createClassroom({
    body: { name: 'Sunshine Room', ageGroup: '2-3 years', capacity: 12, teacher: 'not-an-object-id' }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /valid nanny/i);
  assert.equal(create.mock.callCount(), 0);
});

test('classroom update rejects missing, blocked, or non-teacher users', async t => {
  t.mock.method(User, 'findOne', () => teacherQuery(null));
  const update = t.mock.method(Classroom, 'findByIdAndUpdate', async () => {
    throw new Error('Invalid nanny references must not be written.');
  });
  const res = responseStub();

  await updateClassroom({
    params: { id: ids.classroom },
    body: { teacher: ids.teacher }
  }, res);

  assert.equal(res.statusCode, 404);
  assert.match(res.body.message, /nanny account/i);
  assert.equal(update.mock.callCount(), 0);
});

test('administrator can assign an existing nanny through the classroom update API', async t => {
  t.mock.method(User, 'findOne', () => teacherQuery({ _id: ids.teacher }));
  t.mock.method(Classroom, 'findById', () => ({
    select() { return this; },
    lean: async () => ({ _id: ids.classroom, teacher: null })
  }));
  let updateArgs;
  t.mock.method(Classroom, 'findByIdAndUpdate', (...args) => {
    updateArgs = args;
    return {
      populate: async () => ({ _id: ids.classroom, teacher: { _id: ids.teacher } })
    };
  });
  const res = responseStub();

  await updateClassroom({
    params: { id: ids.classroom },
    body: { teacher: ids.teacher }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(updateArgs[0], ids.classroom);
  assert.equal(updateArgs[1].teacher, ids.teacher);
});

test('classroom update refuses to replace an assigned nanny without explicit confirmation', async t => {
  const otherTeacher = '507f1f77bcf86cd799439015';
  t.mock.method(User, 'findOne', () => teacherQuery({ _id: ids.teacher }));
  t.mock.method(Classroom, 'findById', () => ({
    select() { return this; },
    lean: async () => ({ _id: ids.classroom, teacher: otherTeacher })
  }));
  const update = t.mock.method(Classroom, 'findByIdAndUpdate', async () => {
    throw new Error('An unconfirmed nanny reassignment must not be written.');
  });
  const res = responseStub();

  await updateClassroom({
    params: { id: ids.classroom },
    body: { teacher: ids.teacher }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /confirm the reassignment/i);
  assert.equal(update.mock.callCount(), 0);
});
