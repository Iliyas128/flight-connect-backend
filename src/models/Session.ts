import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  id: string;
  sessionCode: string;
  date: string; // ISO date string (YYYY-MM-DD)
  registrationStartTime: string; // HH:mm format
  startTime: string; // HH:mm format
  endTime?: string; // HH:mm format (optional)
  status: 'open' | 'closing' | 'closed' | 'completed';
  closingMinutes: number;
  comments: string;
  createdById?: string;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    date: {
      type: String,
      required: true,
    },
    registrationStartTime: {
      type: String,
      required: true,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, // HH:mm format
    },
    startTime: {
      type: String,
      required: true,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, // HH:mm format
    },
    endTime: {
      type: String,
      required: false,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, // HH:mm format
    },
    status: {
      type: String,
      enum: ['open', 'closing', 'closed', 'completed'],
      required: true,
      default: 'open',
    },
    closingMinutes: {
      type: Number,
      required: true,
      default: 60,
      min: 0,
    },
    comments: {
      type: String,
      default: '',
    },
    createdById: {
      type: String,
      required: false,
      index: true,
    },
    createdByName: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Indexes
SessionSchema.index({ date: 1, startTime: 1 });
SessionSchema.index({ status: 1 });
SessionSchema.index({ createdAt: -1 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);

