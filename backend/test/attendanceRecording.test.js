const test = require('node:test');
const assert = require('node:assert/strict');
const Attendance = require('../models/Attendance');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const { checkIn, markAbsence } = require('../controllers/attendanceController');

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

const queryResult = value => ({
  select() { return this; },
  lean: async () => value
});

const assignedChild = (status = 'active') => ({
  _id: childId,
  classroom: classroomId,
  status
});

const teacherClassroom = () => ({
  _id: classroomId,
  teacher: teacherId,
  status: 'active'
});

test('saves present attendance for the selected date with an atomic child/date upsert', async t => {
  t.mock.method(Child, 'findById', id => {
    assert.equal(id, childId);
    return queryResult(assignedChild());
  });
  t.mock.method(Classroom, 'findById', id => {
    assert.equal(String(id), classroomId);
    return queryResult(teacherClassroom());
  });
  const updateRecord = t.mock.method(Attendance, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(filter.child, childId);
    assert.equal(filter.date.getFullYear(), 2026);
    assert.equal(filter.date.getMonth(), 9);
    assert.equal(filter.date.getDate(), 14);
    assert.equal(update.$set.status, 'present');
    assert.equal(update.$set.classroom, classroomId);
    assert.equal(update.$set.notes, 'Arrived on time');
    assert.equal(update.$set.checkIn.recordedBy, teacherId);
    assert.equal(options.upsert, true);
    assert.equal(options.runValidators, true);
    return { _id: 'record-id' };
  });
  t.mock.method(Attendance, 'findById', id => {
    assert.equal(id, 'record-id');
    let populateCalls = 0;
    return {
      populate() {
        populateCalls += 1;
        return populateCalls === 2 ? Promise.resolve({ _id: id }) : this;
      }
    };
  });
  const res = responseStub();

  await checkIn({
    user: { _id: teacherId, role: 'teacher' },
    body: { childId, classroomId, date: '2026-10-14', notes: 'Arrived on time' }
  }, res);

  assert.equal(updateRecord.mock.callCount(), 1);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test('rejects attendance when the child is not assigned to the submitted classroom', async t => {
  t.mock.method(Child, 'findById', () => queryResult(assignedChild()));
  const classroomLookup = t.mock.method(Classroom, 'findById', () => {
    throw new Error('Classroom lookup should not be reached.');
  });
  const attendanceWrite = t.mock.method(Attendance, 'findOneAndUpdate', () => {
    throw new Error('Unauthorized attendance write attempted.');
  });
  const res = responseStub();

  await markAbsence({
    user: { _id: teacherId, role: 'teacher' },
    body: { childId, classroomId: '507f1f77bcf86cd799439014', status: 'absent', date: '2026-10-14' }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(classroomLookup.mock.callCount(), 0);
  assert.equal(attendanceWrite.mock.callCount(), 0);
});

test('rejects attendance for pending children without changing approval status', async t => {
  t.mock.method(Child, 'findById', () => queryResult(assignedChild('pending')));
  const classroomLookup = t.mock.method(Classroom, 'findById', () => {
    throw new Error('Pending children should be rejected before classroom lookup.');
  });
  const res = responseStub();

  await markAbsence({
    user: { _id: teacherId, role: 'teacher' },
    body: { childId, classroomId, status: 'absent', date: '2026-10-14' }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(classroomLookup.mock.callCount(), 0);
});

test('rejects invalid dates and statuses', async t => {
  const childLookup = t.mock.method(Child, 'findById', () => {
    throw new Error('Invalid requests must be rejected before data lookup.');
  });
  const invalidDateResponse = responseStub();
  await checkIn({
    user: { _id: teacherId, role: 'teacher' },
    body: { childId, classroomId, date: '2026-02-30' }
  }, invalidDateResponse);
  assert.equal(invalidDateResponse.statusCode, 400);

  const invalidStatusResponse = responseStub();
  await markAbsence({
    user: { _id: teacherId, role: 'teacher' },
    body: { childId, classroomId, date: '2026-10-14', status: 'made-up-status' }
  }, invalidStatusResponse);
  assert.equal(invalidStatusResponse.statusCode, 400);
  assert.equal(childLookup.mock.callCount(), 0);
});

test('rejects non-string attendance date values as invalid input', async t => {
  const childLookup = t.mock.method(Child, 'findById', () => {
    throw new Error('Invalid date input must be rejected before querying children.');
  });
  const res = responseStub();

  await checkIn({
    user: { _id: teacherId, role: 'teacher' },
    body: { childId, classroomId, date: ['2026-10-14'] }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(childLookup.mock.callCount(), 0);
});
