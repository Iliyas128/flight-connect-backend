import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import sessionsRouter from './routes/sessions';
import participantsRouter from './routes/participants';
import authRouter from './routes/auth';
import validKeysRouter from './routes/validKeys';

// Load environment variables
dotenv.config();

const app = express();
// Middleware
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:8081',
  'https://flight-connect.vercel.app',
  'https://flight-connect-bot.vercel.app',
  'http://www.skyride.pro',
  'https://www.skyride.pro',
  'http://www.g.skyride.pro',
  'https://www.g.skyride.pro',
  'http://skyride.pro',
  'https://skyride.pro',
];


app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost origins for development
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    // Allow Vercel deployments
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn(`Unknown origin attempted access: ${origin}`);
    return callback(null, true); // Изменено с Error на true
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Дополнительная обработка preflight запросов
app.options('*', cors());

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

// Connect to MongoDB on startup (for local development)
if (process.env.VERCEL !== 'true') {
  const startServer = async () => {
    try {
      // Connect to MongoDB
      await connectDB();

      // Start Express server
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`🚀 Server is running on http://localhost:${PORT}`);
        console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  };

  startServer();
}

// Export app for Vercel serverless functions
export default app;

