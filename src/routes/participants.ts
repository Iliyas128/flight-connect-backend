import express, { Request, Response } from 'express';
import { Participant } from '../models/Participant';
import { Session } from '../models/Session';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Validation schemas
const createParticipantSchema = z.object({
  sessionId: z.string(),
  name: z.string().min(1),
  validationCode: z.string().length(3).regex(/^[A-Za-z]{3}$/),
});

const updateParticipantSchema = z.object({
  isValid: z.boolean().nullable().optional(),
});

// Generate unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

// Generate personal code
const generateCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// GET /api/participants - Get all participants
router.get('/', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const query: any = {};

    if (sessionId) {
      query.sessionId = sessionId;
    }

    const participants = await Participant.find(query).sort({ registeredAt: -1 });
    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// GET /api/participants/:id - Get participant by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const participant = await Participant.findOne({ id: req.params.id });
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    res.json(participant);
  } catch (error) {
    console.error('Error fetching participant:', error);
    res.status(500).json({ error: 'Failed to fetch participant' });
  }
});

// POST /api/participants - Create new participant
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = createParticipantSchema.parse(req.body);

    // Check if session exists
    const session = await Session.findOne({ id: validatedData.sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if session is open for registration
    const now = new Date();
    const registrationStartDateTime = new Date(`${session.date}T${session.registrationStartTime}`);
    const sessionStartDateTime = new Date(`${session.date}T${session.startTime}`);
    const closingTime = new Date(sessionStartDateTime.getTime() - session.closingMinutes * 60 * 1000);

    if (now < registrationStartDateTime) {
      return res.status(400).json({ error: 'Registration has not started yet' });
    }

    if (now >= closingTime) {
      return res.status(400).json({ error: 'Registration is closed' });
    }

    // Generate personal code
    const personalCode = generateCode();

    const participantData = {
      id: generateId(),
      sessionId: validatedData.sessionId,
      name: validatedData.name,
      validationCode: validatedData.validationCode.toUpperCase(),
      code: personalCode,
      isValid: null,
      registeredAt: new Date(),
    };

    const participant = new Participant(participantData);
    await participant.save();

    res.status(201).json(participant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating participant:', error);
    res.status(500).json({ error: 'Failed to create participant' });
  }
});

// PATCH /api/participants/:id - Update participant (dispatcher/admin only)
router.patch('/:id', authenticate, requireRole(['dispatcher', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = updateParticipantSchema.parse(req.body);
    const participant = await Participant.findOne({ id: req.params.id });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    if (validatedData.isValid !== undefined) {
      participant.isValid = validatedData.isValid;
    }

    await participant.save();

    res.json(participant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating participant:', error);
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

// DELETE /api/participants/:id - Delete participant
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const participant = await Participant.findOne({ id: req.params.id });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    await Participant.deleteOne({ id: req.params.id });

    res.json({ message: 'Participant deleted successfully' });
  } catch (error) {
    console.error('Error deleting participant:', error);
    res.status(500).json({ error: 'Failed to delete participant' });
  }
});

export default router;

