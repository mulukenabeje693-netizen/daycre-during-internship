const test = require('node:test');
const assert = require('node:assert/strict');
const Classroom = require('../models/Classroom');
const Child = require('../models/Child');
const classroomsRouter = require('../routes/classrooms');
const { getMyClassroom, getClassroom } = require('../controllers/classroomController');

const teacherId = '507f1f77bcf86cd799439011';
const roomId = '507f1f77bcf86cd799439012';

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

test('assigned classroom endpoint is authenticated and restricted to teachers', () => {
  assert.ok(classroomsRouter.stack.some(layer => layer.name === 'protect'));
  const route = classroomsRouter.stack.find(layer => layer.route?.path === '/my-classroom');
  assert.ok(route);
  assert.equal(route.route.stack.length, 2);
  assert.equal(route.route.stack[1].handle.name, 'getMyClassroom');
  assert.notEqual(route.route.stack[0].handle.name, 'getMyClassroom');
});

test('nanny assigned-room roster returns assigned rooms and their eligible children', async t => {
  const classrooms = [{
    _id: roomId,
    name: 'Sunshine',
    capacity: 12,
    status: 'active',
    teacher: { _id: teacherId, fullName: 'Assigned Nanny' }
  }];
  const children = [{
    _id: '507f1f77bcf86cd799439013',
    firstName: 'Actual',
    lastName: 'Child',
    status: 'active',
    classroom: roomId
  }];
  t.mock.method(Classroom, 'find', filter => {
    assert.deepEqual(filter, { teacher: teacherId });
    return {
      populate(path) {
        assert.equal(path, 'teacher');
        return this;
      },
      lean: async () => classrooms
    };
  });
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: [roomId] },
      status: { $in: ['active', 'approved'] }
    });
    return {
      select(fields) {
        assert.match(fields, /photoUrl/);
        return this;
      },
      populate(path) {
        assert.equal(path, 'parents');
        return this;
      },
      lean: async () => children
    };
  });
  const res = responseStub();

  await getMyClassroom({ user: { _id: teacherId, role: 'teacher' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].teacher.fullName, 'Assigned Nanny');
  assert.equal(res.body.data[0].children[0].firstName, 'Actual');
});

test('nanny assigned-room endpoint returns a clear empty result without querying children', async t => {
  t.mock.method(Classroom, 'find', () => ({
    populate() { return this; },
    lean: async () => []
  }));
  const childLookup = t.mock.method(Child, 'find', () => {
    throw new Error('Do not query children for an unassigned nanny.');
  });
  const res = responseStub();

  await getMyClassroom({ user: { _id: teacherId, role: 'teacher' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
  assert.equal(childLookup.mock.callCount(), 0);
});

test('teacher cannot view another classroom by ID', async t => {
  const otherTeacher = '507f1f77bcf86cd799439014';
  t.mock.method(Classroom, 'findById', id => {
    assert.equal(id, roomId);
    return {
      populate() {
        return Promise.resolve({
          _id: roomId,
          teacher: { _id: otherTeacher }
        });
      }
    };
  });
  const childLookup = t.mock.method(Child, 'find', () => {
    throw new Error('Unauthorized teacher must not receive child data.');
  });
  const res = responseStub();

  await getClassroom({
    params: { id: roomId },
    user: { _id: teacherId, role: 'teacher' }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(childLookup.mock.callCount(), 0);
});
