const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const { assignChildrenToClassroom } = require('../controllers/childController');

const ids = {
  teacher: '507f1f77bcf86cd799439011',
  classroom: '507f1f77bcf86cd799439012',
  children: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014']
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

const queryStub = value => ({
  select() { return this; },
  session() { return this; },
  lean() { return Promise.resolve(value); }
});

const request = overrides => ({
  body: {
    teacherId: ids.teacher,
    classroomId: ids.classroom,
    childIds: ids.children,
    ...overrides
  }
});

const mockAssignmentModels = (t, {
  teacher = { _id: ids.teacher, fullName: 'Test Nanny', role: 'teacher', isBlocked: false },
  classroom = {
    _id: ids.classroom,
    name: 'Sunshine Room',
    capacity: 5,
    status: 'active'
  },
  children = ids.children.map(_id => ({ _id, classroom: null, status: 'active' })),
  enrolledCount = 1
} = {}) => {
  const session = {
    async withTransaction(operation) { return operation(); },
    async endSession() {}
  };
  t.mock.method(mongoose, 'startSession', async () => session);
  t.mock.method(User, 'findOne', () => queryStub(teacher));
  t.mock.method(Classroom, 'findById', () => queryStub(classroom));
  t.mock.method(Child, 'find', () => queryStub(children));
  t.mock.method(Child, 'countDocuments', () => ({
    session() { return Promise.resolve(enrolledCount); }
  }));
  const classroomUpdate = t.mock.method(Classroom, 'updateOne', async () => ({ matchedCount: 1 }));
  const childUpdate = t.mock.method(Child, 'updateMany', async () => ({
    modifiedCount: children.length
  }));
  return { classroomUpdate, childUpdate };
};

test('bulk classroom assignment validates all records and saves teacher and children together', async t => {
  const { classroomUpdate, childUpdate } = mockAssignmentModels(t);
  const res = responseStub();

  await assignChildrenToClassroom({
    ...request(),
    user: { role: 'admin' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.assignedCount, 2);
  assert.deepEqual(res.body.data.childIds, ids.children);
  assert.equal(classroomUpdate.mock.callCount(), 1);
  assert.equal(childUpdate.mock.callCount(), 1);
  assert.equal(classroomUpdate.mock.calls[0].arguments[1].$set.teacher, ids.teacher);
  assert.equal(classroomUpdate.mock.calls[0].arguments[1].$inc.assignmentRevision, 1);
});

test('bulk classroom assignment rejects blocked or missing teachers', async t => {
  mockAssignmentModels(t, { teacher: null });
  const res = responseStub();

  await assignChildrenToClassroom(request(), res);

  assert.equal(res.statusCode, 404);
  assert.match(res.body.message, /nanny/i);
});

test('bulk classroom assignment rejects inactive classrooms', async t => {
  const { classroomUpdate } = mockAssignmentModels(t, {
    classroom: {
      _id: ids.classroom,
      name: 'Inactive Room',
      capacity: 5,
      status: 'inactive'
    }
  });
  const inactiveRes = responseStub();
  await assignChildrenToClassroom(request(), inactiveRes);
  assert.equal(inactiveRes.statusCode, 409);
  assert.match(inactiveRes.body.message, /inactive/i);
  assert.equal(classroomUpdate.mock.callCount(), 0);
});

test('bulk child assignment does not silently reassign a classroom from another nanny', async t => {
  const otherTeacherId = '507f1f77bcf86cd799439015';
  const { classroomUpdate, childUpdate } = mockAssignmentModels(t, {
    classroom: {
      _id: ids.classroom,
      name: 'Sunshine Room',
      capacity: 5,
      status: 'active',
      teacher: otherTeacherId
    }
  });
  const res = responseStub();

  await assignChildrenToClassroom(request(), res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /assigned to another nanny/i);
  assert.equal(classroomUpdate.mock.callCount(), 0);
  assert.equal(childUpdate.mock.callCount(), 0);
});

test('bulk classroom assignment rejects children that were assigned concurrently', async t => {
  mockAssignmentModels(t, {
    children: [
      { _id: ids.children[0], classroom: null, status: 'active' },
      { _id: ids.children[1], classroom: ids.classroom, status: 'active' }
    ]
  });
  const assignedRes = responseStub();
  await assignChildrenToClassroom(request(), assignedRes);
  assert.equal(assignedRes.statusCode, 409);
  assert.match(assignedRes.body.message, /already been assigned/i);
});

test('bulk classroom assignment rejects pending children until admin approval', async t => {
  const { classroomUpdate } = mockAssignmentModels(t, {
    children: ids.children.map((_id, index) => ({
      _id,
      classroom: null,
      status: index === 0 ? 'approved' : 'pending'
    }))
  });
  const res = responseStub();

  await assignChildrenToClassroom(request(), res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /approved before/i);
  assert.equal(classroomUpdate.mock.callCount(), 0);
});

test('bulk classroom assignment rejects selections exceeding available capacity', async t => {
  const { classroomUpdate } = mockAssignmentModels(t, {
    classroom: {
      _id: ids.classroom,
      name: 'Full Room',
      capacity: 2,
      status: 'active'
    },
    enrolledCount: 1
  });
  const res = responseStub();

  await assignChildrenToClassroom(request(), res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /1 place available/i);
  assert.equal(classroomUpdate.mock.callCount(), 0);
});

test('bulk classroom assignment validates ids and rejects duplicate child selections before database writes', async t => {
  const startSession = t.mock.method(mongoose, 'startSession', async () => {
    throw new Error('Invalid selections must be rejected before starting a transaction.');
  });
  const res = responseStub();

  await assignChildrenToClassroom(request({ childIds: [ids.children[0], ids.children[0]] }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(startSession.mock.callCount(), 0);
});
