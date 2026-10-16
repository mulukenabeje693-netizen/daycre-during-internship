const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Child = require('../models/Child');
const Attendance = require('../models/Attendance');
const TeacherAttendance = require('../models/TeacherAttendance');
const DailyReport = require('../models/DailyReport');
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Message = require('../models/Message');
const SystemSetting = require('../models/SystemSetting');
const Visitor = require('../models/Visitor');
const connectDB = require('./db');

const userSeeds = [
  { fullName: 'System Administrator', email: 'habtamugetachew202@gmail.com', password: 'Admin#123', role: 'admin' },
  { fullName: 'Kalkidan Minda', email: 'kalkidanminda6@gmail.com', password: 'Admin#123', role: 'admin' },
  { fullName: 'Sarah Johnson', email: 'habtamugetachew303@gmail.com', password: 'Nanny#123', role: 'teacher' },
  { fullName: 'Emma Clarke', email: 'teacher2@daycare.com', password: 'teacher123', role: 'teacher' },
  { fullName: 'John Parent', email: 'habtamugetachew505@gmail.com', password: 'Parent#123', role: 'parent' },
  { fullName: 'Mary Williams', email: 'parent2@daycare.com', password: 'parent123', role: 'parent' },
  { fullName: 'Maya Reception', email: 'habtamugetachew606@gmail.com', password: 'Reception#123', role: 'reception' },
  { fullName: 'Nina Support', email: 'staff@daycare.com', password: 'staff123', role: 'staff' }
];

const classroomSeeds = [
  { name: 'Sunshine Room', ageGroup: '1-2 years', capacity: 8, color: '#F59E0B', room: 'Room 101', teacherEmail: 'habtamugetachew303@gmail.com' },
  { name: 'Rainbow Room', ageGroup: '2-3 years', capacity: 12, color: '#6366F1', room: 'Room 102', teacherEmail: 'teacher2@daycare.com' },
  { name: 'Star Room', ageGroup: '3-4 years', capacity: 15, color: '#10B981', room: 'Room 103' },
  { name: 'Garden Room', ageGroup: '4-5 years', capacity: 18, color: '#EC4899', room: 'Room 104' }
];

const childSeeds = [
  {
    firstName: 'Emma', lastName: 'Johnson',
    dateOfBirth: new Date('2022-03-15'), gender: 'female',
    classroomName: 'Sunshine Room', parentEmail: 'habtamugetachew505@gmail.com',
    allergies: 'Peanuts', vaccinationStatus: 'up-to-date',
    emergencyContact: { name: 'John Johnson', phone: '555-0101', relationship: 'Father' }
  },
  {
    firstName: 'Liam', lastName: 'Williams',
    dateOfBirth: new Date('2021-07-22'), gender: 'male',
    classroomName: 'Rainbow Room', parentEmail: 'parent2@daycare.com',
    vaccinationStatus: 'up-to-date',
    emergencyContact: { name: 'Mary Williams', phone: '555-0202', relationship: 'Mother' }
  },
  {
    firstName: 'Sophia', lastName: 'Davis',
    dateOfBirth: new Date('2020-11-05'), gender: 'female',
    classroomName: 'Star Room', parentEmail: 'habtamugetachew505@gmail.com',
    allergies: 'Dairy', vaccinationStatus: 'up-to-date',
    emergencyContact: { name: 'John Parent', phone: '555-0103', relationship: 'Father' }
  },
  {
    firstName: 'Noah', lastName: 'Brown',
    dateOfBirth: new Date('2019-04-12'), gender: 'male',
    classroomName: 'Garden Room', parentEmail: 'parent2@daycare.com',
    vaccinationStatus: 'incomplete',
    emergencyContact: { name: 'Mary Williams', phone: '555-0202', relationship: 'Mother' }
  }
];

const getDayStart = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getPathValue = (value, dottedPath) =>
  dottedPath.split('.').reduce((current, key) => current == null ? undefined : current[key], value);

const assertTargetDatabase = () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri || mongoose.connection.name !== 'daycare') {
    throw new Error('Refusing to seed: the connected database must be daycare.');
  }

  const uriDatabase = decodeURIComponent(new URL(uri).pathname.replace(/^\//, '').split('/')[0] || '');
  if (uriDatabase !== 'daycare') {
    throw new Error('Refusing to seed: the configured URI must target daycare.');
  }
};

const getModelHealth = async (Model) => {
  const docs = await Model.collection.find({}).toArray();
  let invalidDocuments = 0;
  let danglingReferences = 0;

  for (const doc of docs) {
    if (Model.hydrate(doc).validateSync()) invalidDocuments++;
  }

  for (const [dottedPath, schemaType] of Object.entries(Model.schema.paths)) {
    const refName = schemaType.options && schemaType.options.ref;
    if (!refName || !mongoose.models[refName]) continue;

    const targetCollection = mongoose.model(refName).collection;
    for (const doc of docs) {
      const value = getPathValue(doc, dottedPath);
      const values = Array.isArray(value) ? value : (value == null ? [] : [value]);
      for (const id of values) {
        if (
          !mongoose.Types.ObjectId.isValid(id) ||
          !await targetCollection.findOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { projection: { _id: 1 } }
          )
        ) {
          danglingReferences++;
        }
      }
    }
  }

  return { count: docs.length, invalidDocuments, danglingReferences };
};

