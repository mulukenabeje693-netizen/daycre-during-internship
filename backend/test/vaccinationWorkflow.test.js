const test = require('node:test');
const assert = require('node:assert/strict');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const router = require('../routes/vaccinations');
const { authorize } = require('../middleware/auth');
const {
  getVaccinations,
  createVaccination,
  updateVaccination,
  deleteVaccination
} = require('../controllers/vaccinationController');

const teacherId = '507f1f77bcf86cd799439011';
const roomId = '507f1f77bcf86cd799439012';
const childId = '507f1f77bcf86cd799439013';
const logId = '507f1f77bcf86cd799439014';
const validRecord = {
  name: 'Influenza (Flu)',
  dateGiven: '2025-01-15',
  nextDueDate: '2025-10-01',
  doseNumber: 1,
  status: 'Upcoming',
  provider: 'Clinic',
  notes: 'Recorded'
};

const responseStub = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

const classroomQuery = classrooms => ({
  select(fields) { assert.equal(fields, '_id'); return this; },
  lean() { return this; },
  maxTimeMS(value) { assert.equal(value, 5000); return Promise.resolve(classrooms); }
});

test('vaccination routes require authentication, allow parent reads, and keep writes staff-only', () => {
  const guards = router.stack.filter(layer => !layer.route);
  assert.equal(guards.length, 1);
  assert.equal(guards[0].name, 'protect');
  const routeGuard = (path, method) => router.stack
    .find(layer => layer.route?.path === path && layer.route.methods[method])
    .route.stack[0].handle;
  const getGuard = routeGuard('/', 'get');
  const postGuard = routeGuard('/', 'post');
  const updateGuard = routeGuard('/:childId/:logId', 'put');
  const deleteGuard = routeGuard('/:childId/:logId', 'delete');

  let parentReadAllowed = false;
  getGuard({ user: { role: 'parent' } }, responseStub(), () => { parentReadAllowed = true; });
  assert.equal(parentReadAllowed, true);
  for (const writeGuard of [postGuard, updateGuard, deleteGuard]) {
    const denied = responseStub();
    writeGuard({ user: { role: 'parent' } }, denied, () => assert.fail('Parent must not change vaccination records.'));
    assert.equal(denied.statusCode, 403);
  }
  let teacherWriteAllowed = false;
  updateGuard({ user: { role: 'teacher' } }, responseStub(), () => { teacherWriteAllowed = true; });
  assert.equal(teacherWriteAllowed, true);
});

test('teacher roster is limited to active classrooms and eligible children', async t => {
  t.mock.method(Classroom, 'find', filter => {
    assert.deepEqual(filter, { teacher: teacherId, status: 'active' });
    return classroomQuery([{ _id: roomId }]);
  });
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      status: { $in: ['active', 'approved'] },
      classroom: { $in: [roomId] }
    });
    return {
      select(fields) { assert.match(fields, /vaccinationLog/); return this; },
      populate(path) { assert.equal(path, 'classroom'); return this; },
      sort() { return this; },
      lean() { return this; },
      maxTimeMS: async value => {
        assert.equal(value, 8000);
        return [{ _id: childId, firstName: 'Actual', vaccinationLog: [] }];
      }
    };
  });
  const res = responseStub();

  await getVaccinations({ user: { _id: teacherId, role: 'teacher' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.data[0].firstName, 'Actual');
});

