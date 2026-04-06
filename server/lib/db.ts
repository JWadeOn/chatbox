import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/** Render and some hosts require TLS; local Postgres typically does not. */
function sslOption(connectionString: string | undefined): { rejectUnauthorized: boolean } | undefined {
  if (!connectionString) return undefined;
  const lower = connectionString.toLowerCase();
  if (lower.includes('sslmode=disable') || process.env.DATABASE_SSL === 'false') return undefined;
  if (
    process.env.DATABASE_SSL === 'true' ||
    lower.includes('.render.com') ||
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify-full')
  ) {
    return { rejectUnauthorized: true };
  }
  try {
    const host = new URL(connectionString.replace(/^postgresql:/i, 'http:')).hostname;
    // Render internal hostname (no public suffix in URL)
    if (host.startsWith('dpg-')) {
      return { rejectUnauthorized: true };
    }
  } catch {
    // ignore parse errors
  }
  return undefined;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslOption(process.env.DATABASE_URL),
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });
export { pool };