const reportStage = async (stage, Models, insertMissing) => {
  assertTargetDatabase();
  const before = {};
  for (const Model of Models) before[Model.collection.collectionName] = await Model.countDocuments();

  const inserted = await insertMissing();
  const after = {};
  for (const Model of Models) {
    after[Model.collection.collectionName] = await getModelHealth(Model);
  }

  console.log(JSON.stringify({ stage, inserted, before, after }));
  for (const health of Object.values(after)) {
    if (health.invalidDocuments || health.danglingReferences) {
      throw new Error(`${stage} validation failed; see the stage results above.`);
    }
  }
  return inserted;
};

const createIfMissing = async (Model, filter, document) => {
  const exists = await Model.exists(filter);
  if (exists) return false;
  await Model.create(document);
  return true;
};

const seedUsersStage = async () => reportStage('users', [User], async () => {
  let inserted = 0;
  for (const user of userSeeds) {
    if (await createIfMissing(User, { email: user.email.toLowerCase() }, user)) inserted++;
  }
  return inserted;
});

const seedAll = async () => {
  assertTargetDatabase();
  console.log('Running explicit, insert-only demo seed for database daycare.');

  await seedUsersStage();

  const users = new Map(
    (await User.find({ email: { $in: userSeeds.map(user => user.email) } }))
      .map(user => [user.email, user])
  );
  const admin = users.get('habtamugetachew202@gmail.com');
  if (!admin || admin.role !== 'admin') {
    throw new Error('Required demo admin account is missing or has a different role.');
  }

  const classrooms = new Map();
  await reportStage('classrooms', [Classroom], async () => {
    let inserted = 0;
    for (const seed of classroomSeeds) {
      const document = { ...seed };
      delete document.teacherEmail;
      if (seed.teacherEmail) {
        const teacher = users.get(seed.teacherEmail);
        if (!teacher || teacher.role !== 'teacher') {
          throw new Error(`Required teacher role is missing for classroom ${seed.name}.`);
        }
        document.teacher = teacher._id;
      }
      if (await createIfMissing(Classroom, { name: seed.name }, document)) inserted++;
    }
    return inserted;
  });
  for (const classroom of await Classroom.find({ name: { $in: classroomSeeds.map(item => item.name) } })) {
    classrooms.set(classroom.name, classroom);
  }

  await reportStage('children', [Child], async () => {
    let inserted = 0;
    for (const seed of childSeeds) {
      const parent = users.get(seed.parentEmail);
      const classroom = classrooms.get(seed.classroomName);
      if (!parent || parent.role !== 'parent' || !classroom) {
        throw new Error(`Required parent or classroom reference is missing for ${seed.firstName}.`);
      }

      const document = { ...seed, parents: [parent._id], classroom: classroom._id };
      delete document.parentEmail;
      delete document.classroomName;
      if (await createIfMissing(Child, { firstName: seed.firstName, lastName: seed.lastName }, document)) inserted++;
    }
    return inserted;
  });

  const children = await Child.find({}).sort({ firstName: 1, lastName: 1 });
  const teachers = await User.find({ role: 'teacher' }).sort({ email: 1 });
  const parents = await User.find({ role: 'parent' }).sort({ email: 1 });
  const demoDate = getDayStart();

  await reportStage('appointments', [Appointment], async () => {
    const seeds = [
      {
        title: 'Progress Review - Emma Johnson',
        type: 'parent-teacher-meeting',
        requestedBy: users.get('habtamugetachew505@gmail.com')._id,
        withUser: users.get('habtamugetachew303@gmail.com')._id,
        child: children.find(child => child.firstName === 'Emma' && child.lastName === 'Johnson')?._id,
        scheduledAt: new Date(demoDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        duration: 30,
        status: 'confirmed',
        location: 'Room 101'
      },
      {
        title: 'Enrollment Tour',
        type: 'enrollment-tour',
        requestedBy: users.get('parent2@daycare.com')._id,
        scheduledAt: new Date(demoDate.getTime() + 5 * 24 * 60 * 60 * 1000),
        duration: 60,
        status: 'pending',
        location: 'Main Office'
      }
    ];
    let inserted = 0;
    for (const seed of seeds) {
      if (!seed.requestedBy || (seed.title.startsWith('Progress') && !seed.child)) {
        throw new Error('Required appointment seed references are missing.');
      }
      if (await createIfMissing(Appointment, { title: seed.title }, seed)) inserted++;
    }
    return inserted;
  });

  await reportStage('invoices', [Payment], async () => {
    let inserted = 0;
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);
    const monthStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
    const monthEnd = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 1);

    for (const child of children) {
      const parent = await User.findOne({ _id: { $in: child.parents }, role: 'parent' }).select('_id');
      if (!parent) throw new Error(`No valid parent relationship exists for a demo invoice.`);

      const existing = await Payment.exists({
        child: child._id,
        type: 'monthly-fee',
        dueDate: { $gte: monthStart, $lt: monthEnd },
        status: { $ne: 'cancelled' }
      });
      if (existing) continue;

      await Payment.create({
        parent: parent._id,
        child: child._id,
        type: 'monthly-fee',
        amount: 850,
        dueDate,
        status: 'pending',
        createdBy: admin._id,
        notes: 'Demo seed invoice; pending and unpaid.'
      });
      inserted++;
    }
    return inserted;
  });

  await reportStage('child-attendance', [Attendance], async () => {
    let inserted = 0;
    for (const child of children) {
      if (await createIfMissing(Attendance, { child: child._id, date: demoDate }, {
        child: child._id,
        classroom: child.classroom || null,
        date: demoDate,
        checkIn: { time: new Date(demoDate.getTime() + 9 * 60 * 60 * 1000), recordedBy: admin._id },
        status: 'present',
        notes: 'Demo seed record; not an actual attendance event.'
      })) inserted++;
    }
    return inserted;
  });

  await reportStage('teacher-attendance', [TeacherAttendance], async () => {
    let inserted = 0;
    for (const teacher of teachers) {
      if (await createIfMissing(TeacherAttendance, { teacher: teacher._id, date: demoDate }, {
        teacher: teacher._id,
        date: demoDate,
        status: 'present',
        checkIn: '09:00',
        checkOut: '-',
        markedBy: admin._id,
        note: 'Demo seed record; not an actual attendance event.'
      })) inserted++;
    }
    return inserted;
  });

  await reportStage('daily-reports', [DailyReport], async () => {
    let inserted = 0;
    for (const child of children) {
      const classroom = child.classroom;
      if (!classroom) continue;
      const creator = await User.findOne({ role: 'teacher' }).select('_id') || admin;
      if (await createIfMissing(DailyReport, { child: child._id, date: demoDate }, {
        child: child._id,
        classroom,
        date: demoDate,
        createdBy: creator._id,
        meals: {
          breakfast: { ate: 'most', notes: 'Demo entry' },
          lunch: { ate: 'all', notes: 'Demo entry' },
          snack: { ate: 'some', notes: 'Demo entry' }
        },
        activities: [{ name: 'Sample activity', description: 'Demo seed record.', category: 'reading' }],
        mood: 'happy',
        teacherNotes: 'Demo seed record; not an actual child report.'
      })) inserted++;
    }
    return inserted;
  });

  await reportStage('messages', [Message], async () => {
    let inserted = 0;
    for (const parent of parents) {
      const child = children.find(item => item.parents.some(id => id.equals(parent._id)));
      const subject = '[Demo] Welcome';
      const body = 'Demo seed message; this is sample content, not a real communication.';
      if (await createIfMissing(Message, { sender: admin._id, recipient: parent._id, subject, body }, {
        sender: admin._id,
        recipient: parent._id,
        subject,
        body,
        relatedChild: child?._id || null
      })) inserted++;
    }
    return inserted;
  });

  await reportStage('system-settings', [SystemSetting], async () => {
    if (await SystemSetting.exists({})) return 0;
    await SystemSetting.create({ onlinePaymentsEnabled: false, isFreeMode: true });
    return 1;
  });

  await reportStage('visitors', [Visitor], async () => {
    const checkedOut = new Date();
    const checkIn = new Date(checkedOut.getTime() - 60 * 60 * 1000);
    const child = children[0];
    if (!child) throw new Error('A child is required for the demo visitor record.');
    const inserted = await createIfMissing(
      Visitor,
      { fullName: 'Demo Visitor', purpose: 'Demo seed sample; not an actual visit.' },
      {
        fullName: 'Demo Visitor',
        purpose: 'Demo seed sample; not an actual visit.',
        host: 'Demo Reception',
        visitingChild: child._id,
        relationship: 'other',
        checkIn,
        checkOut: checkedOut,
        badgeNumber: '9001',
        status: 'checked-out',
        recordedBy: admin._id
      }
    );
    return inserted ? 1 : 0;
  });

  const collectionNames = new Set((await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
  console.log(JSON.stringify({
    stage: 'unsupported-collections',
    paymentattempts: {
      collectionExists: collectionNames.has('paymentattempts'),
      mongooseModelExists: mongoose.models.PaymentAttempt !== undefined,
      action: 'not created; no collection or project schema exists'
    }
  }));
};

if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seedAll();
      console.log('Explicit seed completed.');
    } catch (error) {
      console.error('Seed failed:', error.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}

module.exports = { seedAll, seedUsersStage };
