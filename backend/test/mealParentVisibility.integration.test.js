const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Child = require('../models/Child');
const Meal = require('../models/Meal');

test('nanny meal scheduling and intake are persisted and visible only to linked parents', {
  timeout: 120000
}, async () => {
  const mongo = await MongoMemoryServer.create();
  const previousJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'meal-parent-visibility-integration-secret';
  let server;

  try {
    await mongoose.connect(mongo.getUri('daycare-meal-parent-test'));

    const [nanny, otherNanny, parent, otherParent] = await User.create([
      { fullName: 'Meal Test Nanny', email: 'meal-nanny@example.com', role: 'teacher', approvalStatus: 'approved' },
      { fullName: 'Other Meal Nanny', email: 'meal-other-nanny@example.com', role: 'teacher', approvalStatus: 'approved' },
      { fullName: 'Meal Test Parent', email: 'meal-parent@example.com', role: 'parent', approvalStatus: 'approved' },
      { fullName: 'Other Meal Parent', email: 'meal-other-parent@example.com', role: 'parent', approvalStatus: 'approved' }
    ]);
    const [classroom, otherClassroom] = await Classroom.create([
      { name: 'Meal Test Room', ageGroup: '2-3 years', capacity: 10, teacher: nanny._id, status: 'active' },
      { name: 'Other Meal Room', ageGroup: '3-4 years', capacity: 10, teacher: otherNanny._id, status: 'active' }
    ]);
    const [child, otherChild] = await Child.create([
      {
        firstName: 'Linked',
        lastName: 'Child',
        dateOfBirth: new Date('2022-01-01'),
        gender: 'female',
        classroom: classroom._id,
        parents: [parent._id],
        status: 'active'
      },
      {
        firstName: 'Unlinked',
        lastName: 'Child',
        dateOfBirth: new Date('2021-01-01'),
        gender: 'male',
        classroom: otherClassroom._id,
        parents: [otherParent._id],
        status: 'active'
      }
    ]);

    const app = express();
    app.use(express.json());
    app.use('/api/meals', require('../routes/meals'));
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/meals`;
    const request = (path, user, { method = 'GET', body } = {}) => {
      const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET);
      const authorizationHeader = ['Bearer', token].join(' ');
      return fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: authorizationHeader,
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
    };

    const createResponse = await request('/', nanny, {
      method: 'POST',
      body: {
        name: 'Integration Oatmeal',
        type: 'breakfast',
        date: '2026-10-15',
        time: '08:00',
        items: 'Oatmeal and fruit',
        allergies: 'Contains dairy',
        classroom: String(classroom._id),
        children: [String(child._id)]
      }
    });
    assert.equal(createResponse.status, 201, await createResponse.clone().text());
    const created = await createResponse.json();
    const mealId = created.data._id;
    assert.deepEqual(created.data.children.map(item => String(item._id)), [String(child._id)]);
    const persisted = await Meal.findById(mealId).lean();
    assert.equal(persisted.name, 'Integration Oatmeal');

    const unrelatedParentResponse = await request('/', otherParent);
    assert.equal(unrelatedParentResponse.status, 200);
    assert.deepEqual((await unrelatedParentResponse.json()).data, []);

    const crossChildResponse = await request(`/?childId=${otherChild._id}`, parent);
    assert.equal(crossChildResponse.status, 404);

    const unrelatedNannyUpdate = await request(`/${mealId}`, otherNanny, {
      method: 'PUT',
      body: { status: 'prepared' }
    });
    assert.equal(unrelatedNannyUpdate.status, 404);

    for (const status of ['prepared', 'served']) {
      const updateResponse = await request(`/${mealId}`, nanny, {
        method: 'PUT',
        body: { status }
      });
      assert.equal(updateResponse.status, 200);
    }

    const intakeResponse = await request(`/${mealId}/intake`, nanny, {
      method: 'PUT',
      body: {
        records: [{
          childId: String(child._id),
          status: 'partially_eaten',
          quantity: 60,
          notes: 'Ate most of the fruit.'
        }]
      }
    });
    assert.equal(intakeResponse.status, 200);

    const parentMealResponse = await request('/', parent);
    assert.equal(parentMealResponse.status, 200);
    const parentMeals = await parentMealResponse.json();
    assert.equal(parentMeals.count, 1);
    assert.deepEqual(parentMeals.data[0].children.map(item => String(item._id)), [String(child._id)]);
    assert.equal(parentMeals.data[0].intake[0].status, 'partially_eaten');
    assert.equal(parentMeals.data[0].intake[0].quantity, 60);
    assert.equal(String(parentMeals.data[0].intake[0].child._id), String(child._id));
    assert.equal(parentMeals.data[0].createdByName, 'Meal Test Nanny');
    assert.equal(parentMeals.data[0].intake[0].recordedByName, 'Meal Test Nanny');
    assert.equal(Object.hasOwn(parentMeals.data[0], 'createdBy'), false);
    assert.equal(Object.hasOwn(parentMeals.data[0].intake[0], 'recordedBy'), false);

    const refreshedParentResponse = await request(`/?childId=${child._id}`, parent);
    assert.equal(refreshedParentResponse.status, 200);
    assert.equal((await refreshedParentResponse.json()).count, 1);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  }
});
