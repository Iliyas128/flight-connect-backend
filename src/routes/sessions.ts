import express, { Request, Response } from 'express';
import { Session, ISession } from '../models/Session';
import { Participant } from '../models/Participant';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';

const router = express.Router();

// Validation schemas
const createSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  registrationStartTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  closingMinutes: z.number().min(0).default(60),
  comments: z.string().default(''),
});

const updateSessionSchema = z.object({
  comments: z.string().optional(),
  status: z.enum(['open', 'closing', 'closed', 'completed']).optional(),
});

// Generate unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

// Generate 3-letter code
const generateSessionCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Check if session code is unique (within 60 days)
const isSessionCodeUnique = async (code: string, excludeId?: string): Promise<boolean> => {
  const now = new Date();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const existingSession = await Session.findOne({
    sessionCode: code.toUpperCase(),
    _id: { $ne: excludeId },
    createdAt: { $gte: sixtyDaysAgo },
  });

  return !existingSession;
};

// Generate unique session code
const generateUniqueSessionCode = async (excludeId?: string): Promise<string> => {
  let code = generateSessionCode();
  let attempts = 0;
  const maxAttempts = 1000;

  while (!(await isSessionCodeUnique(code, excludeId)) && attempts < maxAttempts) {
    code = generateSessionCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    code = generateSessionCode() + Math.floor(Math.random() * 10);
  }

  return code;
};

// Get next session number
const getNextSessionNumber = async (): Promise<number> => {
  const lastSession = await Session.findOne({ sessionNumber: { $exists: true } })
    .sort({ sessionNumber: -1 })
    .limit(1);

  const lastNumber = lastSession?.sessionNumber;
  if (typeof lastNumber !== 'number') {
    return 1;
  }

  return lastNumber + 1;
};

// Calculate session status
const calculateSessionStatus = (session: any): 'open' | 'closing' | 'closed' | 'completed' => {
  const now = new Date();

  // Рассчитываем все времена в UTC, чтобы статусы были консистентны вне зависимости от TZ сервера
  const registrationStartDateTime = new Date(`${session.date}T${session.registrationStartTime}Z`);
  const sessionStartDateTime = new Date(`${session.date}T${session.startTime}Z`);
  const closingTime = new Date(sessionStartDateTime.getTime() - session.closingMinutes * 60 * 1000);

  if (session.endTime) {
    const sessionEndDateTime = new Date(`${session.date}T${session.endTime}Z`);
    if (now >= sessionEndDateTime) {
      return 'completed';
    }
  } else {
    const defaultEndDateTime = new Date(sessionStartDateTime.getTime() + 2 * 60 * 60 * 1000);
    if (now >= defaultEndDateTime) {
      return 'completed';
    }
  }

  if (now >= sessionStartDateTime) {
    return 'closed';
  }

  // Registration not started yet — считаем сессию открытой для планирования
  if (now < registrationStartDateTime) {
    return 'open';
  }

  const minutesUntilClosing = (closingTime.getTime() - now.getTime()) / (1000 * 60);

  if (minutesUntilClosing <= 30 && minutesUntilClosing > 0) {
    return 'closing';
  }

  return 'open';
};

// GET /api/sessions - Get all sessions
router.get('/', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { status } = req.query;
    const query: any = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    // For 'all' status, return all sessions without filtering
    const sessions = await Session.find(query).sort({ createdAt: -1 }); // Sort by creation date, newest first

    // Обновляем статусы на лету, чтобы список был актуален
    for (const session of sessions) {
      const newStatus = calculateSessionStatus(session);
      if (session.status !== newStatus) {
        session.status = newStatus;
        await session.save();
      }
    }

    return res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/upcoming - Get upcoming sessions
router.get('/upcoming', async (_req: Request, res: Response): Promise<Response> => {
  try {
    const sessions = await Session.find({
      status: { $ne: 'completed' },
    }).sort({ date: 1, startTime: 1 });

    // Update statuses
    for (const session of sessions) {
      const newStatus = calculateSessionStatus(session);
      if (session.status !== newStatus) {
        session.status = newStatus;
        await session.save();
      }
    }

    return res.json(sessions);
  } catch (error) {
    console.error('Error fetching upcoming sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch upcoming sessions' });
  }
});

