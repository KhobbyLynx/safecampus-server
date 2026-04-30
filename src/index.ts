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

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
initSocket(httpServer);

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
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

// Base Route
app.get('/', (req, res) => {
  res.json({
    message: 'SafeCampus API is running',
    version: '1.0.0',
    status: 'healthy'
  });
});

// Sync Database and Start Server
sequelize.sync().then(() => {
  console.log('[db]: Database synced');
  httpServer.listen(PORT, () => {
    console.log(`[server]: Server is running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('[db]: Failed to sync database', err);
});
