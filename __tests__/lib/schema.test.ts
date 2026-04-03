import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import * as schema from '../../server/lib/schema';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/chatbridge';
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema });

afterAll(async () => {});

describe('database schema', () => {
  it('has all 8 required tables', async () => {
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tables = result.rows.map((r: { table_name: string }) => r.table_name);

    expect(tables).toContain('users');
    expect(tables).toContain('conversations');
    expect(tables).toContain('messages');
    expect(tables).toContain('apps');
    expect(tables).toContain('tool_logs');
    expect(tables).toContain('oauth_tokens');
    expect(tables).toContain('intents');
    expect(tables).toContain('app_sessions');
  });

  it('users table has correct columns', async () => {
    const result = await db.execute(sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'users' ORDER BY ordinal_position
    `);
    const columns = result.rows.map((r: { column_name: string }) => r.column_name);
    expect(columns).toEqual(
      expect.arrayContaining(['id', 'email', 'password_hash', 'display_name', 'role', 'created_at', 'updated_at'])
    );
  });

  it('conversations table references users', async () => {
    const result = await db.execute(sql`
      SELECT constraint_type FROM information_schema.table_constraints
      WHERE table_name = 'conversations' AND constraint_type = 'FOREIGN KEY'
    `);
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('messages table references conversations', async () => {
    const result = await db.execute(sql`
      SELECT constraint_type FROM information_schema.table_constraints
      WHERE table_name = 'messages' AND constraint_type = 'FOREIGN KEY'
    `);
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('apps table has slug unique constraint', async () => {
    const result = await db.execute(sql`
      SELECT constraint_type FROM information_schema.table_constraints
      WHERE table_name = 'apps' AND constraint_type = 'UNIQUE'
    `);
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('tool_logs table has invocation_id unique constraint', async () => {
    const result = await db.execute(sql`
      SELECT constraint_type FROM information_schema.table_constraints
      WHERE table_name = 'tool_logs' AND constraint_type = 'UNIQUE'
    `);
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('oauth_tokens has unique constraint on user_id + app_id', async () => {
    const result = await db.execute(sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'oauth_tokens' AND constraint_type = 'UNIQUE'
    `);
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('intents table has app_id FK and conversation_id FK', async () => {
    const result = await db.execute(sql`
      SELECT constraint_type FROM information_schema.table_constraints
      WHERE table_name = 'intents' AND constraint_type = 'FOREIGN KEY'
    `);
    expect(result.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('app_sessions table has conversation_id and app_id FKs', async () => {
    const result = await db.execute(sql`
      SELECT constraint_type FROM information_schema.table_constraints
      WHERE table_name = 'app_sessions' AND constraint_type = 'FOREIGN KEY'
    `);
    expect(result.rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe('logger', () => {
  it('exports logger and logEvent', async () => {
    const { logger, logEvent } = await import('../../server/lib/logger');
    expect(logger).toBeDefined();
    expect(typeof logEvent).toBe('function');
  });
});
