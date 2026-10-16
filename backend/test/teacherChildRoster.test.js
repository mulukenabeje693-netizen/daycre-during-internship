const test = require('node:test');
const assert = require('node:assert/strict');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const childrenRouter = require('../routes/children');
const { getChildren } = require('../controllers/childController');

const teacherId = '507f1f77bcf86cd799439011';
const roomIds = [
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

const resolvedQuery = value => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  lean() { return this; },
  maxTimeMS() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test('children endpoint requires authentication before returning a nanny roster', () => {
  const protectLayer = childrenRouter.stack.find(layer => layer.name === 'protect');
  assert.ok(protectLayer);
});

test('nanny roster includes active and approved children across every active assigned classroom', async t => {
  const classroomQuery = {
    select(fields) {
      assert.equal(fields, '_id status');
      return this;
    },
    lean: async () => [
      { _id: roomIds[0], status: 'active' },
      { _id: roomIds[1], status: 'active' },
      { _id: '507f1f77bcf86cd799439014', status: 'inactive' }
    ]
  };
  t.mock.method(Classroom, 'find', filter => {
    assert.deepEqual(filter, { teacher: teacherId });
    return classroomQuery;
  });
  const records = [
    { _id: 'child-active', status: 'active', classroom: { _id: roomIds[0], name: 'Sunshine' }, parents: [] },
    { _id: 'child-approved', status: 'approved', classroom: { _id: roomIds[1], name: 'Rainbow' }, parents: [] },
    { _id: 'child-pending', status: 'pending', classroom: { _id: roomIds[0], name: 'Sunshine' }, parents: [] }
  ];
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: [roomIds[0], roomIds[1]] },
      status: { $in: ['active', 'approved', 'pending'] }
    });
    return resolvedQuery(records);
  });
  t.mock.method(Child, 'countDocuments', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: [roomIds[0], roomIds[1]] },
      status: 'pending'
    });
    return {
      maxTimeMS() { return Promise.resolve(1); }
    };
  });
  const res = responseStub();

  await getChildren({
    user: { _id: teacherId, role: 'teacher' },
    query: { includePending: 'true' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.count, 3);
  assert.deepEqual(res.body.data.map(child => child._id), ['child-active', 'child-approved', 'child-pending']);
  assert.equal(res.body.assignmentStatus, 'assigned');
  assert.equal(res.body.pendingCount, 1);
  assert.equal(res.body.enrolledCount, 2);
});

test('default nanny child query excludes pending registrations from enrolled students', async t => {
  t.mock.method(Classroom, 'find', () => ({
    select() { return this; },
    lean: async () => [{ _id: roomIds[0], status: 'active' }]
  }));
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: [roomIds[0]] },
      status: { $in: ['active', 'approved'] }
    });
    return resolvedQuery([
      { _id: 'child-active', status: 'active', classroom: null, parents: [] }
    ]);
  });
  t.mock.method(Child, 'countDocuments', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: [roomIds[0]] },
      status: 'pending'
    });
    return {
      maxTimeMS() { return Promise.resolve(0); }
    };
  });
  const res = responseStub();

  await getChildren({ user: { _id: teacherId, role: 'teacher' }, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.enrolledCount, 1);
  assert.equal(res.body.pendingCount, 0);
});

test('nanny roster reports pending children without including them as attendance-eligible children', async t => {
  t.mock.method(Classroom, 'find', () => ({
    select() { return this; },
    lean: async () => [{ _id: roomIds[0], status: 'active' }]
  }));
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: [roomIds[0]] },
      status: { $in: ['active', 'approved'] }
    });
    return resolvedQuery([]);
  });
  t.mock.method(Child, 'countDocuments', filter => {
    assert.deepEqual(filter, {
      classroom: { $in: [roomIds[0]] },
      status: 'pending'
    });
    return {
      maxTimeMS() { return Promise.resolve(2); }
    };
  });
  const res = responseStub();

  await getChildren({ user: { _id: teacherId, role: 'teacher' }, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
  assert.equal(res.body.pendingCount, 2);
  assert.equal(res.body.enrolledCount, 0);
  assert.equal(res.body.assignmentStatus, 'pending');
});

test('nanny roster distinguishes an unassigned classroom without querying unrelated children', async t => {
  t.mock.method(Classroom, 'find', filter => {
    assert.deepEqual(filter, { teacher: teacherId });
    return {
      select() { return this; },
      lean: async () => []
    };
  });
  const childLookup = t.mock.method(Child, 'find', () => {
    throw new Error('A nanny with no classroom must not query the global child list.');
  });
  const res = responseStub();

  await getChildren({ user: { _id: teacherId, role: 'teacher' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.assignmentStatus, 'unassigned');
  assert.deepEqual(res.body.data, []);
  assert.equal(childLookup.mock.callCount(), 0);
});

test('nanny roster identifies assigned but inactive classrooms separately', async t => {
  t.mock.method(Classroom, 'find', () => ({
    select() { return this; },
    lean: async () => [{ _id: roomIds[0], status: 'inactive' }]
  }));
  const childLookup = t.mock.method(Child, 'find', () => {
    throw new Error('Inactive classrooms must not expose their child roster.');
  });
  const res = responseStub();

  await getChildren({ user: { _id: teacherId, role: 'teacher' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.assignmentStatus, 'inactive_classroom');
  assert.deepEqual(res.body.data, []);
  assert.equal(childLookup.mock.callCount(), 0);
});

test('nanny roster reports a safe error when the classroom lookup fails', async t => {
  t.mock.method(Classroom, 'find', () => ({
    select() { return this; },
    lean: async () => { throw new Error('private database connection details'); }
  }));
  const res = responseStub();

  await getChildren({ user: { _id: teacherId, role: 'teacher' } }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'CHILD_ROSTER_UNAVAILABLE');
  assert.equal(res.body.message, 'Could not load the child roster right now. Please retry.');
  assert.equal(JSON.stringify(res.body).includes('private database'), false);
});
