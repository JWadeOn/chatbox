---
name: claude-md-generator
description: Generate or update a project's CLAUDE.md file from a spec, PRD, README, or conversation context. Use this skill whenever the user says things like "generate a CLAUDE.md", "set up CLAUDE.md for this project", "update my CLAUDE.md", "hydrate the CLAUDE.md template", or mentions wanting to create project context for Claude Code. Also trigger when a user shares a project spec or PRD and wants to turn it into a CLAUDE.md. Works with any tech stack and project type.
---

# CLAUDE.md Generator

Generate a complete, high-quality CLAUDE.md from a project spec, PRD, README, or conversational description. The output should be immediately usable by Claude Code with zero editing needed for structure — the user only needs to verify content accuracy.

## Position in the pipeline

General Presearch → PRD → Technical Presearch → Spec → **CLAUDE.md**

CLAUDE.md answers: "What does an AI agent need to know to work in this codebase?"
It condenses the spec (and optionally the repo itself) into a concise onboarding doc for Claude Code.

This is the LAST step. A spec gives you the richest input. But this skill works standalone too — it can generate from a PRD, README, repo contents, or just a conversation.

## When to use

- User has completed a spec and wants to set up Claude Code context
- User wants to create a new CLAUDE.md for a project
- User has a spec/PRD/README and wants to derive a CLAUDE.md from it
- User wants to update an existing CLAUDE.md with new information
- User is setting up a new repo and wants the AI-native foundation

## Inputs

Accept any combination of:
- A project spec, PRD, or design doc (uploaded file or pasted text)
- An existing README.md
- An existing CLAUDE.md that needs updating
- A conversational description of the project
- The actual repo contents (if accessible via filesystem)

## Process

### 1. Gather context

Read everything available. If the user uploaded files, read them. If there's a repo to explore, look at:
- `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc. for stack info
- Directory structure for repo layout
- Existing README, CONTRIBUTING, or ARCHITECTURE docs
- `Makefile`, `justfile`, `scripts/` for commands
- `.eslintrc`, `ruff.toml`, `prettier.config` for code conventions
- `Dockerfile`, `docker-compose.yml`, `fly.toml`, `terraform/` for infra context
- Test directories and config for testing conventions

If information is missing and you can't infer it, ask the user — but batch your questions into one round, not a drip-feed.

### 2. Generate the CLAUDE.md

Use the template structure below. Every section must be filled with real content — no placeholders, no TODOs, no HTML comments. If you genuinely cannot determine something (e.g., the deploy command for a project that hasn't been deployed yet), write a short note like `TBD — not yet configured` rather than leaving a placeholder comment.

**Tone:** Direct, imperative, scannable. Write for a capable engineer starting on day one. Bullet points and short sentences. No fluff, no preamble paragraphs.

**Length:** Aim for 80-200 lines. Shorter is better if it captures everything. Every line should earn its place in the context window.

### 3. Template structure

```markdown
# CLAUDE.md

## Project
<!-- Single sentence: what, who, stage -->

## Stack
<!-- Tech with versions that matter -->

## Repo Layout
<!-- Directory tree or description of key dirs -->

## Commands
<!-- Table: action | command -->

## Code Conventions
<!-- Bullet list of style rules and patterns -->

## Architecture & Patterns
<!-- Key decisions and reasoning -->

## Gotchas
<!-- Non-obvious things that cause bugs -->

## Testing
<!-- Where tests go, how to run, key fixtures, coverage expectations -->

## Environment
<!-- Local setup, env vars, Docker, etc. No real secrets. -->

