const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Child = require('../models/Child');
const User = require('../models/User');
const { createChild } = require('../controllers/childController');
const { getParentOptions } = require('../controllers/staffController');

const parentId = '507f1f77bcf86cd799439011';
const classroomId = '507f1f77bcf86cd799439012';

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

test('parent submission links the authenticated parent and cannot self-assign a classroom', async t => {
  t.mock.method(Child, 'findOne', () => ({
    collation() { return this; },
    lean: async () => null
  }));
  let savedChild;
  t.mock.method(Child, 'create', async values => {
    savedChild = values;
    return { _id: 'child-new' };
  });
  t.mock.method(Child, 'findById', () => {
    const query = {
      populate() { return this; },
      then(resolve, reject) {
        return Promise.resolve({ ...savedChild, _id: 'child-new' }).then(resolve, reject);
      }
    };
    return query;
  });
  const res = responseStub();

  await createChild({
    user: { _id: parentId, role: 'parent', fullName: 'Parent Name' },
    body: {
      firstName: 'Child',
      lastName: 'Name',
      dateOfBirth: '2022-01-02',
      gender: 'female',
      parents: ['507f1f77bcf86cd799439099'],
      classroom: classroomId,
      status: 'active',
      parentName: 'Forged Parent'
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(savedChild.parents, [parentId]);
  assert.equal(String(savedChild.classroom), 'null');
  assert.equal(savedChild.status, 'pending');
  assert.equal(savedChild.parentName, 'Parent Name');
  assert.equal(res.body.data.firstName, 'Child');
});

test('retrying the same parent child registration returns the existing record instead of inserting another', async t => {
  const existing = {
    _id: 'child-existing',
    firstName: 'Child',
    lastName: 'Name',
    status: 'pending',
    parents: [parentId]
  };
  let duplicateQuery;
  t.mock.method(Child, 'findOne', query => {
    duplicateQuery = query;
    return {
      collation(options) {
        assert.deepEqual(options, { locale: 'en', strength: 2 });
        return this;
      },
      lean: async () => existing
    };
  });
  const create = t.mock.method(Child, 'create', async () => {
    throw new Error('A retry must not create a second child record.');
  });
  const res = responseStub();

  await createChild({
    user: { _id: parentId, role: 'parent', fullName: 'Parent Name' },
    body: {
      firstName: 'child',
      lastName: 'name',
      dateOfBirth: '2022-01-02',
      gender: 'female',
      parents: ['507f1f77bcf86cd799439099']
    }
  }, res);

  assert.deepEqual(duplicateQuery.parents, parentId);
  assert.equal(duplicateQuery.dateOfBirth.toISOString(), '2022-01-02T00:00:00.000Z');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.duplicate, true);
  assert.equal(res.body.data._id, existing._id);
  assert.equal(create.mock.callCount(), 0);
});

test('admin child registration links an existing parent account after validating its role', async t => {
  const parentAccount = {
    _id: new mongoose.Types.ObjectId(parentId),
    fullName: 'Verified Parent'
  };
  t.mock.method(User, 'find', query => {
    assert.deepEqual(query._id.$in, [parentId]);
    assert.ok(query.role instanceof RegExp);
    assert.equal(query.role.test(' Parent '), true);
    return {
      select(fields) {
        assert.equal(fields, '_id fullName');
        return this;
      },
      lean: async () => [parentAccount]
    };
  });
  let savedChild;
  t.mock.method(Child, 'create', async values => {
    savedChild = values;
    return { _id: 'child-new' };
  });
  t.mock.method(Child, 'findById', () => ({
    populate() { return this; },
    then(resolve, reject) {
      return Promise.resolve({ ...savedChild, _id: 'child-new' }).then(resolve, reject);
    }
  }));
  const res = responseStub();

  await createChild({
    user: { _id: '507f1f77bcf86cd799439013', role: 'admin' },
    body: {
      firstName: 'Child',
      lastName: 'Name',
      dateOfBirth: '2022-01-02',
      gender: 'female',
      parents: [parentId],
      parentName: 'Untrusted Parent Name'
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(String(savedChild.parents[0]), parentId);
  assert.equal(savedChild.parentName, 'Verified Parent');
});

test('admin child registration rejects parent IDs that do not belong to parent accounts', async t => {
  t.mock.method(User, 'find', () => ({
    select() { return this; },
    lean: async () => []
  }));
  const create = t.mock.method(Child, 'create', async () => {
    throw new Error('An invalid parent must never be linked.');
  });
  const res = responseStub();

  await createChild({
    user: { _id: '507f1f77bcf86cd799439013', role: 'admin' },
    body: {
      firstName: 'Child',
      lastName: 'Name',
      dateOfBirth: '2022-01-02',
      gender: 'female',
      parents: [parentId]
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(create.mock.callCount(), 0);
});

test('child registration rejects malformed selected parent IDs before querying MongoDB', async t => {
  const find = t.mock.method(User, 'find', async () => {
    throw new Error('Malformed IDs must not reach MongoDB.');
  });
  const res = responseStub();

  await createChild({
    user: { _id: '507f1f77bcf86cd799439013', role: 'reception' },
    body: {
      firstName: 'Child',
      lastName: 'Name',
      dateOfBirth: '2022-01-02',
      gender: 'female',
      parents: ['not-an-object-id']
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(find.mock.callCount(), 0);
});

test('parent options endpoint returns only public contact fields for parent-role accounts', async t => {
  t.mock.method(User, 'find', query => {
    assert.ok(query.role instanceof RegExp);
    assert.equal(query.role.test('Parent'), true);
    return {
      select(fields) {
        assert.equal(fields, '_id fullName email phone');
        return this;
      },
      sort(fields) {
        assert.deepEqual(fields, { fullName: 1 });
        return this;
      },
      lean: async () => [{
        _id: parentId,
        fullName: '  ',
        email: 'parent@example.com',
        phone: '555-0100',
        password: 'private',
        passwordResetTokenHash: 'private'
      }]
    };
  });
  const res = responseStub();

  await getParentOptions({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, [{
    _id: parentId,
    fullName: '',
    email: 'parent@example.com',
    phone: '555-0100'
  }]);
});

test('parent options endpoint reports database errors without exposing internals', async t => {
  t.mock.method(User, 'find', () => {
    throw new Error('private database diagnostic');
  });
  const res = responseStub();

  await getParentOptions({}, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, 'Unable to load parent accounts. Please try again.');
  assert.equal(JSON.stringify(res.body).includes('private database diagnostic'), false);
});
