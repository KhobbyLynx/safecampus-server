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
import { initSocket } from './lib/socket';
import { seedDatabase } from './seed';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
initSocket(httpServer);

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'https://safecampus.onrender.com'],
  credentials: true
}));

// Basic Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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
  
  // Auto-seed if needed
  await seedDatabase();

  httpServer.listen(PORT, () => {
    console.log(`[server]: Server is running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('[db]: Failed to sync database', err);
});

