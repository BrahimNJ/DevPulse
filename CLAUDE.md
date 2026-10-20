# CLAUDE.md

@AGENTS.md

## Project

DevPulse analyses public GitHub repositories. The only feature so far is the `branches`
command-line report. Stack: TypeScript (strict) run natively by Node.js 24 LTS, npm,
`node:test`. See `docs/decisions/`; ADR 0005 defines the source layout.

## Commands

| Command             | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `npm ci`            | Install pinned dependencies and Git hooks        |
| `npm run check`     | All gates: format, lint, Markdown, types, tests  |
| `npm run lint:fix`  | Auto-fix ESLint findings                         |
| `npm run format`    | Format every file with Prettier                  |
| `npm run typecheck` | TypeScript, including JavaScript via `checkJs`   |
| `npm test`          | Unit tests with `node:test` (`src/**/*.test.ts`) |
| `npm run devpulse`  | Run the CLI; needs `GITHUB_TOKEN`                |

Tests never reach the network: inject `fetch` and the clock, as the existing tests do.

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
