const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const http = require('http');
const { Server } = require('socket.io');
const compression = require('compression');
const { getRequestTimeoutMs } = require('./utils/requestTimeout');
const {
  getChapaConfigurationError,
  getChapaEnvironment,
  isChapaConfigured
} = require('./utils/chapaConfig');
const { getChapaCallbackUrl, getChapaReturnUrl } = require('./utils/chapaCallbackUrl');

const backendEnvPath = path.join(__dirname, '.env');
const chapaSecretBeforeDotenv = process.env.CHAPA_SECRET_KEY;
const chapaCallbackBeforeDotenv = process.env.CHAPA_CALLBACK_URL;
const backendEnv = dotenv.config({ path: backendEnvPath });
const chapaSecretFromFile = backendEnv.parsed?.CHAPA_SECRET_KEY;
const chapaCallbackFromFile = backendEnv.parsed?.CHAPA_CALLBACK_URL;
if (
  chapaSecretBeforeDotenv &&
  chapaSecretFromFile &&
  chapaSecretBeforeDotenv.trim() !== chapaSecretFromFile.trim()
) {
  console.warn(
    '[config] CHAPA_SECRET_KEY is already set in the process environment and takes precedence over backend/.env. Restart or correct the service environment; key values are not logged.'
  );
}
if (
  chapaCallbackBeforeDotenv !== undefined &&
  chapaCallbackFromFile !== undefined &&
  chapaCallbackBeforeDotenv.trim() !== chapaCallbackFromFile.trim()
) {
  console.warn(
    '[config] CHAPA_CALLBACK_URL is already set in the process environment and takes precedence over backend/.env. Correct the service environment or restart; callback values are not logged.'
  );
}
try {
  const callbackUrl = getChapaCallbackUrl();
  console.info(
    `[config] Chapa callback URL ${callbackUrl ? 'is configured and passed local validation' : 'is not configured'}; webhook reachability is not verified by this check.`
  );
} catch (error) {
  console.error(`[config] Chapa callback configuration is invalid: ${error.message}`);
}
try {
  getChapaReturnUrl();
  console.info('[config] Chapa browser return URL passed public HTTPS validation.');
} catch (error) {
  console.error(`[config] Chapa browser return URL is invalid: ${error.message}`);
}
const chapaEnvironment = getChapaEnvironment();
if (isChapaConfigured()) {
  console.info(
    `[config] Chapa ${chapaEnvironment} key is present and locally format-checked; provider authorization is not confirmed until a Chapa request.`
  );
} else {
  console.warn(
    `[config] Chapa is not ready: ${getChapaConfigurationError()} Key values are not logged.`
  );
}

const app = express();
const server = http.createServer(app);

// ── CORS ───────────────────────────────────────────────────
// Allow any localhost / 127.0.0.1 origin so the React dev server
// on any port (3000, 5173, etc.) can talk to this backend.
const checkCorsOrigin = (origin, callback) => {
  let configuredFrontendOrigin = null;
  try {
    configuredFrontendOrigin = process.env.FRONTEND_URL
      ? new URL(process.env.FRONTEND_URL).origin
      : null;
  } catch {
    configuredFrontendOrigin = null;
  }

  if (
    !origin ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin === configuredFrontendOrigin
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

// Keep ordinary API requests bounded while allowing Chapa's 30-second
// gateway requests to finish and return a definitive result.
app.use((req, res, next) => {
  const timeoutMs = getRequestTimeoutMs(req.originalUrl);
  const timer = setTimeout(() => {
    if (!res.headersSent && !res.writableEnded) {
      res.status(503).json({ success: false, message: 'Request timed out. Please try again.' });
    }
  }, timeoutMs);
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
app.use(express.json({
  limit: '5mb',
  verify: (req, res, body) => {
    if (req.originalUrl.split('?')[0] === '/api/payments/chapa-webhook') {
      req.rawBody = Buffer.from(body);
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth',             require('./routes/auth'));
app.use('/api/children',         require('./routes/children'));
app.use('/api/vaccinations',     require('./routes/vaccinations'));
app.use('/api/classrooms',       require('./routes/classrooms'));
app.use('/api/attendance',       require('./routes/attendance'));
app.use('/api/payments',         require('./routes/payments'));
app.use('/api/subscriptions',    require('./routes/subscriptions'));
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
const { processExpiredTrials } = require('./controllers/subscriptionController');

const runTrialBilling = async () => {
  try {
    const result = await processExpiredTrials();
    if (result.failed > 0) {
      console.error(`Trial billing could not process ${result.failed} expired trial(s).`);
    }
  } catch (error) {
    console.error('Trial billing job failed:', error.message);
  }
};

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`\n🚀 DaycareHQ Server running on http://localhost:${PORT}`);
      console.log(`📡 API ready at http://localhost:${PORT}/api\n`);
      runTrialBilling();
      const trialBillingTimer = setInterval(runTrialBilling, 60 * 1000);
      trialBillingTimer.unref();
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();
