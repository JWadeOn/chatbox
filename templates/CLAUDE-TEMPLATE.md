# CLAUDE.md

> This file is read by Claude Code automatically when entering the project.
> Fill in each section. Delete comments once populated.

## Project

<!-- One-liner: what is this, who is it for, what stage is it in? -->

## Stack

<!-- Languages, frameworks, key libraries, versions that matter. Example: -->
<!-- Python 3.12 · FastAPI · SQLAlchemy 2.x · Postgres 16 · Redis · deployed on Fly.io -->

## Repo Layout

<!-- Brief map of important directories. Example: -->
<!--
src/
  api/        — Route handlers
  core/       — Business logic / services
  models/     — Data models / ORM
  utils/      — Shared helpers
tests/
  unit/       — Fast isolated tests
  integration/— Tests that hit DB / services
infra/        — IaC / deploy configs
-->

## Commands

<!-- Exact commands Claude Code will run. Keep these precise. -->

| Action  | Command |
| ------- | ------- |
| Install | `TODO`  |
| Dev     | `TODO`  |
| Build   | `TODO`  |
| Test    | `TODO`  |
| Lint    | `TODO`  |
| Format  | `TODO`  |
| Migrate | `TODO`  |

## Code Conventions

<!-- Naming, patterns, style preferences. Examples: -->
<!-- - Use snake_case for Python, camelCase for TS -->
<!-- - Prefer dataclasses over Pydantic for internal models -->
<!-- - All public functions need docstrings -->
<!-- - No `any` in TypeScript -->
<!-- - Imports: stdlib → third-party → local, separated by blank lines -->

## Architecture & Patterns

<!-- Key design decisions and WHY. Examples: -->
<!-- - Repository pattern for data access (keeps business logic DB-agnostic) -->
<!-- - All API responses use standard envelope: { data, error, meta } -->
<!-- - Auth flows through middleware in src/middleware/auth.py -->
<!-- - Events are async via Redis pub/sub -->

## Gotchas

<!-- Things that have tripped people up. Examples: -->
<!-- - `users` table has soft deletes — always filter by `deleted_at IS NULL` -->
<!-- - Don't import from `src/internal/` outside of `src/core/` -->
<!-- - The legacy `/v1/` endpoints have different auth — check `docs/legacy-api.md` -->

## Testing

<!-- What you expect, where tests go, key fixtures. Examples: -->
<!-- - Every new endpoint needs an integration test in tests/integration/api/ -->
<!-- - Use the `test_client` and `test_db` fixtures from conftest.py -->
<!-- - Run `pytest -x --tb=short` for fast feedback -->
<!-- - Minimum coverage: 80% on new code -->

## Environment

<!-- How to set up local env. Never put real secrets here. -->
<!-- - Copy `.env.example` → `.env` and fill in values -->
<!-- - Docker Compose for local Postgres + Redis: `docker compose up -d` -->
<!-- - Secrets are in 1Password vault "Engineering" -->

## Do NOT

<!-- Explicit guardrails. These matter. Examples: -->
<!-- - Do NOT modify migration files after they've been applied -->
<!-- - Do NOT add new pip/npm dependencies without discussing first -->
<!-- - Do NOT commit directly to main — always use feature branches -->
<!-- - Do NOT disable type checking or linters to fix errors -->
<!-- - Do NOT store secrets or credentials anywhere in the repo -->