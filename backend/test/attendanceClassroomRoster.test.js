const test = require('node:test');
const assert = require('node:assert/strict');
const Attendance = require('../models/Attendance');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const attendanceRouter = require('../routes/attendance');
const { getTodayAttendance } = require('../controllers/attendanceController');

const teacherId = '507f1f77bcf86cd799439011';
const classroomIds = [
  '507f1f77bcf86cd799439012',
  '507f1f77bcf86cd799439013'
];

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

const classroomQuery = classrooms => ({
  select(fields) {
    assert.equal(fields, '_id status');
    return this;
  },
  lean() { return this; },
  maxTimeMS(timeout) {
    assert.equal(timeout, 5000);
    return Promise.resolve(classrooms);
  }
});

const attendanceQuery = (records = []) => ({
  select() { return this; },
  populate() { return this; },
  lean() { return this; },
  maxTimeMS() { return Promise.resolve(records); }
});

const childQuery = children => ({
  select() { return this; },
  lean() { return this; },
  maxTimeMS() { return Promise.resolve(children); }
});

test('attendance route requires an authenticated user', () => {
  assert.ok(attendanceRouter.stack.some(layer => layer.name === 'protect'));
});

test('teacher daily attendance loads students across all active assigned classrooms', async t => {
  t.mock.method(Classroom, 'find', filter => {
    assert.deepEqual(filter, { teacher: teacherId });
    return classroomQuery([
      { _id: classroomIds[0], status: 'active' },
      { _id: classroomIds[1], status: 'active' },
      { _id: '507f1f77bcf86cd799439014', status: 'inactive' }
    ]);
  });
  t.mock.method(Attendance, 'find', filter => {
    assert.deepEqual(filter.classroom, { $in: classroomIds });
    assert.equal(filter.date.$gte.getFullYear(), 2026);
    assert.equal(filter.date.$gte.getMonth(), 9);
    assert.equal(filter.date.$gte.getDate(), 14);
    assert.equal(filter.date.$lt.getDate(), 15);
    return attendanceQuery([]);
  });
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: classroomIds },
      status: { $in: ['active', 'approved'] }
    });
    return childQuery([
      { _id: 'child-one', firstName: 'Actual', lastName: 'Student', classroom: classroomIds[0] },
      { _id: 'child-two', firstName: 'Another', lastName: 'Student', classroom: classroomIds[1] }
    ]);
  });
  const res = responseStub();

  await getTodayAttendance({
    user: { _id: teacherId, role: 'teacher' },
    query: { classroomId: 'untrusted-room-id', date: '2026-10-14' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.assignmentStatus, 'assigned');
  assert.equal(res.body.data.absentChildren.length, 2);
  assert.deepEqual(res.body.data.absentChildren.map(child => child.firstName), ['Actual', 'Another']);
});

test('teacher attendance rejects an invalid selected date', async t => {
  const classroomLookup = t.mock.method(Classroom, 'find', () => {
    throw new Error('Invalid date must be rejected before classroom lookup.');
  });
  const res = responseStub();

  await getTodayAttendance({
    user: { _id: teacherId, role: 'teacher' },
    query: { date: '2026-02-30' }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(classroomLookup.mock.callCount(), 0);
});

test('teacher without an assigned classroom receives an explicit empty roster state', async t => {
  t.mock.method(Classroom, 'find', filter => {
    assert.deepEqual(filter, { teacher: teacherId });
    return classroomQuery([]);
  });
  const childLookup = t.mock.method(Child, 'find', () => {
    throw new Error('An unassigned teacher must not query the global child list.');
  });
  const attendanceLookup = t.mock.method(Attendance, 'find', () => {
    throw new Error('An unassigned teacher must not query attendance globally.');
  });
  const res = responseStub();

  await getTodayAttendance({
    user: { _id: teacherId, role: 'teacher' },
    query: {}
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.assignmentStatus, 'unassigned');
  assert.deepEqual(res.body.data.absentChildren, []);
  assert.equal(childLookup.mock.callCount(), 0);
  assert.equal(attendanceLookup.mock.callCount(), 0);
});

test('teacher assigned only inactive classrooms receives an inactive assignment state', async t => {
  t.mock.method(Classroom, 'find', () => classroomQuery([
    { _id: classroomIds[0], status: 'inactive' }
  ]));
  const res = responseStub();

  await getTodayAttendance({
    user: { _id: teacherId, role: 'teacher' },
    query: {}
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.assignmentStatus, 'inactive_classroom');
});
