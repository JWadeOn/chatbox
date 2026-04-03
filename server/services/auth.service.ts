import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db';
import { users } from '../lib/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const SALT_ROUNDS = 10;

export type UserResponse = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

export class AuthService {
  async register(params: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ user: UserResponse; token: string }> {
    const existing = await db.select().from(users).where(eq(users.email, params.email)).limit(1);
    if (existing.length > 0) {
      throw new AuthError('Email already exists', 400);
    }

    if (params.password.length < 8) {
      throw new AuthError('Password must be at least 8 characters', 400);
    }

    const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
    const [user] = await db
      .insert(users)
      .values({
        email: params.email,
        passwordHash,
        displayName: params.displayName,
      })
      .returning();

    const token = this.generateToken(user.id, user.role);
    return { user: this.toUserResponse(user), token };
  }

  async login(params: { email: string; password: string }): Promise<{ user: UserResponse; token: string }> {
    const [user] = await db.select().from(users).where(eq(users.email, params.email)).limit(1);
    if (!user) {
      throw new AuthError('Invalid credentials', 401);
    }

    const valid = await bcrypt.compare(params.password, user.passwordHash);
    if (!valid) {
      throw new AuthError('Invalid credentials', 401);
    }

    const token = this.generateToken(user.id, user.role);
    return { user: this.toUserResponse(user), token };
  }

  async getUser(userId: string): Promise<UserResponse> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new AuthError('User not found', 404);
    }
    return this.toUserResponse(user);
  }

  verifyToken(token: string): { userId: string; role: string } {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
      return payload;
    } catch {
      throw new AuthError('Invalid token', 401);
    }
  }

  private generateToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
  }

  private toUserResponse(user: typeof users.$inferSelect): UserResponse {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export const authService = new AuthService();
