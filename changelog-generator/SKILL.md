---
name: changelog-generator
description: Generate or update a CHANGELOG.md from git history, commit messages, or a description of changes. Use this skill when the user says "update the changelog", "write a changelog", "what changed since last release", "generate release notes", "document the changes", or wants to maintain a running log of project changes. Also trigger when the user has just completed a feature or PR and wants it logged, or when preparing for a release.
---

# Changelog Generator

Generate or update a CHANGELOG.md from git history, diffs, or described changes. Keeps a running, human-readable record of what changed, when, and why.

## When to use

- User wants to create a changelog for a project
- User wants to update an existing changelog with recent work
- User is preparing a release and needs release notes
- User says "log this change", "update changelog", "what changed"

## Format

Use Keep a Changelog format (keepachangelog.com):

```markdown
# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- New feature description

### Changed
- Modification to existing behavior

### Fixed
- Bug fix description

### Removed
- Removed feature or capability

### Deprecated
- Feature marked for future removal

### Security
- Security-related change

## [1.0.0] — YYYY-MM-DD

### Added
- Initial release features
```

## Process

### From git history

If you have access to the repo:
1. Read the existing CHANGELOG.md (if any)
2. Run `git log --oneline` since the last changelog entry
3. Group commits by category (Added, Changed, Fixed, etc.)
4. Rewrite commit messages as user-facing descriptions — "fix(api): handle null response from payment provider" becomes "Fixed crash when payment provider returns empty response"
5. Collapse related commits into single entries
6. Add to the [Unreleased] section (or a new version section if releasing)

### From described changes

If the user describes what changed:
1. Categorize into Added/Changed/Fixed/Removed/Deprecated/Security
2. Write each entry as a clear, user-facing statement
3. Merge into the existing changelog

### Quality standards

- Entries are written for humans, not machines — "Added invoice PDF export with customizable templates" not "feat(invoice): add pdf export"
- Group related changes — 5 commits fixing the same feature = 1 changelog entry
- Most recent changes at the top
- Include breaking changes prominently with a ⚠️ prefix
- Don't include internal refactors unless they affect behavior
- Each entry answers "what does this mean for someone using this project?"

## Output

Write to `/mnt/user-data/outputs/CHANGELOG.md` or update the existing one in the project.