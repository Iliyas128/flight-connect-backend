import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from '../src/config/database';
import sessionsRouter from '../src/routes/sessions';
import participantsRouter from '../src/routes/participants';
import authRouter from '../src/routes/auth';

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration helper
const getAllowedOrigin = (origin: string | undefined): string => {
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['*'];
  
  if (allowedOrigins.includes('*')) {
    return origin || '*';
  }
  
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }
  
  // Return first allowed origin if origin doesn't match (fallback)
  return allowedOrigins[0] || '*';
};

const isOriginAllowed = (origin: string | undefined): boolean => {
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['*'];
  
  return allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin);
};

// CORS middleware - simplified for serverless
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = getAllowedOrigin(origin);
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  next();
});
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
  // Handle OPTIONS (preflight) requests immediately - BEFORE connecting to MongoDB
  // This is critical for CORS to work in serverless environments
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    
    if (isOriginAllowed(origin)) {
      const allowedOrigin = getAllowedOrigin(origin);
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');
      return res.status(204).end();
    } else {
      return res.status(403).json({ error: 'CORS not allowed' });
    }
  }

  // Connect to MongoDB if not already connected
  await connectIfNeeded();
  
  // Handle the request with Express app
  return app(req as any, res as any);
}
