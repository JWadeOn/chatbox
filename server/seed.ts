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
  description:
    'Chess with three modes: tutoring (AI coaching), vs Computer (Stockfish on Lichess), vs Human (multiplayer)',
  authType: 'none',
  iframeUrl: '/apps/chess',
  toolSchemas: [
    {
      name: 'start_game',
      description:
        'Start a chess game. Modes: tutoring (local board with AI coaching), vs_computer (Stockfish on Lichess), vs_human (multiplayer challenge link).',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['tutoring', 'vs_computer', 'vs_human'],
            description: 'Game mode (default: tutoring)',
          },
          color: { type: 'string', enum: ['white', 'black'], description: 'Color for the student (default: white)' },
          level: { type: 'number', description: 'Stockfish difficulty 1-8, only for vs_computer (default: 3)' },
        },
      },
    },
    {
      name: 'make_move',
      description:
        'Make a chess move in standard algebraic notation (e.g. e4, Nf3, O-O) or UCI (e.g. e2e4). Only for tutoring mode.',
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
      description: 'Get the current board state. For Lichess games, fetches the live game status.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'resign',
      description: 'Resign or abandon the current game.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'get_game_link',
      description: 'Get the Lichess game URL for an active vs_computer or vs_human game. Share this with the student.',
      parameters: { type: 'object', properties: {} },
    },
  ],
};

const KHAN_APP = {
  slug: 'khan',
  name: 'Khan Academy Companion',
  description:
    'Topic exploration companion for any subject — opens lessons, explains concepts, and generates quiz questions',
  authType: 'none',
  iframeUrl: '/apps/khan',
  toolSchemas: [
    {
      name: 'open_topic',
      description: 'Open a topic or lesson for the student to explore and learn about.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic or lesson to open (e.g. "Photosynthesis", "Fractions")' },
        },
        required: ['topic'],
      },
    },
    {
      name: 'explain_concept',
      description: 'Explain a concept in clear, student-friendly terms within the current topic.',
      parameters: {
        type: 'object',
        properties: {
          concept: { type: 'string', description: 'The specific concept to explain' },
        },
        required: ['concept'],
      },
    },
    {
      name: 'quiz',
      description: 'Generate a quiz question on the current topic to test student understanding.',
      parameters: { type: 'object', properties: {} },
    },
  ],
};

const FLASHCARDS_APP = {
  slug: 'flashcards',
  name: 'Flashcards',
  description: 'Create and study flashcard decks for active recall practice with progress tracking',
  authType: 'none',
  iframeUrl: '/apps/flashcards',
  toolSchemas: [
    {
      name: 'load_deck',
      description: 'Load a flashcard deck by ID for the current user to study.',
      parameters: {
        type: 'object',
        properties: {
          deckId: { type: 'string', description: 'The deck UUID to load' },
        },
        required: ['deckId'],
      },
    },
    {
      name: 'create_deck',
      description: 'Create a new flashcard deck with a title and array of cards.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title for the deck' },
          cards: {
            type: 'array',
            description: 'Array of card objects with front and back text',
            items: {
              type: 'object',
              properties: {
                front: { type: 'string', description: 'Front of card (question/term)' },
                back: { type: 'string', description: 'Back of card (answer/definition)' },
              },
              required: ['front', 'back'],
            },
          },
        },
        required: ['title', 'cards'],
      },
    },
    {
      name: 'answer_card',
      description: 'Submit an answer for the current flashcard and check correctness.',
      parameters: {
        type: 'object',
        properties: {
          deckId: { type: 'string', description: 'The deck UUID' },
          cardIndex: { type: 'number', description: 'Index of the card being answered' },
          answer: { type: 'string', description: 'The student answer' },
        },
        required: ['deckId', 'cardIndex', 'answer'],
      },
    },
    {
      name: 'get_progress',
      description: 'Get study progress history for a flashcard deck.',
      parameters: {
        type: 'object',
        properties: {
          deckId: { type: 'string', description: 'The deck UUID' },
        },
        required: ['deckId'],
      },
    },
  ],
};

const FIRST_PRINCIPLES_APP = {
  slug: 'firstprinciples',
  name: 'First Principles Tutor',
  description: 'Breaks down questions into assumptions, first principles, and step-by-step reasoning',
  authType: 'none',
  iframeUrl: '/apps/firstprinciples',
  toolSchemas: [
    {
      name: 'analyze',
      description: 'Take a question or problem and break it into first principles, assumptions, and reasoning steps.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question or problem to analyze' },
        },
        required: ['question'],
      },
    },
  ],
};

const ALL_APPS = [CHESS_APP, KHAN_APP, FLASHCARDS_APP, FIRST_PRINCIPLES_APP];

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

  // Deactivate old apps that are no longer in the spec
  for (const slug of ['weather', 'spotify']) {
    const [old] = await db.select().from(apps).where(eq(apps.slug, slug)).limit(1);
    if (old && old.status === 'active') {
      await db.update(apps).set({ status: 'inactive' }).where(eq(apps.id, old.id));
      console.info(`Deactivated old app: ${slug}`);
    }
  }

  // Seed apps
  for (const app of ALL_APPS) {
    console.info(`Seeding ${app.slug} app...`);
    const [existing] = await db.select().from(apps).where(eq(apps.slug, app.slug)).limit(1);
    if (existing) {
      await db
        .update(apps)
        .set({ toolSchemas: app.toolSchemas, description: app.description, updatedAt: new Date() })
        .where(eq(apps.id, existing.id));
      console.info(`${app.slug} app updated with latest schemas.`);
    } else {
      await db.insert(apps).values(app);
      console.info(`${app.slug} app registered.`);
    }
  }

  await pool.end();
  console.info('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