## Do NOT
<!-- Hard constraints and guardrails -->
```

### 4. Quality checklist

Before delivering, verify:
- [ ] Every section has real content (no leftover template comments)
- [ ] Commands are exact and runnable, not generic examples
- [ ] Stack versions are specific where they matter
- [ ] Repo layout matches the actual directory structure
- [ ] Code conventions reflect what's actually in the codebase (linter configs, etc.)
- [ ] Gotchas are real and specific, not generic advice
- [ ] "Do NOT" section has project-specific guardrails
- [ ] Total length is under 200 lines (ideally under 150)
- [ ] No prose paragraphs — everything is scannable

### 5. Updating an existing CLAUDE.md

When updating rather than creating from scratch:
- Read the existing CLAUDE.md first
- Preserve any content the user has manually added
- Merge new information from the spec into the appropriate sections
- Call out what changed so the user can review

## Output

Write the CLAUDE.md file to the project root (or wherever the user specifies). If in Claude.ai, save to `/mnt/user-data/outputs/CLAUDE.md` so the user can download it.

## Example

**Input:** "I'm building a Next.js 14 app with App Router, Prisma ORM, Postgres, deployed on Vercel. It's a SaaS for invoice management. We use TypeScript strict mode, Tailwind, and shadcn/ui. Tests are in Vitest."

**Output:**

```markdown
# CLAUDE.md

## Project
Invoice management SaaS — multi-tenant web app for small businesses to create, send, and track invoices. Active development, pre-launch.

## Stack
TypeScript 5.x (strict) · Next.js 14 (App Router) · React 18 · Prisma ORM · PostgreSQL · Tailwind CSS · shadcn/ui · Vitest · deployed on Vercel

## Repo Layout
app/              — Next.js App Router pages and layouts
  (auth)/         — Auth-gated routes (dashboard, invoices, settings)
  api/            — Route handlers
components/       — React components (shadcn/ui based)
  ui/             — shadcn/ui primitives
lib/              — Shared utilities, Prisma client, auth helpers
prisma/
  schema.prisma   — Data model
  migrations/     — Migration history
tests/            — Vitest test files

## Commands
| Action  | Command                    |
| ------- | -------------------------- |
| Install | `pnpm install`             |
| Dev     | `pnpm dev`                 |
| Build   | `pnpm build`               |
| Test    | `pnpm test`                |
| Lint    | `pnpm lint`                |
| Format  | `pnpm format`              |
| Migrate | `pnpm prisma migrate dev`  |
| Studio  | `pnpm prisma studio`       |

## Code Conventions
- TypeScript strict mode — no `any`, no `as` casts unless unavoidable (add a comment explaining why)
- React components: named exports, function declarations, Props type co-located
- Server Components by default; add `"use client"` only when state/effects are needed
- Tailwind for all styling — no CSS modules, no inline style objects
- shadcn/ui components for all UI primitives — don't reinvent buttons, dialogs, etc.
- Prisma queries live in `lib/db/` — never call Prisma directly from components or route handlers
- Imports: use `@/` path alias for all project imports

## Architecture & Patterns
- Multi-tenant via `organizationId` foreign key on all tenant-scoped tables
- Auth handled by NextAuth.js with JWT sessions
- Server Actions for mutations, Route Handlers for webhooks/external APIs
- All monetary values stored as integers (cents) — format on display only
- Optimistic UI updates for invoice status changes

## Gotchas
- Prisma Client must be instantiated as singleton in `lib/db/client.ts` — importing from anywhere else causes connection pool exhaustion in dev
- `organizationId` must be included in every query — missing it leaks data across tenants
- Next.js caching is aggressive — use `revalidatePath` after mutations or data appears stale
- Tailwind classes in shadcn components: extend via `className` prop, don't modify the component source

## Testing
- Vitest for unit and integration tests
- Test files co-located: `foo.test.ts` next to `foo.ts`
- Use `tests/helpers/db.ts` for test database setup/teardown
- Mock Prisma with `vitest-mock-extended` — don't hit real DB in unit tests

## Environment
- Copy `.env.example` → `.env.local`
- Local Postgres: `docker compose up -d`
- Required env vars: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
- Vercel env vars managed in Vercel dashboard — never commit `.env.local`

## Do NOT
- Do NOT use `any` or suppress TypeScript errors
- Do NOT query Prisma outside of `lib/db/`
- Do NOT skip `organizationId` filtering on tenant-scoped queries
- Do NOT modify generated shadcn/ui component source — extend via props
- Do NOT commit to main — use feature branches with PR review
- Do NOT add new dependencies without checking bundle size impact
```