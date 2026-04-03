import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../../server/lib/db';
import { users } from '../../server/lib/schema';
import { AuthError, AuthService } from '../../server/services/auth.service';

const auth = new AuthService();
const TEST_EMAIL = `auth-test-${Date.now()}@test.com`;
const TEST_EMAIL_2 = `auth-test2-${Date.now()}@test.com`;
let registeredToken: string;

afterAll(async () => {
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
  await db.delete(users).where(eq(users.email, TEST_EMAIL_2));
});

describe('AuthService.register', () => {
  it('registers with valid input and returns user + token', async () => {
    const result = await auth.register({
      email: TEST_EMAIL,
      password: 'password123',
      displayName: 'Test User',
    });

    expect(result.user).toMatchObject({
      email: TEST_EMAIL,
      displayName: 'Test User',
      role: 'student',
    });
    expect(result.user.id).toBeDefined();
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    // password_hash must not be in response
    expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
    expect((result.user as Record<string, unknown>).password_hash).toBeUndefined();

    registeredToken = result.token;
  });

  it('rejects duplicate email', async () => {
    await expect(
      auth.register({
        email: TEST_EMAIL,
        password: 'password123',
        displayName: 'Duplicate',
      })
    ).rejects.toThrow('Email already exists');
  });

  it('rejects short password', async () => {
    await expect(
      auth.register({
        email: TEST_EMAIL_2,
        password: 'short',
        displayName: 'Short Pass',
      })
    ).rejects.toThrow('Password must be at least 8 characters');
  });
});

describe('AuthService.login', () => {
  it('logs in with valid credentials', async () => {
    const result = await auth.login({
      email: TEST_EMAIL,
      password: 'password123',
    });

    expect(result.user.email).toBe(TEST_EMAIL);
    expect(result.token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    await expect(
      auth.login({
        email: TEST_EMAIL,
        password: 'wrongpassword',
      })
    ).rejects.toThrow('Invalid credentials');
  });

  it('rejects non-existent user', async () => {
    await expect(
      auth.login({
        email: 'nonexistent@test.com',
        password: 'password123',
      })
    ).rejects.toThrow('Invalid credentials');
  });
});

describe('AuthService.verifyToken + getUser', () => {
  it('verifies a valid token and returns payload', () => {
    const payload = auth.verifyToken(registeredToken);
    expect(payload.userId).toBeDefined();
    expect(payload.role).toBe('student');
  });

  it('rejects an invalid token', () => {
    expect(() => auth.verifyToken('invalid.token.here')).toThrow('Invalid token');
  });

  it('getUser returns user by id', async () => {
    const { userId } = auth.verifyToken(registeredToken);
    const user = await auth.getUser(userId);
    expect(user.email).toBe(TEST_EMAIL);
    expect(user.displayName).toBe('Test User');
  });

  it('getUser throws for non-existent id', async () => {
    await expect(auth.getUser('00000000-0000-0000-0000-000000000000')).rejects.toThrow('User not found');
  });
});

describe('AuthError', () => {
  it('has correct statusCode', () => {
    const err = new AuthError('test', 400);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('test');
    expect(err.name).toBe('AuthError');
  });
});
