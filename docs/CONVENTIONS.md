# CONVENTIONS.md

> Cross-project conventions for ChatBridge. Project-specific rules go in CLAUDE.md.

## Commit Messages

Format: `<type>(<scope>): <short description>` -- imperative mood, lowercase, no trailing period.
Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `perf`, `ci`
Scopes: `chat`, `auth`, `apps`, `tools`, `iframe`, `chess`, `weather`, `spotify`, `ci`, `setup`, `db`
One commit per logical change. A TDD cycle produces 2-3 commits: `test(auth): ...`, `feat(auth): ...`, optionally `refactor(auth): ...`.
Note: chatbox omits scope on some commits; for ChatBridge, always include scope.

## Branch Naming

Trunk-based with short-lived branches. Pattern: `feature/<vertical-slice>` or `fix/<description>`.
- Branch lives at most 1 day before merging to main
- Main must always be deployable; no branch depends on another unmerged branch

## Pull Requests

- Title matches commit format: `type(scope): description`
- Body explains WHY, not WHAT. Link issues. Screenshots for UI changes.
- Aim for <400 lines changed. All CI checks must pass before merge.

## Code Style (Biome)

Enforced by Biome (not Prettier). Run `biome check` before committing.
- 2-space indent, 120 char line width, LF line endings
- Single quotes (double in JSX), semicolons as needed (omit when optional)
- Trailing commas: ES5. Arrow parens: always.
- Linter warnings: `noExplicitAny`, `noUnusedImports`, `useExhaustiveDependencies`, `noConsole` (allow `assert`/`error`/`info`/`warn`), `noFloatingPromises`

## TypeScript

- Strict mode, target ES2021, module NodeNext
- Path aliases: `@/*` -> `src/renderer/*`, `@shared/*` -> `src/shared/*`
- Prefer `import type { Foo }` for type-only imports
- Avoid `any` and non-null assertions (both produce Biome warnings)

## Naming

- Files: PascalCase for React components (`MessageList.tsx`), snake_case for utilities (`json_utils.ts`)
- Components/types/interfaces/enums: PascalCase (`InputBox`, `Session`, `MessageRoleEnum.User`)
- Functions/variables: camelCase (`createMessage`, `formatNumber`)
- Booleans: prefix with `is`/`has`/`should`/`can` (`isChatSession`)
- True constants: UPPER_SNAKE (`JK_EVENTS`); module-level config values: camelCase

## Imports

Biome auto-organizes. Order: (1) external packages, (2) `@shared/*` aliases, (3) `@/*` internal aliases, (4) relative imports.

## Styling

Tailwind CSS with CSS custom properties. Use `chatbox-*` design tokens:
- Colors: `chatbox-tint-*`, `chatbox-border-*`, `chatbox-background-*`
- Spacing: `chatbox-spacing-{none,3xs,xxs,xs,sm,md,lg,xl,xxl}`
- Radii: `chatbox-radius-{none,xs,sm,md,lg,xl,xxl}`
- Dark mode: class-based. No Tailwind preflight (reset disabled).

## Testing

TDD: Red (failing test) -> Green (minimal impl) -> Refactor.
- File naming: `{module}.test.ts` colocated in `__tests__/` mirroring source structure
- Tooling: Vitest (unit/integration), Supertest (API), React Testing Library (components), Playwright (E2E stretch)
- Every feature tests: happy path, error path, edge case, auth (401/403)
- Test names describe scenarios: `'expired subscription blocks access'` not `'process'`
- No test interdependencies; each test stands alone

## Dependencies

- Package manager: pnpm with hoisted `node-linker` (Electron compat)
- Workspace: pnpm workspaces. Supply chain: `minimumReleaseAge: 10080` (7-day minimum)
- Before adding: check maintenance, bundle size, license, security. Document rationale in PR.

## Error Handling

- Fail early, fail loudly. Never swallow errors silently.
- User-facing errors: helpful and actionable. Internal errors: detailed with context (what was attempted, what input, what failed).
- No `console.log` in production code (allowed: `console.error`/`warn`/`info`/`assert`).

## CI Checks (Pre-Merge)

1. All tests pass (`pnpm test`)
2. Linting passes (`biome check`)
3. TypeScript compiles (`pnpm run build`)
4. No `console.log` in production code

## Security

- Never commit secrets, tokens, or credentials. Use env vars for all config.
- Validate all external input. Use parameterized queries (no SQL string interpolation).
- Audit dependencies regularly; update promptly for security patches.
