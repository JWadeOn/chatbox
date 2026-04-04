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
  description: 'Chess tutor for building strategic thinking, pattern recognition, and planning skills',
  authType: 'none',
  iframeUrl: '/apps/chess',
  toolSchemas: [
    {
      name: 'start_game',
      description: 'Start a chess lesson. The student plays against the board while the tutor coaches them through moves.',
      parameters: {
        type: 'object',
        properties: {
          color: { type: 'string', enum: ['white', 'black'], description: 'Color for the student (default: white)' },
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
      description: 'Analyze the current position to help the student understand patterns, threats, and strategy.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'resign',
      description: 'Resign the current game. Use this as a teaching moment about when to concede gracefully.',
      parameters: { type: 'object', properties: {} },
    },
  ],
};

const WEATHER_APP = {
  slug: 'weather',
  name: 'Weather Explorer',
  description: 'Geography and earth science tool for exploring climate, weather patterns, and global locations',
  authType: 'none',
  iframeUrl: '/apps/weather',
  toolSchemas: [
    {
      name: 'get_weather',
      description: 'Look up weather for a location to explore geography, climate zones, and seasonal patterns.',
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

const SPOTIFY_APP = {
  slug: 'spotify',
  name: 'Study Playlist',
  description: 'Create focus and study playlists to support concentration and learning. Teaches digital literacy through OAuth.',
  authType: 'oauth2',
  iframeUrl: '/apps/spotify',
  oauthConfig: {
    authorizationUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    scopes: ['playlist-modify-public', 'playlist-modify-private'],
  },
  toolSchemas: [
    {
      name: 'get_auth_status',
      description: 'Check Spotify connection status. The auth flow teaches digital literacy and account permissions.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'create_playlist',
      description: 'Create a study playlist matching a mood to support focused learning and self-regulation skills.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name for the playlist' },
          mood: {
            type: 'string',
            enum: ['relaxed', 'energetic', 'focused'],
            description: 'Mood of the playlist (relaxed, energetic, or focused)',
          },
          track_count: { type: 'number', description: 'Number of tracks (default: 10)' },
        },
        required: ['name', 'mood'],
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

  // Seed spotify app
  console.info('Seeding spotify app...');
  const existingSpotify = await db.select().from(apps).where(eq(apps.slug, 'spotify')).limit(1);
  if (existingSpotify.length > 0) {
    console.info('Spotify app already exists, skipping.');
  } else {
    await db.insert(apps).values(SPOTIFY_APP);
    console.info('Spotify app registered.');
  }

  await pool.end();
  console.info('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
