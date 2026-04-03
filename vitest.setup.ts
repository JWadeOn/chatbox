import { afterAll } from 'vitest';
import { pool } from './server/lib/db';

afterAll(async () => {
  await pool.end();
});
