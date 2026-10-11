/**
 * Standalone script to seed users into MongoDB Atlas.
 * Run with: node config/seedUsers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const users = [
  { fullName: 'System Administrator',  email: 'habtamugetachew202@gmail.com', password: 'Admin#123',      role: 'admin' },
  { fullName: 'Kalkidan Minda',         email: 'kalkidanminda6@gmail.com',      password: 'Admin#123',      role: 'admin' },
  { fullName: 'Sarah Johnson',          email: 'habtamugetachew303@gmail.com',  password: 'Nanny#123',      role: 'teacher' },
  { fullName: 'Emma Clarke',            email: 'teacher2@daycare.com',          password: 'teacher123',     role: 'teacher' },
  { fullName: 'John Parent',            email: 'habtamugetachew505@gmail.com',  password: 'Parent#123',     role: 'parent' },
  { fullName: 'Mary Williams',          email: 'parent2@daycare.com',           password: 'parent123',      role: 'parent' },
  { fullName: 'Maya Reception',         email: 'habtamugetachew606@gmail.com',  password: 'Reception#123',  role: 'reception' },
  { fullName: 'Nina Support',           email: 'staff@daycare.com',             password: 'staff123',       role: 'staff' }
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas\n');

    let created = 0;
    let skipped = 0;

    for (const u of users) {
      const exists = await User.findOne({ email: u.email });
      if (exists) {
        console.log(`  ⏭️  Skipped (already exists): ${u.email}`);
        skipped++;
      } else {
        await User.create(u);
        console.log(`  ✅ Created: ${u.email}  [${u.role}]  password: ${u.password}`);
        created++;
      }
    }

    console.log(`\n🎉 Done — ${created} created, ${skipped} skipped.`);
    console.log('\n📋 Login credentials summary:');
    console.log('─────────────────────────────────────────────────────────');
    console.log('  Role        Email                        Password');
    console.log('─────────────────────────────────────────────────────────');
    for (const u of users) {
      console.log(`  ${u.role.padEnd(11)} ${u.email.padEnd(32)} ${u.password}`);
    }
    console.log('─────────────────────────────────────────────────────────\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seed();
