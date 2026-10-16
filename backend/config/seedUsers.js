const mongoose = require('mongoose');
const connectDB = require('./db');
const { seedUsersStage } = require('./seed');

(async () => {
  try {
    await connectDB();
    await seedUsersStage();
    console.log('User seed check completed.');
  } catch (err) {
    console.error('User seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
