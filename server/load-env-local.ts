import { config } from 'dotenv';

// Load `.env.local` when present (local dev). Does not override existing env (e.g. Railway/Render).
config({ path: '.env.local' });
