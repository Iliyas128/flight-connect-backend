import mongoose, { Schema, Document } from 'mongoose';

export interface IParticipant extends Document {
  id: string;
  sessionId: string;
  name: string;
  validationCode: string; // 3-letter validation code (case-insensitive)
  code: string; // Personal code for participant
  isValid: boolean | null; // null = not checked, true = valid, false = invalid
  registeredAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    sessionId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    validationCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    code: {
      type: String,
      required: true,
      trim: true,
    },
    isValid: {
      type: Schema.Types.Mixed, // Allows boolean | null
      default: null,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // We use registeredAt instead
  }
);

// Indexes
ParticipantSchema.index({ sessionId: 1 });
ParticipantSchema.index({ sessionId: 1, validationCode: 1 });
ParticipantSchema.index({ registeredAt: -1 });

export const Participant = mongoose.model<IParticipant>('Participant', ParticipantSchema);

