# CLAUDE.md

@AGENTS.md

## Project

DevPulse is at the standards stage: tooling, CI/CD and documentation exist, application
code does not. Stack: TypeScript (strict), Node.js 24 LTS, npm. See `docs/decisions/`.

## Commands

| Command             | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `npm ci`            | Install pinned dependencies and Git hooks      |
| `npm run check`     | All gates: format, lint, Markdown, types       |
| `npm run lint:fix`  | Auto-fix ESLint findings                       |
| `npm run format`    | Format every file with Prettier                |
| `npm run typecheck` | TypeScript, including JavaScript via `checkJs` |

No test runner exists yet. Do not claim tests pass.

## Working here

- Workflow: `/issue` → `/start-work <n>` → change → `/check` → `/commit <n>` → `/pr <n>`.
- Explore first, plan for anything non-trivial, then edit. Verify with `npm run check`.
- Delegate wide searches to `repo-explorer` and reviews to `code-reviewer`.
- Hooks format edited files and block edits to `.env*`, `package-lock.json`, and
  `CHANGELOG.md`. Do not work around them.
- Everything committed or published to GitHub is written in English.

## Where things are

- Rules: `CONTRIBUTING.md` (workflow), `docs/DEVELOPMENT.md` (gates, CI/CD).
- Decisions: `docs/decisions/`. Claude Code usage: `docs/ai/CLAUDE_CODE.md`.
- CI/CD: `.github/workflows/`. Agent config: `.claude/`.
