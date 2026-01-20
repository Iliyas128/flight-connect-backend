import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from '../src/config/database';
import sessionsRouter from '../src/routes/sessions';
import participantsRouter from '../src/routes/participants';
import authRouter from '../src/routes/auth';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Flight Connect API is running' });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/participants', participantsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect to MongoDB (cached connection)
let isConnected = false;

const connectIfNeeded = async () => {
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }
};

// Export serverless function handler for Vercel
export default async function handler(req: any, res: any) {
  // Connect to MongoDB if not already connected
  await connectIfNeeded();
  
  // Handle the request with Express app
  return app(req as any, res as any);
}
