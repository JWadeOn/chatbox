import '../load-env-local';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { poolSslFromUrl } from './pg-ssl-url';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: poolSslFromUrl(process.env.DATABASE_URL),
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });
export { pool };
