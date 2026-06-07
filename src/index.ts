import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { sequelize } from './models';
import authRoutes from './routes/authRoutes';
import institutionRoutes from './routes/institutionRoutes';
import incidentRoutes from './routes/incidentRoutes';
import userRoutes from './routes/userRoutes';
import alertRoutes from './routes/alertRoutes';
import buddyRoutes from './routes/buddyRoutes';
import contactRoutes from './routes/contactRoutes';
import superAdminRoutes from './routes/superAdminRoutes';
import uploadRoutes from './routes/uploadRoutes';
import { initSocket } from './lib/socket';
import path from 'path';
import { seedDatabase } from './seed';
import { startAutoAssignWorker } from './services/autoAssignService';
import { startReportGeneratorWorker } from './services/reportService';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
initSocket(httpServer);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// Basic Request Logger with Origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${origin}`);
  next();
});

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'https://safecampus.onrender.com',
  'https://safecampus-eight.vercel.app', // Adding likely Vercel URL
  /\.vercel\.app$/ // Allow any vercel.app subdomains
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS]: Origin ${origin} blocked`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/buddies', buddyRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/admin', superAdminRoutes);
app.use('/api/upload', uploadRoutes);

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Enhanced Health & Connectivity Route
app.get('/', async (req, res) => {
  let dbStatus = 'connected';
  try {
    await sequelize.authenticate();
  } catch (err) {
    dbStatus = 'disconnected';
  }

  res.json({
    message: 'SafeCampus API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    checks: {
      database: dbStatus,
      env: process.env.NODE_ENV || 'development'
    }
  });
});

// Sync Database, Auto-Seed, and Start Server
sequelize.sync().then(async () => {
  console.log('[db]: Database synced');

  // Safely patch the ENUM in Postgres to accept 'STAFF' without breaking changes
  if (sequelize.getDialect() === 'postgres') {
    try {
      await sequelize.query(`ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'STAFF';`);
      console.log('[db]: Postgres ENUM enum_Users_role patched with STAFF');
    } catch (e: any) {
      // Ignored
    }

    try {
      await sequelize.query(`ALTER TABLE incidents ADD COLUMN remarks TEXT;`);
      console.log('[db]: Postgres table incidents patched with remarks column');
    } catch (e: any) {
      console.log('[db]: Postgres remarks column patch skipped or failed:', e.message);
    }

    try {
      await sequelize.query(`ALTER TABLE buddies ADD COLUMN user_is_sharing BOOLEAN DEFAULT FALSE;`);
      console.log('[db]: Postgres table buddies patched with user_is_sharing column');
    } catch (e: any) { }

    try {
      await sequelize.query(`ALTER TABLE buddies ADD COLUMN buddy_is_sharing BOOLEAN DEFAULT FALSE;`);
      console.log('[db]: Postgres table buddies patched with buddy_is_sharing column');
    } catch (e: any) { }

    try {
      await sequelize.query(`ALTER TABLE users ADD COLUMN last_lat FLOAT;`);
      console.log('[db]: Postgres table users patched with last_lat column');
    } catch (e: any) { }

    try {
      await sequelize.query(`ALTER TABLE users ADD COLUMN last_lng FLOAT;`);
      console.log('[db]: Postgres table users patched with last_lng column');
    } catch (e: any) { }
  }

  // Auto-seed if needed
  await seedDatabase();

  httpServer.listen(PORT, () => {
    console.log(`[server]: Server is running at http://localhost:${PORT}`);
    startAutoAssignWorker();
    startReportGeneratorWorker();
    console.log('[server]: Auto-assign & Report workers started');
  });
}).catch(err => {
  console.error('[db]: Failed to sync database', err);
});

