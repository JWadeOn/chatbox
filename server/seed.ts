import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { APP_APPROVAL_APPROVED, APP_APPROVAL_PENDING } from './lib/app-approval';
import { db, pool } from './lib/db';
import { apps, users } from './lib/schema';

const DEMO_STUDENT = {
  email: 'demo@chatbridge.com',
  password: 'demo1234',
  displayName: 'Demo Student',
  role: 'student',
};

const DEMO_TEACHER = {
  email: 'teacher@chatbridge.com',
  password: 'teacher1234',
  displayName: 'Demo Teacher',
  role: 'teacher',
};

const DEMO_ADMIN = {
  email: 'admin@chatbridge.com',
  password: 'admin1234',
  displayName: 'Demo Admin',
  role: 'admin',
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
        'Start a chess game. Modes: tutoring (local board with AI coaching), local_computer (local board with automatic opponent), vs_computer (Stockfish on Lichess), vs_human (multiplayer challenge link).',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['tutoring', 'local_computer', 'vs_computer', 'vs_human'],
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

const STUDY_PLANNER_APP = {
  slug: 'studyplanner',
  name: 'Study Planner (Google Calendar)',
  description: 'Plan and track study sessions in Google Calendar with OAuth-based per-user access',
  authType: 'oauth',
  iframeUrl: '/apps/studyplanner',
  toolSchemas: [
    {
      name: 'open_planner',
      description: 'Open the study planner and check whether Google Calendar is connected for this user.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'create_study_session',
      description: 'Create a study session event in Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Study session title, e.g. "Biology review"' },
          startIso: {
            type: 'string',
            description: 'Start datetime in ISO-8601 format, e.g. 2026-04-08T19:00:00-04:00',
          },
          durationMinutes: { type: 'number', description: 'Session duration in minutes (10-240)' },
          notes: { type: 'string', description: 'Optional notes or goals for the session' },
        },
        required: ['title', 'startIso'],
      },
    },
    {
      name: 'list_upcoming_sessions',
      description: 'List upcoming study sessions from Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'How many upcoming sessions to return (default 10, max 20)' },
        },
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

const ALL_APPS = [CHESS_APP, KHAN_APP, STUDY_PLANNER_APP, FIRST_PRINCIPLES_APP];

async function upsertSeedUser(
  user: { email: string; password: string; displayName: string; role: string },
  label: string
) {
  const [existing] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
  if (existing) {
    console.info(`${label} already exists, skipping.`);
    return;
  }
  const passwordHash = await bcrypt.hash(user.password, 10);
  await db.insert(users).values({
    email: user.email,
    passwordHash,
    displayName: user.displayName,
    role: user.role,
  });
  console.info(`${label} created: ${user.email} / ${user.password}`);
}

async function seed() {
  console.info('Seeding demo student...');
  await upsertSeedUser(DEMO_STUDENT, 'Demo student');

  console.info('Seeding demo teacher...');
  await upsertSeedUser(DEMO_TEACHER, 'Demo teacher');

  console.info('Seeding demo admin...');
  await upsertSeedUser(DEMO_ADMIN, 'Demo admin');

  // Deactivate old apps that are no longer in the spec
  for (const slug of ['weather', 'spotify', 'flashcards']) {
    const [old] = await db.select().from(apps).where(eq(apps.slug, slug)).limit(1);
    if (old && old.status === 'active') {
      await db
        .update(apps)
        .set({ status: 'inactive', approvalStatus: 'disabled', updatedAt: new Date() })
        .where(eq(apps.id, old.id));
      console.info(`Deactivated old app: ${slug}`);
    }
  }

  // Seed apps — chess stays **pending** for operator demo (approve in /admin/apps); others approved.
  for (const app of ALL_APPS) {
    console.info(`Seeding ${app.slug} app...`);
    const chessDemoPending = app.slug === 'chess';
    const approvalStatus = chessDemoPending ? APP_APPROVAL_PENDING : APP_APPROVAL_APPROVED;
    const status = chessDemoPending ? 'inactive' : 'active';
    const [existing] = await db.select().from(apps).where(eq(apps.slug, app.slug)).limit(1);
    if (existing) {
      await db
        .update(apps)
        .set({
          toolSchemas: app.toolSchemas,
          description: app.description,
          status,
          approvalStatus,
          updatedAt: new Date(),
        })
        .where(eq(apps.id, existing.id));
      console.info(
        `${app.slug} app updated (${chessDemoPending ? 'pending approval — use /admin/apps' : 'approved'}).`
      );
    } else {
      await db.insert(apps).values({
        ...app,
        status,
        approvalStatus,
      });
      console.info(
        `${app.slug} app registered (${chessDemoPending ? 'pending approval — use /admin/apps' : 'approved'}).`
      );
    }
  }

  await pool.end();
  console.info('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
