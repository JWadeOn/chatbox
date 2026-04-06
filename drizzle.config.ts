import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { ensurePgSslQueryString } from './server/lib/pg-ssl-url';

loadEnv({ path: '.env.local' });

const rawUrl = process.env.DATABASE_URL ?? '';
const railwayProxy = rawUrl.toLowerCase().includes('.rlwy.net');
// Railway: pass explicit `ssl` and keep URL without `sslmode` to avoid conflicting TLS options with drizzle-kit.
const pushUrl = railwayProxy ? rawUrl : ensurePgSslQueryString(rawUrl);

export default defineConfig({
  schema: './server/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: railwayProxy ? { url: pushUrl, ssl: { rejectUnauthorized: false } } : { url: pushUrl },
});
