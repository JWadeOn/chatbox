import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from './lib/db';
import { apps, users } from './lib/schema';

const DEMO_USER = {
  email: 'demo@chatbridge.com',
  password: 'demo1234',
  displayName: 'Demo User',
  role: 'student',
};

const CHESS_APP = {
  slug: 'chess',
  name: 'Chess',
  description: 'Interactive chess game with AI opponent',
  authType: 'none',
  iframeUrl: '/apps/chess',
  toolSchemas: [
    {
      name: 'start_game',
      description: 'Start a new chess game. Optionally specify which color the player wants.',
      parameters: {
        type: 'object',
        properties: {
          color: { type: 'string', enum: ['white', 'black'], description: 'Color for the player (default: white)' },
        },
      },
    },
    {
      name: 'make_move',
      description: 'Make a chess move in standard algebraic notation (e.g. e4, Nf3, O-O) or UCI (e.g. e2e4).',
      parameters: {
        type: 'object',
        properties: {
          move: { type: 'string', description: 'The move in SAN or UCI notation' },
        },
        required: ['move'],
      },
    },
    {
      name: 'get_board_state',
      description: 'Get the current board state including FEN, move history, and material balance.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'resign',
      description: 'Resign the current game.',
      parameters: { type: 'object', properties: {} },
    },
  ],
};

const WEATHER_APP = {
  slug: 'weather',
  name: 'Weather',
  description: 'Get current weather information for any location',
  authType: 'none',
  iframeUrl: '/apps/weather',
  toolSchemas: [
    {
      name: 'get_weather',
      description: 'Get the current weather for a given location.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name or location (e.g. "San Francisco, CA")' },
        },
        required: ['location'],
      },
    },
  ],
};

async function seed() {
  // Seed demo user
  console.info('Seeding demo user...');
  const existingUser = await db.select().from(users).where(eq(users.email, DEMO_USER.email)).limit(1);
  if (existingUser.length > 0) {
    console.info('Demo user already exists, skipping.');
  } else {
    const passwordHash = await bcrypt.hash(DEMO_USER.password, 10);
    await db.insert(users).values({
      email: DEMO_USER.email,
      passwordHash,
      displayName: DEMO_USER.displayName,
      role: DEMO_USER.role,
    });
    console.info('Demo user created: demo@chatbridge.com / demo1234');
  }

  // Seed chess app
  console.info('Seeding chess app...');
  const existingChess = await db.select().from(apps).where(eq(apps.slug, 'chess')).limit(1);
  if (existingChess.length > 0) {
    console.info('Chess app already exists, skipping.');
  } else {
    await db.insert(apps).values(CHESS_APP);
    console.info('Chess app registered.');
  }

  // Seed weather app
  console.info('Seeding weather app...');
  const existingWeather = await db.select().from(apps).where(eq(apps.slug, 'weather')).limit(1);
  if (existingWeather.length > 0) {
    console.info('Weather app already exists, skipping.');
  } else {
    await db.insert(apps).values(WEATHER_APP);
    console.info('Weather app registered.');
  }

  await pool.end();
  console.info('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
