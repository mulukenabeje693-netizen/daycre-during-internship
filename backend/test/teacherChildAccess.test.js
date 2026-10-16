const test = require('node:test');
const assert = require('node:assert/strict');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const { getChild, updateChild } = require('../controllers/childController');

const ids = {
  teacher: '507f1f77bcf86cd799439011',
  classroom: '507f1f77bcf86cd799439012',
  child: '507f1f77bcf86cd799439013'
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

const assignedRoomQuery = () => ({
  select(fields) {
    assert.equal(fields, '_id');
    return this;
  },
  lean: async () => [{ _id: ids.classroom }]
});

const populatedChildQuery = value => ({
  populate() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test('teacher child lookup is restricted to their active classrooms', async t => {
  t.mock.method(Classroom, 'find', filter => {
    assert.deepEqual(filter, { teacher: ids.teacher, status: 'active' });
    return assignedRoomQuery();
  });
  const childFind = t.mock.method(Child, 'findOne', filter => {
    assert.deepEqual(filter, {
      _id: ids.child,
      classroom: { $in: [ids.classroom] },
      status: { $in: ['active', 'approved', 'pending'] }
    });
    return populatedChildQuery(null);
  });
  const res = responseStub();

  await getChild({
    params: { id: ids.child },
    user: { _id: ids.teacher, role: 'teacher' }
  }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(childFind.mock.callCount(), 1);
  assert.equal(res.body.success, false);
});

test('teacher child updates cannot change classroom, status, or parent ownership', async t => {
  t.mock.method(Classroom, 'find', () => assignedRoomQuery());
  let updateArgs;
  t.mock.method(Child, 'findOneAndUpdate', (...args) => {
    updateArgs = args;
    return populatedChildQuery({ _id: ids.child, firstName: 'Updated' });
  });
  const res = responseStub();

  await updateChild({
    params: { id: ids.child },
    user: { _id: ids.teacher, role: 'teacher' },
    body: {
      firstName: 'Updated',
      classroom: '507f1f77bcf86cd799439099',
      status: 'active',
      parents: ['507f1f77bcf86cd799439098']
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(updateArgs[0], {
    _id: ids.child,
    classroom: { $in: [ids.classroom] },
    status: { $in: ['active', 'approved', 'pending'] }
  });
  assert.deepEqual(updateArgs[1], { firstName: 'Updated' });
});

test('teacher cannot update a child outside their assigned classroom', async t => {
  t.mock.method(Classroom, 'find', () => assignedRoomQuery());
  const update = t.mock.method(Child, 'findOneAndUpdate', (filter) => {
    assert.deepEqual(filter, {
      _id: ids.child,
      classroom: { $in: [ids.classroom] },
      status: { $in: ['active', 'approved', 'pending'] }
    });
    return populatedChildQuery(null);
  });
  const res = responseStub();

  await updateChild({
    params: { id: ids.child },
    user: { _id: ids.teacher, role: 'teacher' },
    body: { firstName: 'Unauthorized' }
  }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(update.mock.callCount(), 1);
});
