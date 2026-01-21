import mongoose, { Schema, Document } from 'mongoose';

export interface IValidKey extends Document {
  id: string;
  sessionId: string;
  key: string; // Generated key (RSN format)
  pilotName: string; // Pilot's username/name
  createdAt: Date;
  month: string; // Format: YYYY-MM for monthly rotation
}

const ValidKeySchema = new Schema<IValidKey>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    pilotName: {
      type: String,
      required: true,
      trim: true,
    },
    month: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-\d{2}$/, // YYYY-MM format
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Compound index for unique key per month
ValidKeySchema.index({ key: 1, month: 1 }, { unique: true });

// Index for session and month
ValidKeySchema.index({ sessionId: 1, month: 1 });

export const ValidKey = mongoose.model<IValidKey>('ValidKey', ValidKeySchema);
