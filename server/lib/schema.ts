import { index, integer, jsonb, pgTable, real, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

// 2.1 Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  role: varchar('role', { length: 20 }).default('student').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2.2 Conversations
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_conversations_user').on(table.userId, table.updatedAt)]
);

// 2.3 Messages
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_messages_conversation').on(table.conversationId, table.createdAt)]
);

// 2.4 App Registry
export const apps = pgTable('apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  authType: varchar('auth_type', { length: 20 }).notNull(),
  iframeUrl: varchar('iframe_url', { length: 2048 }).notNull(),
  oauthConfig: jsonb('oauth_config'),
  toolSchemas: jsonb('tool_schemas').default([]).notNull(),
  /** Legacy visibility flag; prefer `approvalStatus` for governance. Kept for migrations and seeds. */
  status: varchar('status', { length: 20 }).default('active').notNull(),
  /** Governance: pending (awaiting operator review), approved (student-available), disabled (blocked). */
  approvalStatus: varchar('approval_status', { length: 20 }).default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2.8 App Sessions (defined before tool_logs for FK reference)
export const appSessions = pgTable(
  'app_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    contextSummary: jsonb('context_summary').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_app_sessions_conversation').on(table.conversationId),
    index('idx_app_sessions_conversation_status').on(table.conversationId, table.status),
  ]
);

// 2.5 Tool Invocation Log
export const toolLogs = pgTable(
  'tool_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invocationId: uuid('invocation_id').unique().notNull().defaultRandom(),
    sessionId: uuid('session_id').references(() => appSessions.id),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id),
    toolName: varchar('tool_name', { length: 255 }).notNull(),
    params: jsonb('params').notNull(),
    result: jsonb('result'),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_tool_logs_conversation').on(table.conversationId, table.createdAt),
    index('idx_tool_logs_session').on(table.sessionId),
    index('idx_tool_logs_invocation').on(table.invocationId),
  ]
);

// 2.6 OAuth Tokens
export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('uq_oauth_user_app').on(table.userId, table.appId)]
);

// 2.7 Intents
export const intents = pgTable(
  'intents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    confidence: real('confidence').default(1.0).notNull(),
    appId: uuid('app_id').references(() => apps.id),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_intents_conversation').on(table.conversationId, table.createdAt),
    index('idx_intents_conversation_status').on(table.conversationId, table.status),
  ]
);

// 2.9 Study Decks (Flashcards app)
export const studyDecks = pgTable(
  'study_decks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    cards: jsonb('cards').default([]).notNull(),
    cardCount: integer('card_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_study_decks_user').on(table.userId)]
);

// 2.10 Study Progress (Flashcards app)
export const studyProgress = pgTable(
  'study_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => studyDecks.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => appSessions.id),
    cardsSeen: integer('cards_seen').default(0).notNull(),
    cardsCorrect: integer('cards_correct').default(0).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_study_progress_user').on(table.userId), index('idx_study_progress_deck').on(table.deckId)]
);
