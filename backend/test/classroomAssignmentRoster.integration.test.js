const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Child = require('../models/Child');

test('admin classroom assignment persists and only the assigned nanny sees its students', {
  timeout: 120000
}, async t => {
  const mongo = await MongoMemoryServer.create();
  const previousJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'classroom-roster-integration-test-secret';

  let server;
  try {
    await mongoose.connect(mongo.getUri('daycare-roster-test'));

    const [admin, assignedNanny, otherNanny] = await User.create([
      {
        fullName: 'Test Administrator',
        email: 'roster-admin@example.com',
        role: 'admin',
        approvalStatus: 'approved'
      },
      {
        fullName: 'Assigned Nanny',
        email: 'roster-assigned@example.com',
        role: 'teacher',
        approvalStatus: 'approved'
      },
      {
        fullName: 'Other Nanny',
        email: 'roster-other@example.com',
        role: 'teacher',
        approvalStatus: 'approved'
      }
    ]);
    const classroom = await Classroom.create({
      name: 'Integration Test Room',
      ageGroup: '2-3 years',
      capacity: 10
    });
    const child = await Child.create({
      firstName: 'Assigned',
      lastName: 'Student',
      dateOfBirth: new Date('2022-01-01'),
      gender: 'female',
      classroom: classroom._id,
      status: 'active'
    });

    const app = express();
    app.use(express.json());
    app.use('/api/classrooms', require('../routes/classrooms'));
    app.use('/api/children', require('../routes/children'));
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

    const request = (url, user, { method = 'GET', body } = {}) => {
      const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET);
      return fetch(`${baseUrl}${url}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
    };

    const assignmentResponse = await request(`/classrooms/${classroom._id}`, admin, {
      method: 'PUT',
      body: { teacher: String(assignedNanny._id) }
    });
    assert.equal(assignmentResponse.status, 200);
    const assignmentBody = await assignmentResponse.json();
    assert.equal(String(assignmentBody.data.teacher._id), String(assignedNanny._id));

    const persistedClassroom = await Classroom.findById(classroom._id).lean();
    assert.equal(String(persistedClassroom.teacher), String(assignedNanny._id));

    const rosterResponse = await request('/children?includePending=true', assignedNanny);
    assert.equal(rosterResponse.status, 200);
    const rosterBody = await rosterResponse.json();
    assert.equal(rosterBody.assignmentStatus, 'assigned');
    assert.equal(rosterBody.enrolledCount, 1);
    assert.deepEqual(rosterBody.data.map(item => String(item._id)), [String(child._id)]);

    const assignedClassroomsResponse = await request('/classrooms/my-classroom', assignedNanny);
    assert.equal(assignedClassroomsResponse.status, 200);
    const assignedClassroomsBody = await assignedClassroomsResponse.json();
    assert.deepEqual(
      assignedClassroomsBody.data.map(item => String(item._id)),
      [String(classroom._id)]
    );
    assert.deepEqual(
      assignedClassroomsBody.data[0].children.map(item => String(item._id)),
      [String(child._id)]
    );

    const unassignedNannyResponse = await request('/children?includePending=true', otherNanny);
    assert.equal(unassignedNannyResponse.status, 200);
    const unassignedNannyBody = await unassignedNannyResponse.json();
    assert.equal(unassignedNannyBody.assignmentStatus, 'unassigned');
    assert.deepEqual(unassignedNannyBody.data, []);

    const unauthorizedChildResponse = await request(`/children/${child._id}`, otherNanny);
    assert.equal(unauthorizedChildResponse.status, 404);

    const invalidClassroomResponse = await request('/classrooms/not-an-object-id', admin);
    assert.equal(invalidClassroomResponse.status, 400);

    const conflictingAssignmentResponse = await request(`/classrooms/${classroom._id}`, admin, {
      method: 'PUT',
      body: { teacher: String(otherNanny._id) }
    });
    assert.equal(conflictingAssignmentResponse.status, 409);

    const confirmedReassignmentResponse = await request(`/classrooms/${classroom._id}`, admin, {
      method: 'PUT',
      body: {
        teacher: String(otherNanny._id),
        confirmReassignment: true
      }
    });
    assert.equal(confirmedReassignmentResponse.status, 200);
    const reassignedClassroom = await Classroom.findById(classroom._id).lean();
    assert.equal(String(reassignedClassroom.teacher), String(otherNanny._id));

    const previousNannyRosterResponse = await request('/children?includePending=true', assignedNanny);
    assert.equal(previousNannyRosterResponse.status, 200);
    const previousNannyRoster = await previousNannyRosterResponse.json();
    assert.equal(previousNannyRoster.assignmentStatus, 'unassigned');
    assert.deepEqual(previousNannyRoster.data, []);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  }
});
