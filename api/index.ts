import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from '../src/config/database';
import sessionsRouter from '../src/routes/sessions';
import participantsRouter from '../src/routes/participants';
import authRouter from '../src/routes/auth';
import validKeysRouter from '../src/routes/validKeys';

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration - MUST be first middleware
const getAllowedOrigin = (origin: string | undefined): string => {
  // Default allowed origins for local development
  const defaultOrigins = ['http://localhost:8080', 'http://localhost:8081'];
  
  // Production origins (can be overridden by CORS_ORIGIN env var)
  const productionOrigins = [
    'https://flight-connect.vercel.app',
    'https://flight-connect-bot.vercel.app',
  ];
  
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : [...defaultOrigins, ...productionOrigins];
  
  if (allowedOrigins.includes('*')) {
    return origin || '*';
  }
  
  // Check if origin is in allowed list
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }
  
  // For local development, allow localhost origins
  if (origin && origin.startsWith('http://localhost:')) {
    return origin;
  }
  
  // For Vercel deployments, allow vercel.app origins
  if (origin && origin.includes('.vercel.app')) {
    return origin;
  }
  
  return allowedOrigins[0] || '*';
};

const isOriginAllowed = (origin: string | undefined): boolean => {
  // Default allowed origins for local development
  const defaultOrigins = ['http://localhost:8080', 'http://localhost:8081'];
  
  // Production origins (can be overridden by CORS_ORIGIN env var)
  const productionOrigins = [
    'https://flight-connect.vercel.app',
    'https://flight-connect-bot.vercel.app',
  ];
  
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : [...defaultOrigins, ...productionOrigins];
  
  if (allowedOrigins.includes('*')) {
    return true;
  }
  
  if (!origin) {
    return true; // Allow requests without origin (e.g., Postman)
  }
  
  // For local development, allow localhost origins
  if (origin.startsWith('http://localhost:')) {
    return true;
  }
  
  // For Vercel deployments, allow vercel.app origins
  if (origin.includes('.vercel.app')) {
    return true;
  }
  
  return allowedOrigins.includes(origin);
};

// CORS middleware - MUST be first
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

// Explicitly handle OPTIONS for all routes
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigin = getAllowedOrigin(origin);
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
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
app.use('/api/valid-keys', validKeysRouter);

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
export default async function handler(req: express.Request, res: express.Response) {
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
