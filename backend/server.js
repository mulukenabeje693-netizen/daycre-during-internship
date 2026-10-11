const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const seedAll = require('./config/seed');
const http = require('http');
const { Server } = require('socket.io');
const compression = require('compression');

dotenv.config();

const app = express();
const server = http.createServer(app);

// ── CORS ───────────────────────────────────────────────────
// Allow any localhost / 127.0.0.1 origin so the React dev server
// on any port (3000, 5173, etc.) can talk to this backend.
const checkCorsOrigin = (origin, callback) => {
  if (
    !origin ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  ) {
    return callback(null, true);
  }
  return callback(new Error(`CORS: origin ${origin} not allowed`));
};

// ── Socket.io ──────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: checkCorsOrigin, credentials: true },
  pingTimeout: 20000,
  pingInterval: 25000,
});

const connectedUsers = new Map();

io.on('connection', (socket) => {
  socket.on('register', (userId) => {
    if (userId) {
      connectedUsers.set(userId.toString(), socket.id);
      // Mark user as online (clear lastOnline while connected)
      const User = require('./models/User');
      User.findByIdAndUpdate(userId, { lastOnline: null }).catch(() => {});
      // Broadcast to all other clients that this user is now online
      socket.broadcast.emit('userOnline', userId.toString());
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        // Record the time this user went offline
        const User = require('./models/User');
        User.findByIdAndUpdate(userId, { lastOnline: new Date() }).catch(() => {});
        // Broadcast to other online users so their chat headers update in real-time
        io.emit('userOffline', { userId, lastOnline: new Date().toISOString() });
        break;
      }
    }
    socket.removeAllListeners();
  });

  socket.on('error', () => socket.disconnect(true));
});

app.set('io', io);
app.set('connectedUsers', connectedUsers);

// ── Middlewares ────────────────────────────────────────────
app.use(compression({ threshold: 1024 }));

// Global request timeout — any request that takes longer than 15s gets a 503
// so the frontend never hangs on "Signing in..." indefinitely
app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent && !res.writableEnded) {
      res.status(503).json({ success: false, message: 'Request timed out. Please try again.' });
    }
  }, 15000);
  // Clear the timer as soon as the response finishes so it never fires late
  res.on('finish', () => clearTimeout(timer));
  res.on('close',  () => clearTimeout(timer));
  next();
});

app.use((req, res, next) => {
  res.on('close', () => { if (!res.writableEnded) res.destroy(); });
  next();
});

app.use(cors({ origin: checkCorsOrigin, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth',             require('./routes/auth'));
app.use('/api/children',         require('./routes/children'));
app.use('/api/classrooms',       require('./routes/classrooms'));
app.use('/api/attendance',       require('./routes/attendance'));
app.use('/api/payments',         require('./routes/payments'));
app.use('/api/reports',          require('./routes/reports'));
app.use('/api/visitors',         require('./routes/visitors'));
app.use('/api/appointments',     require('./routes/appointments'));
app.use('/api/messages',         require('./routes/messages'));
app.use('/api/staff',            require('./routes/staff'));
app.use('/api/meals',            require('./routes/meals'));
app.use('/api/notifications',    require('./routes/notifications'));
app.use('/api/teacher-attendance', require('./routes/teacherAttendance'));
app.use('/api/live-stream',      require('./routes/liveStream'));
app.use('/api/settings',         require('./routes/settings'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── 404 ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global error handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
  });
});

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await seedAll();

    server.listen(PORT, () => {
      console.log(`\n🚀 DaycareHQ Server running on http://localhost:${PORT}`);
      console.log(`📡 API ready at http://localhost:${PORT}/api\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();
