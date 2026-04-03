---
name: pr-description-generator
description: Generate a pull request description from a diff, commit history, or description of changes. Use this skill when the user says "write a PR description", "PR description", "describe this PR", "review description", "what should I write for this PR", or is preparing to open a pull request and wants a well-structured description. Also trigger when the user pastes a diff or commit log and wants it turned into a PR description. The skill references the project's spec and PRD when available to explain WHY changes were made, not just what changed.
---

# PR Description Generator

Generate clear, context-rich pull request descriptions that explain WHAT changed and WHY. Links changes back to the spec, PRD, or task list when available.

## When to use

- User is opening a PR and wants help writing the description
- User pastes a diff or commit log and wants a description
- User says "describe this PR", "PR description for these changes"

## Why this matters

A good PR description saves reviewer time, creates a searchable record of decisions, and makes the changelog easier to write. Most PR descriptions are too thin — "fixed the bug" tells a reviewer nothing.

## Process

### 1. Gather context

From the available information, understand:
- **What changed:** Diff, commit messages, or user description
- **Why it changed:** Reference the spec, PRD, task list, or issue if available
- **What it affects:** Which parts of the system are touched
- **How to test:** What a reviewer should check

### 2. Write the description

Structure:

```markdown
## What

<!-- 1-3 sentence summary of the change. What would a teammate skim? -->

## Why

<!-- Link to the requirement, task, or issue that motivated this. -->
<!-- If it's a bug fix: what was the bug, who was affected, how was it found? -->
<!-- If it's a feature: which user story or PRD requirement does this implement? -->

## How

<!-- Brief technical explanation of the approach. -->
<!-- Not a line-by-line walkthrough — the diff shows that. -->
<!-- Focus on non-obvious decisions: "Used X instead of Y because Z." -->

## Testing

<!-- What was tested and how. -->
<!-- New tests added? Manual testing steps? Edge cases covered? -->

## Notes for Reviewers

<!-- Anything that needs special attention. -->
<!-- "The migration is irreversible — please double-check the schema." -->
<!-- "I'm not sure about the error handling in X — would appreciate a second opinion." -->
```

### 3. Quality standards

- **Why > What:** Reviewers can read the diff to see what. They need the description to understand why.
- **Link to context:** If there's a spec, PRD, or issue, reference it.
- **Flag risks:** If the change is risky, say so. "This touches the payment flow — extra review welcome."
- **Be honest about unknowns:** "I'm not confident about X" is more useful than silence.
- **Size warning:** If the diff is large, explain why it couldn't be smaller or suggest a review order.
- **Screenshots:** Suggest including screenshots for UI changes (note it in the description).
- **Breaking changes:** Call these out prominently at the top.

### Adapting to conventions

If the project has a CONVENTIONS.md or PR template, follow it. If the user has a specific PR format they prefer, match it. The structure above is a sensible default, not a rigid requirement.

## Output

Output the PR description as text in the conversation, ready to paste. If the user wants it saved, write to `/mnt/user-data/outputs/PR-DESCRIPTION.md`.