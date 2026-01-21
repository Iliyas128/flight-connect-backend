import express, { Request, Response } from 'express';
import { ValidKey, IValidKey } from '../models/ValidKey';
import { Session } from '../models/Session';
import { z } from 'zod';

const router = express.Router();

// Generate unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

// Get current month in YYYY-MM format
const getCurrentMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// Get previous month in YYYY-MM format
const getPreviousMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
};

// Generate RSN key (3 uppercase letters)
const generateRSNKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let key = '';
  for (let i = 0; i < 3; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
};

// Check if key is unique in current and previous month
const isKeyUnique = async (key: string): Promise<boolean> => {
  const currentMonth = getCurrentMonth();
  const previousMonth = getPreviousMonth();
  
  const existingKey = await ValidKey.findOne({
    key: key.toUpperCase(),
    month: { $in: [currentMonth, previousMonth] },
  });
  
  return !existingKey;
};

// Generate unique RSN key
const generateUniqueKey = async (): Promise<string> => {
  let key = generateRSNKey();
  let attempts = 0;
  const maxAttempts = 1000;
  
  while (!(await isKeyUnique(key)) && attempts < maxAttempts) {
    key = generateRSNKey();
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    // Fallback: add random digit
    key = generateRSNKey() + Math.floor(Math.random() * 10);
  }
  
  return key.toUpperCase();
};

// Validation schemas
const addValidKeySchema = z.object({
  sessionId: z.string().min(1),
  key: z.string().regex(/^[A-Z]{3}$/),
  pilotName: z.string().min(1).max(100),
});

// GET /api/valid-keys/:sessionId - Get valid keys for a session
router.get('/:sessionId', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { sessionId } = req.params;
    
    // Check if session exists
    const session = await Session.findOne({ id: sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get keys from current and previous month
    const currentMonth = getCurrentMonth();
    const previousMonth = getPreviousMonth();
    
    const validKeys = await ValidKey.find({
      sessionId,
      month: { $in: [currentMonth, previousMonth] },
    }).sort({ createdAt: -1 });
    
    return res.json({
      sessionId,
      keys: validKeys.map(k => ({
        id: k.id,
        key: k.key,
        pilotName: k.pilotName,
        createdAt: k.createdAt,
      })),
      count: validKeys.length,
    });
  } catch (error) {
    console.error('Error fetching valid keys:', error);
    return res.status(500).json({ error: 'Failed to fetch valid keys' });
  }
});

// POST /api/valid-keys - Add a valid key (called from bot)
router.post('/', async (req: Request, res: Response): Promise<Response> => {
  try {
    const validatedData = addValidKeySchema.parse(req.body);
    
    // Check if session exists
    const session = await Session.findOne({ id: validatedData.sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if key is unique
    if (!(await isKeyUnique(validatedData.key))) {
      return res.status(400).json({ error: 'Key already exists' });
    }
    
    // Check if pilot already has a key for this session
    const currentMonth = getCurrentMonth();
    const previousMonth = getPreviousMonth();
    const existingPilotKey = await ValidKey.findOne({
      sessionId: validatedData.sessionId,
      pilotName: validatedData.pilotName,
      month: { $in: [currentMonth, previousMonth] },
    });
    
    if (existingPilotKey) {
      return res.status(400).json({ error: 'Pilot already has a key for this session' });
    }
    
    // Create valid key
    const validKey = new ValidKey({
      id: generateId(),
      sessionId: validatedData.sessionId,
      key: validatedData.key.toUpperCase(),
      pilotName: validatedData.pilotName.trim(),
      month: getCurrentMonth(),
    });
    
    await validKey.save();
    
    return res.status(201).json({
      id: validKey.id,
      key: validKey.key,
      pilotName: validKey.pilotName,
      sessionId: validKey.sessionId,
      createdAt: validKey.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error adding valid key:', error);
    return res.status(500).json({ error: 'Failed to add valid key' });
  }
});

// GET /api/valid-keys/generate - Generate a unique key (for bot)
router.get('/generate/unique', async (req: Request, res: Response): Promise<Response> => {
  try {
    const key = await generateUniqueKey();
    return res.json({ key });
  } catch (error) {
    console.error('Error generating key:', error);
    return res.status(500).json({ error: 'Failed to generate key' });
  }
});

export default router;
