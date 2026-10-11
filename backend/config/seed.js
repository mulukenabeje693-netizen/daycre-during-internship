const User = require('../models/User');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');

const seedAll = async () => {
  // Run seed with a 30-second timeout — server starts regardless
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Seed timeout after 30s')), 30000)
  );
  try {
    await Promise.race([_runSeed(), timeout]);
  } catch (err) {
    console.error(`❌ Seeding error: ${err.message}`);
  }
};

const _runSeed = async () => {
  try {
    console.log('🌱 Running database seed checks...');

    // ── Users ──────────────────────────────────────────────
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

    const createdUsers = {};
    for (const u of userSeeds) {
      let user = await User.findOne({ email: u.email });
      if (!user) {
        user = await User.create(u);
        console.log(`  ✅ Seeded user: ${u.email} (${u.role})`);
      }
      // Skip password reset on existing users — avoids slow bcrypt on every boot
      createdUsers[u.email] = user;
    }

    // ── Classrooms ─────────────────────────────────────────
    const classroomSeeds = [
      { name: 'Sunshine Room', ageGroup: '1-2 years', capacity: 8, color: '#F59E0B', room: 'Room 101', teacher: createdUsers['habtamugetachew303@gmail.com']._id },
      { name: 'Rainbow Room', ageGroup: '2-3 years', capacity: 12, color: '#6366F1', room: 'Room 102', teacher: createdUsers['teacher2@daycare.com']._id },
      { name: 'Star Room', ageGroup: '3-4 years', capacity: 15, color: '#10B981', room: 'Room 103' },
      { name: 'Garden Room', ageGroup: '4-5 years', capacity: 18, color: '#EC4899', room: 'Room 104' }
    ];

    const createdClassrooms = {};
    for (const c of classroomSeeds) {
      let cls = await Classroom.findOne({ name: c.name });
      if (!cls) {
        cls = await Classroom.create(c);
        console.log(`  ✅ Seeded classroom: ${c.name}`);
      }
      createdClassrooms[c.name] = cls;
    }

    // ── Children ───────────────────────────────────────────
    const childSeeds = [
      {
        firstName: 'Emma', lastName: 'Johnson',
        dateOfBirth: new Date('2022-03-15'), gender: 'female',
        classroom: createdClassrooms['Sunshine Room']._id,
        parents: [createdUsers['habtamugetachew505@gmail.com']._id],
        allergies: 'Peanuts', vaccinationStatus: 'up-to-date',
        emergencyContact: { name: 'John Johnson', phone: '555-0101', relationship: 'Father' }
      },
      {
        firstName: 'Liam', lastName: 'Williams',
        dateOfBirth: new Date('2021-07-22'), gender: 'male',
        classroom: createdClassrooms['Rainbow Room']._id,
        parents: [createdUsers['parent2@daycare.com']._id],
        vaccinationStatus: 'up-to-date',
        emergencyContact: { name: 'Mary Williams', phone: '555-0202', relationship: 'Mother' }
      },
      {
        firstName: 'Sophia', lastName: 'Davis',
        dateOfBirth: new Date('2020-11-05'), gender: 'female',
        classroom: createdClassrooms['Star Room']._id,
        parents: [createdUsers['habtamugetachew505@gmail.com']._id],
        allergies: 'Dairy', vaccinationStatus: 'up-to-date',
        emergencyContact: { name: 'John Parent', phone: '555-0103', relationship: 'Father' }
      },
      {
        firstName: 'Noah', lastName: 'Brown',
        dateOfBirth: new Date('2019-04-12'), gender: 'male',
        classroom: createdClassrooms['Garden Room']._id,
        parents: [createdUsers['parent2@daycare.com']._id],
        vaccinationStatus: 'incomplete',
        emergencyContact: { name: 'Mary Williams', phone: '555-0202', relationship: 'Mother' }
      }
    ];

    const createdChildren = [];
    for (const c of childSeeds) {
      const exists = await Child.findOne({ firstName: c.firstName, lastName: c.lastName });
      if (!exists) {
        const child = await Child.create(c);
        createdChildren.push(child);
        console.log(`  ✅ Seeded child: ${c.firstName} ${c.lastName}`);
      } else {
        createdChildren.push(exists);
      }
    }

    // ── Payments ───────────────────────────────────────────
    const paymentSeeds = [
      {
        parent: createdUsers['habtamugetachew505@gmail.com']._id,
        child: createdChildren[0]._id,
        type: 'monthly-fee', amount: 850,
        dueDate: new Date(new Date().setDate(1)),
        status: 'paid', paidDate: new Date(), method: 'card'
      },
      {
        parent: createdUsers['parent2@daycare.com']._id,
        child: createdChildren[1]._id,
        type: 'monthly-fee', amount: 850,
        dueDate: new Date(new Date().setDate(1)),
        status: 'overdue',
        createdBy: createdUsers['habtamugetachew202@gmail.com']._id
      },
      {
        parent: createdUsers['habtamugetachew505@gmail.com']._id,
        child: createdChildren[2]._id,
        type: 'monthly-fee', amount: 850,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        createdBy: createdUsers['habtamugetachew202@gmail.com']._id
      }
    ];

    for (const p of paymentSeeds) {
      const exists = await Payment.findOne({ parent: p.parent, child: p.child, type: p.type });
      if (!exists) {
        await Payment.create(p);
        console.log(`  ✅ Seeded payment record`);
      }
    }

    // ── Appointments ───────────────────────────────────────
    const apptSeeds = [
      {
        title: 'Progress Review - Emma Johnson',
        type: 'parent-teacher-meeting',
        requestedBy: createdUsers['habtamugetachew505@gmail.com']._id,
        withUser: createdUsers['habtamugetachew303@gmail.com']._id,
        child: createdChildren[0]._id,
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        duration: 30,
        status: 'confirmed',
        location: 'Room 101'
      },
      {
        title: 'Enrollment Tour',
        type: 'enrollment-tour',
        requestedBy: createdUsers['parent2@daycare.com']._id,
        scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        duration: 60,
        status: 'pending',
        location: 'Main Office'
      }
    ];

    for (const a of apptSeeds) {
      const exists = await Appointment.findOne({ title: a.title });
      if (!exists) {
        await Appointment.create(a);
        console.log(`  ✅ Seeded appointment: ${a.title}`);
      }
    }

    console.log('\n✨ Database seeding completed successfully!\n');
  } catch (error) {
    console.error(`❌ Seeding error: ${error.message}`);
  }
};

module.exports = seedAll;
