const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      'No MONGODB_URI found in .env — add your local or Atlas connection string.'
    );
  }

  console.log('📡 Connecting to MongoDB...');

  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
  });

  console.log(`✅ MongoDB connected: ${conn.connection.host}\n`);
  return conn;
};

module.exports = connectDB;
