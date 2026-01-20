import express, { Request, Response } from 'express';
import { User } from '../models/User';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  name: z.string().min(1),
});

const createDispatcherSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  name: z.string().min(1),
});

// Generate unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

// Generate JWT token
const generateToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// POST /api/auth/register - Register new pilot
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    // Check if username already exists
    const existingUser = await User.findOne({ username: validatedData.username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const userData = {
      id: generateId(),
      username: validatedData.username.toLowerCase(),
      password: validatedData.password,
      role: 'pilot' as const,
      name: validatedData.name,
    };

    const user = new User(userData);
    await user.save();

    const token = generateToken(user.id, user.role);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /api/auth/login - Login user
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await User.findOne({ username: validatedData.username.toLowerCase() });
    if (!user) {
      console.log(`Login attempt failed: user not found - ${validatedData.username.toLowerCase()}`);
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    // Only allow dispatchers and admins to login
    if (user.role === 'pilot') {
      console.log(`Login attempt failed: pilot role not allowed - ${user.username}`);
      return res.status(403).json({ error: 'Доступ разрешен только диспетчерам и администраторам' });
    }

    const isPasswordValid = await user.comparePassword(validatedData.password);
    if (!isPasswordValid) {
      console.log(`Login attempt failed: invalid password - ${user.username}`);
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const token = generateToken(user.id, user.role);

    console.log(`Successful login: ${user.username} (${user.role})`);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Ошибка при входе в систему' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    const user = await User.findOne({ id: decoded.userId });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/auth/dispatchers - Create dispatcher (admin only)
router.post('/dispatchers', async (req: Request, res: Response) => {
  try {
    // Check admin authorization
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const validatedData = createDispatcherSchema.parse(req.body);

    // Check if username already exists
    const existingUser = await User.findOne({ username: validatedData.username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const userData = {
      id: generateId(),
      username: validatedData.username.toLowerCase(),
      password: validatedData.password,
      plainPassword: validatedData.password,
      role: 'dispatcher' as const,
      name: validatedData.name,
    };

    const user = new User(userData);
    await user.save();

    res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      password: validatedData.password, // Return plain password for admin to share
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating dispatcher:', error);
    res.status(500).json({ error: 'Failed to create dispatcher' });
  }
});

// GET /api/auth/dispatchers - Get all dispatchers (admin only)
router.get('/dispatchers', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Admin can see dispatcher passwords (plainPassword) to provide access
    const dispatchers = await User.find({ role: 'dispatcher' }).select('-password');
    res.json(
      dispatchers.map((d) => ({
        id: d.id,
        username: d.username,
        role: d.role,
        name: d.name,
        plainPassword: (d as any).plainPassword || null,
      }))
    );
  } catch (error) {
    console.error('Error fetching dispatchers:', error);
    res.status(500).json({ error: 'Failed to fetch dispatchers' });
  }
});

export default router;