test('parent vaccination roster contains only eligible children linked to the authenticated parent', async t => {
  const parentId = '507f1f77bcf86cd799439016';
  const ownChild = { _id: childId, parents: [parentId], firstName: 'Own', vaccinationLog: [] };
  const otherChild = { _id: '507f1f77bcf86cd799439017', parents: ['507f1f77bcf86cd799439018'], firstName: 'Other', vaccinationLog: [] };
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, {
      status: { $in: ['active', 'approved'] },
      parents: parentId
    });
    return {
      select(fields) { assert.match(fields, /vaccinationLog/); return this; },
      populate(path) { assert.equal(path, 'classroom'); return this; },
      sort() { return this; },
      lean() { return this; },
      maxTimeMS: async value => {
        assert.equal(value, 8000);
        return [ownChild, otherChild].filter(child => child.parents.includes(filter.parents));
      }
    };
  });
  const res = responseStub();

  await getVaccinations({ user: { _id: parentId, role: 'parent' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.deepEqual(res.body.data.map(child => child.firstName), ['Own']);
});

test('invalid child ID and invalid vaccination dates are rejected', async () => {
  const badIdResponse = responseStub();
  await createVaccination({ body: { ...validRecord, childId: 'not-an-id' }, user: { role: 'admin' } }, badIdResponse);
  assert.equal(badIdResponse.statusCode, 400);

  const badDateResponse = responseStub();
  await createVaccination({
    body: { ...validRecord, childId, dateGiven: '2025-02-30' },
    user: { role: 'admin', fullName: 'Staff' }
  }, badDateResponse);
  assert.equal(badDateResponse.statusCode, 400);
  assert.match(badDateResponse.body.message, /valid administration date/);
});

test('future administration dates are rejected', async () => {
  const future = new Date();
  future.setDate(future.getDate() + 1);
  const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
  const res = responseStub();
  await createVaccination({
    body: { ...validRecord, childId, dateGiven: date },
    user: { role: 'admin', fullName: 'Staff' }
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /future/);
});

test('record creation is an atomic idempotent append for an eligible child', async t => {
  const createdLog = { _id: logId, ...validRecord, dateGiven: new Date('2025-01-15T00:00:00') };
  const child = { _id: childId, vaccinationLog: [createdLog] };
  t.mock.method(Child, 'findOneAndUpdate', (filter, update, options) => {
    assert.equal(filter._id, childId);
    assert.deepEqual(filter.status, { $in: ['active', 'approved'] });
    assert.equal(filter.vaccinationLog.$not.$elemMatch.name, validRecord.name);
    assert.equal(filter.vaccinationLog.$not.$elemMatch.doseNumber, 1);
    assert.equal(update.$push.vaccinationLog.givenBy, 'Verified Staff');
    assert.equal(options.runValidators, true);
    return Promise.resolve(child);
  });
  const res = responseStub();
  await createVaccination({
    body: { ...validRecord, childId, givenBy: 'Forged client name' },
    user: { role: 'admin', fullName: 'Verified Staff' }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.log._id, logId);
});

test('duplicate record creation returns conflict and missing/out-of-scope children return not found', async t => {
  t.mock.method(Child, 'findOneAndUpdate', async () => null);
  t.mock.method(Child, 'findOne', filter => ({
    select() { return this; },
    lean: async () => filter._id === childId ? { _id: childId } : null
  }));

  const duplicate = responseStub();
  await createVaccination({
    body: { ...validRecord, childId },
    user: { role: 'admin', fullName: 'Staff' }
  }, duplicate);
  assert.equal(duplicate.statusCode, 409);

  const outOfScope = responseStub();
  await createVaccination({
    body: { ...validRecord, childId: '507f1f77bcf86cd799439099' },
    user: { role: 'admin', fullName: 'Staff' }
  }, outOfScope);
  assert.equal(outOfScope.statusCode, 404);
});

test('teacher cannot create vaccination history for a pending or unassigned child', async t => {
  t.mock.method(Classroom, 'find', filter => {
    assert.deepEqual(filter, { teacher: teacherId, status: 'active' });
    return classroomQuery([{ _id: roomId }]);
  });
  t.mock.method(Child, 'findOneAndUpdate', filter => {
    assert.deepEqual(filter.classroom, { $in: [roomId] });
    assert.deepEqual(filter.status, { $in: ['active', 'approved'] });
    return Promise.resolve(null);
  });
  t.mock.method(Child, 'findOne', filter => ({
    select() { return this; },
    lean: async () => {
      assert.deepEqual(filter.classroom, { $in: [roomId] });
      assert.deepEqual(filter.status, { $in: ['active', 'approved'] });
      return null;
    }
  }));
  const res = responseStub();

  await createVaccination({
    body: { ...validRecord, childId },
    user: { _id: teacherId, role: 'teacher', fullName: 'Assigned Teacher' }
  }, res);

  assert.equal(res.statusCode, 404);
  assert.match(res.body.message, /authorized scope/);
});

test('updating a record rejects duplicate vaccine, date, and dose combinations', async t => {
  const matching = {
    _id: '507f1f77bcf86cd799439015',
    name: validRecord.name,
    dateGiven: new Date('2025-01-15T00:00:00'),
    doseNumber: 1
  };
  const edited = { _id: logId, name: 'Other vaccine' };
  const child = {
    vaccinationLog: [matching, edited],
    vaccinationLog: {
      id(id) { return id === logId ? edited : null; },
      some(predicate) { return [matching, edited].some(predicate); }
    },
    save: async () => {}
  };
  t.mock.method(Child, 'findOne', async () => child);
  const res = responseStub();

  await updateVaccination({
    params: { childId, logId },
    body: validRecord,
    user: { role: 'admin', fullName: 'Staff' }
  }, res);

  assert.equal(res.statusCode, 409);
});

test('update and delete operate only on an eligible child log', async t => {
  const log = { _id: logId, name: 'Old', deleteOne() { this.deleted = true; } };
  const logCollection = [log];
  const child = {
    _id: childId,
    vaccinationLog: {
      id: id => logCollection.find(entry => String(entry._id) === String(id)),
      some: predicate => logCollection.some(predicate)
    },
    save: async () => {}
  };
  t.mock.method(Child, 'findOne', async () => child);
  const updateResponse = responseStub();
  await updateVaccination({
    params: { childId, logId },
    body: validRecord,
    user: { role: 'admin', fullName: 'Staff' }
  }, updateResponse);
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(log.name, validRecord.name);

  const deleteResponse = responseStub();
  await deleteVaccination({ params: { childId, logId }, user: { role: 'admin' } }, deleteResponse);
  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(log.deleted, true);
});
