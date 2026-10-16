const test = require('node:test');
const assert = require('node:assert/strict');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const DailyReport = require('../models/DailyReport');
const reportsRouter = require('../routes/reports');
const {
  getReports,
  getReport,
  createReport,
  acknowledgeReport
} = require('../controllers/reportController');

const ids = {
  parent: '507f1f77bcf86cd799439011',
  teacher: '507f1f77bcf86cd799439012',
  classroom: '507f1f77bcf86cd799439013',
  child: '507f1f77bcf86cd799439014',
  otherChild: '507f1f77bcf86cd799439015',
  report: '507f1f77bcf86cd799439016'
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

const childIdsQuery = idsToReturn => ({
  select(fields) {
    assert.equal(fields, '_id');
    return this;
  },
  lean: async () => idsToReturn.map(_id => ({ _id }))
});

const populatedReportQuery = value => ({
  populate() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  }
});

const reportsListQuery = value => ({
  populate() {
    return this;
  },
  sort() {
    return this;
  },
  limit(limit) {
    assert.equal(limit, 50);
    return this;
  },
  lean() {
    return this;
  },
  maxTimeMS(timeout) {
    assert.equal(timeout, 8000);
    return Promise.resolve(value);
  }
});

test('reports route keeps reads authenticated and report writes role-restricted', () => {
  assert.ok(reportsRouter.stack.some(layer => layer.name === 'protect'));
  const reportsRoute = reportsRouter.stack.find(layer =>
    layer.route?.path === '/' && layer.route.methods.get
  );
  assert.ok(reportsRoute);
  assert.equal(reportsRoute.route.stack.length, 3);
  assert.ok(reportsRoute.route.stack.some(layer => layer.name === 'getReports'));
});

test('parent activity reports include actual activity entries for their linked children only', async t => {
  const expectedReport = {
    _id: ids.report,
    child: { _id: ids.child, firstName: 'Linked', lastName: 'Child' },
    activities: [{ name: 'Story Time', category: 'reading' }]
  };
  t.mock.method(Child, 'find', filter => {
    assert.deepEqual(filter, { parents: ids.parent });
    return childIdsQuery([ids.child]);
  });
  t.mock.method(DailyReport, 'find', filter => {
    assert.deepEqual(filter, { child: { $in: [ids.child] } });
    return reportsListQuery([expectedReport]);
  });
  const response = responseStub();

  await getReports({
    user: { _id: ids.parent, role: 'parent' },
    query: {}
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.count, 1);
  assert.deepEqual(response.body.data[0].activities, expectedReport.activities);
});

test('parent-supplied child filters cannot broaden access to another child', async t => {
  t.mock.method(Child, 'find', () => childIdsQuery([ids.child]));
  const find = t.mock.method(DailyReport, 'find', filter => {
    assert.deepEqual(filter, { child: { $in: [] } });
    return reportsListQuery([]);
  });
  const response = responseStub();

  await getReports({
    user: { _id: ids.parent, role: 'parent' },
    query: { childId: ids.otherChild }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data, []);
  assert.equal(find.mock.callCount(), 1);
});

test('parent report detail and acknowledgement queries both enforce child ownership', async t => {
  t.mock.method(Child, 'find', () => childIdsQuery([ids.child]));
  const findOne = t.mock.method(DailyReport, 'findOne', filter => {
    assert.deepEqual(filter, {
      _id: ids.report,
      child: { $in: [ids.child] }
    });
    return populatedReportQuery({
      _id: ids.report,
      activities: [{ name: 'Story Time', category: 'reading' }]
    });
  });
  const detailResponse = responseStub();

  await getReport({
    user: { _id: ids.parent, role: 'parent' },
    params: { id: ids.report }
  }, detailResponse);

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(findOne.mock.callCount(), 1);

  const update = t.mock.method(DailyReport, 'findOneAndUpdate', (filter, values, options) => {
    assert.deepEqual(filter, {
      _id: ids.report,
      child: { $in: [ids.child] }
    });
    assert.deepEqual(values, { $set: { parentAcknowledged: true } });
    assert.deepEqual(options, { new: true });
    return Promise.resolve({ _id: ids.report, parentAcknowledged: true });
  });
  const acknowledgeResponse = responseStub();

  await acknowledgeReport({
    user: { _id: ids.parent, role: 'parent' },
    params: { id: ids.report }
  }, acknowledgeResponse);

  assert.equal(acknowledgeResponse.statusCode, 200);
  assert.equal(acknowledgeResponse.body.data.parentAcknowledged, true);
  assert.equal(update.mock.callCount(), 1);
});

test('activity report creation uses the child classroom and validates teacher assignment', async t => {
  const createdReport = {
    _id: ids.report,
    child: ids.child,
    classroom: ids.classroom,
    createdBy: ids.teacher,
    activities: [{ name: 'Story Time', category: 'reading' }]
  };
  t.mock.method(Child, 'findById', childId => {
    assert.equal(childId, ids.child);
    return {
      select(fields) {
        assert.equal(fields, 'classroom');
        return this;
      },
      lean: async () => ({ _id: ids.child, classroom: ids.classroom })
    };
  });
  t.mock.method(Classroom, 'exists', filter => {
    assert.deepEqual(filter, { _id: ids.classroom, teacher: ids.teacher });
    return Promise.resolve({ _id: ids.classroom });
  });
  let storedReport;
  t.mock.method(DailyReport, 'create', async values => {
    storedReport = values;
    return { _id: ids.report };
  });
  t.mock.method(DailyReport, 'findById', reportId => {
    assert.equal(reportId, ids.report);
    return populatedReportQuery(createdReport);
  });
  const response = responseStub();

  await createReport({
    user: { _id: ids.teacher, role: 'teacher' },
    body: {
      child: ids.child,
      classroom: ids.classroom,
      createdBy: ids.parent,
      activities: [{ name: 'Story Time', category: 'reading' }]
    }
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(storedReport.classroom, ids.classroom);
  assert.equal(storedReport.createdBy, ids.teacher);
  assert.deepEqual(storedReport.activities, [{ name: 'Story Time', category: 'reading' }]);
  assert.deepEqual(response.body.data.activities, storedReport.activities);
});

test('teacher activity report creation rejects a classroom not assigned to them', async t => {
  t.mock.method(Child, 'findById', () => ({
    select() {
      return this;
    },
    lean: async () => ({ _id: ids.child, classroom: ids.classroom })
  }));
  t.mock.method(Classroom, 'exists', async () => null);
  const create = t.mock.method(DailyReport, 'create', async () => {
    throw new Error('An unauthorized activity report was persisted.');
  });
  const response = responseStub();

  await createReport({
    user: { _id: ids.teacher, role: 'teacher' },
    body: { child: ids.child, activities: [{ name: 'Story Time', category: 'reading' }] }
  }, response);

  assert.equal(response.statusCode, 403);
  assert.equal(create.mock.callCount(), 0);
});
