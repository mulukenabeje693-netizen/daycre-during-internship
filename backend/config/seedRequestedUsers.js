const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { StringDecoder } = require('string_decoder');
const User = require('../models/User');

const requestedUsers = [
  { email: 'habtamugetachew505@gmail.com', role: 'parent' },
  { email: 'habtamugetachew202@gmail.com', role: 'admin' },
  { email: 'habtamugetachew606@gmail.com', role: 'reception' },
  { email: 'habtamugetachew303@gmail.com', role: 'staff' }
];

const readSecureInput = (prompt) => {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Secure interactive input requires a local terminal.');
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder('utf8');
    let value = '';

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };

    const onData = (chunk) => {
      const input = decoder.write(chunk);
      for (const character of input) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Secure input was cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          resolve(value);
          return;
        }
        if (character === '\u0008' || character === '\u007f') {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };

    process.stdin.on('data', onData);
  });
};

const getConfiguredDatabase = () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured in backend/.env.');
  }

  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch {
    throw new Error('The configured MongoDB URI is invalid.');
  }

  const database = decodeURIComponent(parsedUri.pathname.replace(/^\//, '').split('/')[0] || '');
  if (database !== 'daycare') {
    throw new Error('Refusing to seed: backend/.env must target the existing daycare database.');
  }
  return database;
};

const collectNewUsers = async (missingUsers) => {
  const users = [];

  for (const requested of missingUsers) {
    const fullName = (await readSecureInput(`Full name for ${requested.email}: `)).trim();
    if (!fullName) {
      throw new Error(`A full name is required for ${requested.email}.`);
    }

    const password = await readSecureInput(`Replacement password for ${requested.email} (hidden): `);
    if (password.length < 6) {
      throw new Error(`Password for ${requested.email} must be at least 6 characters.`);
    }

    const confirmation = await readSecureInput(`Confirm replacement password for ${requested.email} (hidden): `);
    if (password !== confirmation) {
      throw new Error(`Password confirmation did not match for ${requested.email}.`);
    }

    const user = new User({
      fullName,
      email: requested.email,
      password,
      role: requested.role
    });
    await user.validate();
    users.push(user);
  }

  return users;
};

const seedRequestedUsers = async () => {
  const database = getConfiguredDatabase();
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  if (mongoose.connection.name !== database) {
    throw new Error('Refusing to seed: connected database does not match the configured target.');
  }

  console.log(`Connected to configured database: ${database}.`);
  console.log('Role mapping: "nanny" is not supported; using the compatible existing role "staff".');

  const existingUsers = new Set();
  for (const requested of requestedUsers) {
    if (await User.exists({ email: requested.email })) {
      existingUsers.add(requested.email);
    }
  }

  const missingUsers = requestedUsers.filter(user => !existingUsers.has(user.email));
  const newUsers = await collectNewUsers(missingUsers);
  let created = 0;

  for (const user of newUsers) {
    try {
      await user.save();
      created++;
    } catch (error) {
      if (error.code === 11000 && await User.exists({ email: user.email })) {
        existingUsers.add(user.email);
        continue;
      }
      throw new Error(`Could not create ${user.email}: ${error.message}`);
    }
  }

  console.log(JSON.stringify({
    database,
    created,
    alreadyPresent: existingUsers.size,
    requested: requestedUsers.length
  }));
};

if (require.main === module) {
  seedRequestedUsers()
    .catch((error) => {
      console.error(`Requested-user seed failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}

module.exports = {
  requestedUsers,
  readSecureInput,
  getConfiguredDatabase,
  collectNewUsers,
  seedRequestedUsers
};
