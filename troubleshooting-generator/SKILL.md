---
name: troubleshooting-generator
description: Generate or update a TROUBLESHOOTING.md file that captures solutions to non-obvious problems. Use this skill when the user says "add this to troubleshooting", "document this fix", "I keep running into this", "troubleshooting doc", or has just solved a gnarly bug and wants to record the solution for the future. Also trigger when the user says "we should write this down" after debugging, or wants to create a troubleshooting guide for their project.
---

# Troubleshooting Generator

Maintain a TROUBLESHOOTING.md that captures real solutions to real problems. This isn't theoretical documentation — it's a growing record of things that actually went wrong and how they were fixed.

## When to use

- User just solved a non-obvious problem and wants to record the solution
- User wants to create an initial troubleshooting doc for a project
- User says "add this to troubleshooting", "let's document this fix"
- User describes a problem/solution pair that future developers will hit

## Entry format

Every entry follows the same pattern: symptom → cause → fix.

```markdown
### [Short description of the problem]
**Symptom:** What you actually see (error message, behavior, log output)
**Cause:** What's actually wrong (the non-obvious part)
**Fix:** What to do about it (exact commands, config changes, code changes)
```

The symptom is the most important part — it's what people will search for. Use the actual error message text when there is one.

## Process

### Creating a new troubleshooting doc

1. Check if the project has existing issues, bug reports, or solved problems
2. Check CLAUDE.md's "Gotchas" section — some of those may deserve fuller troubleshooting entries
3. Organize by category: Setup & Environment, Build & Deploy, Data & Database, Third-Party Services, Runtime & Performance, Common Error Messages
4. Start with whatever problems you know about; the doc grows over time

### Adding an entry

1. Identify the category
2. Write the symptom in the user's actual experience language — "the app crashes on startup" not "application initialization failure"
3. Explain the cause at the right depth — enough to understand, not so much it's a tutorial
4. Make the fix copy-pasteable when possible — exact commands, exact config values
5. If the fix involves a workaround (not a real fix), note that and link to the real issue if there is one

### Quality standards

- Symptoms should be searchable — include exact error messages in backticks
- Causes should explain WHY, not just restate the symptom
- Fixes should be actionable — a developer should be able to follow them without guessing
- Include "verified on" dates if the fix is version-dependent
- If a fix has side effects or risks, note them
- Don't include problems with obvious solutions — this doc is for the non-obvious stuff

## Output

Write to `/mnt/user-data/outputs/TROUBLESHOOTING.md` or update the existing one.