import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // In production allow all if FRONTEND_URL not set
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/medicare';

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('[DB] Connected to MongoDB'))
  .catch((err) => console.error('[DB] Connection error:', err));

// ─── Routes ───────────────────────────────────────────────────────────────────
import signupRouter       from './routes/signup.js';
import loginRouter        from './routes/login.js';
import adminRouter        from './routes/admin.js';
import doctorRouter       from './routes/doctor.js';
import patientRouter      from './routes/patient.js';
import appointmentsRouter from './routes/appointments.js';
import aiRouter           from './routes/ai.js';
import calendarRouter     from './routes/calendar.js';

app.use('/api/signup',       signupRouter);
app.use('/api/login',        loginRouter);
app.use('/api/admin',        adminRouter);
app.use('/api/doctor',       doctorRouter);
app.use('/api/patient',      patientRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/ai',           aiRouter);
app.use('/api/calendar',     calendarRouter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Medicare AI Healthcare Platform API', version: '2.0' });
});

// ─── Centralized Error Handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'An error occurred.' : err.message,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);

  // Start background jobs after server is up
  import('./jobs/index.js')
    .then(({ startBackgroundJobs }) => startBackgroundJobs())
    .catch((err) => console.error('[Jobs] Failed to start background jobs:', err.message));
});