// GET /api/sessions/completed - Get completed sessions (dispatcher/admin only, filtered by creator)
router.get('/completed', authenticate, requireRole(['dispatcher', 'admin']), async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const query: any = { status: 'completed' };
    
    // If dispatcher, only show their own sessions
    if (req.userRole === 'dispatcher' && req.userId) {
      query.createdById = req.userId;
    }
    // Admin sees all completed sessions

    const sessions = await Session.find(query).sort({ date: -1, startTime: -1 });

    return res.json(sessions);
  } catch (error) {
    console.error('Error fetching completed sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch completed sessions' });
  }
});

// GET /api/sessions/:id - Get session by ID
router.get('/:id', async (req: Request, res: Response): Promise<Response> => {
  try {
    const session = await Session.findOne({ id: req.params.id });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// POST /api/sessions - Create new session (dispatcher/admin only)
router.post('/', authenticate, requireRole(['dispatcher', 'admin']), async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const validatedData = createSessionSchema.parse(req.body);
    const sessionCode = await generateUniqueSessionCode();
    const sessionNumber = await getNextSessionNumber();

    const creator = req.userId ? await User.findOne({ id: req.userId }) : null;
    const createdByName = creator?.name || creator?.username || 'Диспетчер';

    const closingMinutes = validatedData.closingMinutes ?? 60;
    const status: ISession['status'] = calculateSessionStatus({
      ...validatedData,
      closingMinutes,
    });

    // Check overlap with other sessions (same day, any dispatcher) — times are in UTC strings HH:mm
    const overlaps = await Session.find({
      date: validatedData.date,
    });
    const newStart = new Date(`${validatedData.date}T${validatedData.startTime}Z`).getTime();
    const newEnd = validatedData.endTime
      ? new Date(`${validatedData.date}T${validatedData.endTime}Z`).getTime()
      : new Date(`${validatedData.date}T${validatedData.startTime}Z`).getTime() + 2 * 60 * 60 * 1000;

    const conflict = overlaps.find((s) => {
      // If updating existing session later, exclude itself; now only create -> no exclude
      const start = new Date(`${s.date}T${s.startTime}Z`).getTime();
      const end = s.endTime
        ? new Date(`${s.date}T${s.endTime}Z`).getTime()
        : new Date(`${s.date}T${s.startTime}Z`).getTime() + 2 * 60 * 60 * 1000;
      return Math.max(start, newStart) < Math.min(end, newEnd);
    });

    if (conflict) {
      return res.status(400).json({
        error: `Пересечение сессии диспетчера ${conflict.createdByName || 'другой диспетчер'} (${conflict.startTime}-${conflict.endTime || '—'})`,
      });
    }

    const session = new Session({
      id: generateId(),
      sessionCode,
      sessionNumber,
      ...validatedData,
      closingMinutes,
      status,
      createdById: req.userId,
      createdByName,
    });
    await session.save();

    return res.status(201).json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating session:', error);
    return res.status(500).json({ error: 'Ошибка при создании сессии.' });
  }
});

// PATCH /api/sessions/:id - Update session (dispatcher/admin only)
router.patch('/:id', authenticate, requireRole(['dispatcher', 'admin']), async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const validatedData = updateSessionSchema.parse(req.body);
    const session = await Session.findOne({ id: req.params.id });

    if (!session) {
      return res.status(404).json({ error: 'Сессия не найдена.' });
    }

    Object.assign(session, validatedData);
    await session.save();

    return res.json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating session:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении сессии.' });
  }
});

// DELETE /api/sessions/:id - Delete session (admin only, from archive)
router.delete('/:id', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const session = await Session.findOne({ id: req.params.id });

    if (!session) {
      return res.status(404).json({ error: 'Сессия не найдена.' });
    }

    // Only allow deletion of completed sessions (from archive)
    if (session.status !== 'completed') {
      return res.status(400).json({ error: 'Из архива можно удалять только завершенные сессии.' });
    }

    // Delete associated participants
    await Participant.deleteMany({ sessionId: session.id });

    // Delete session
    await Session.deleteOne({ id: req.params.id });

    return res.json({ message: 'Сессия удалена успешно.' });
  } catch (error) {
    console.error('Error deleting session:', error);
    return res.status(500).json({ error: 'Ошибка при удалении сессии.' });
  }
});

// GET /api/sessions/:id/participants - Get session participants
router.get('/:id/participants', async (req: Request, res: Response): Promise<Response> => {
  try {
    const session = await Session.findOne({ id: req.params.id });
    if (!session) {
      return res.status(404).json({ error: 'Сессия не найдена.' });
    }

    const participants = await Participant.find({ sessionId: session.id }).sort({
      registeredAt: -1,
    });

    return res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    return res.status(500).json({ error: 'Ошибка при получении участников.' });
  }
});

export default router;

