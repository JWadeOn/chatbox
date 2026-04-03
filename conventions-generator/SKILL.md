---
name: conventions-generator
description: Generate or update a CONVENTIONS.md file that captures cross-project coding standards, commit conventions, PR practices, and development philosophy. Use this skill when the user says "set up my conventions", "coding standards", "style guide", "how I like to code", "my development rules", "cross-project conventions", or wants to define personal or org-wide standards that apply to every repo. Also trigger when the user references existing projects or preferences and wants them codified into a reusable conventions doc. This is a foundational doc that CLAUDE.md files reference.
---

# Conventions Generator

Generate a CONVENTIONS.md that captures universal development standards — the rules that apply across every project regardless of stack. This is the meta-document that individual CLAUDE.md files reference.

## When to use

- User wants to codify their personal or org-wide coding standards
- User says "set up my conventions", "I want a style guide", "my coding rules"
- User is starting to work across multiple projects and wants consistency
- User references how they like to work and wants it written down

## What this is NOT

- Not project-specific rules (those go in CLAUDE.md)
- Not a tech stack guide (that's in the spec)
- Not a linter config (though it should align with one)

## Process

### 1. Gather conventions

Look for signals from multiple sources:

**From conversation:** Listen for opinions like "I always use conventional commits" or "I hate when PRs are too big" — these are conventions waiting to be written down.

**From existing projects:** If you can access the user's repos, look at:
- Git log for commit message patterns
- PR history for description style
- Linter and formatter configs for code style
- Existing CONTRIBUTING.md or style guides
- CLAUDE.md files for project-specific rules that might be universal

**From stated preferences:** Ask the user about areas they have opinions on. Batch into one round:
- Commit message format?
- Branch naming?
- PR size/description expectations?
- Testing philosophy?
- How they feel about comments?
- Dependency management approach?

If the user doesn't have strong opinions on something, suggest sensible defaults and let them accept or modify.

### 2. Write the conventions

Structure:
- **Commit Messages** — Format, types, examples
- **Branch Naming** — Pattern and examples
- **Pull Requests** — Title, description, size, review expectations
- **Code Comments** — When, why, format for TODOs
- **Naming** — Variables, functions, files, constants
- **Error Handling** — Philosophy and patterns
- **Testing** — What to test, naming, independence
- **Dependencies** — Evaluation criteria, versioning strategy
- **Security** — Baseline practices
- **Documentation** — What gets documented where
- **AI-Specific Conventions** — How to work with Claude Code and similar tools

### 3. Quality standards

- Every convention should be actionable — "write clean code" is useless; "boolean variables use is/has/should prefix" is useful
- Include examples for anything that could be ambiguous
- Keep it under 150 lines — this goes into context windows
- If a convention is controversial, note the reasoning so future readers understand why

## Output

Write to `/mnt/user-data/outputs/CONVENTIONS.md` (Claude.ai) or the user's specified location.

Suggest the user link to it from each project's CLAUDE.md: "Add a note in your CLAUDE.md like 'See CONVENTIONS.md for cross-project standards.'"