import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'pilot' | 'dispatcher' | 'admin';

export interface IUser extends Document {
  id: string;
  username: string;
  password: string;
  /** ПАРОЛЬ В ОТКРЫТОМ ВИДЕ (только для диспетчеров, чтобы админ мог выдать пароль). */
  plainPassword?: string;
  role: UserRole;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    plainPassword: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ['pilot', 'dispatcher', 'admin'],
      required: true,
      default: 'pilot',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Indexes


export const User = mongoose.model<IUser>('User', UserSchema);
