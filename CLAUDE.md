# CLAUDE.md

@AGENTS.md

## Project

DevPulse analyses public GitHub repositories. The only feature so far is the branch
report, available as a CLI and as a local React dashboard. Stack: TypeScript (strict)
run natively by Node.js 24 LTS, npm, `node:test`, React and Vite for `src/web`. See
`docs/decisions/`; ADRs 0005 and 0006 define the source layout.

## Commands

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `npm ci`            | Install pinned dependencies and Git hooks           |
| `npm run check`     | All gates: format, lint, Markdown, types, tests     |
| `npm run lint:fix`  | Auto-fix ESLint findings                            |
| `npm run format`    | Format every file with Prettier                     |
| `npm run typecheck` | TypeScript, including JavaScript via `checkJs`      |
| `npm test`          | Unit tests with `node:test` (`src/**/*.test.ts`)    |
| `npm run devpulse`  | Run the CLI; needs `GITHUB_TOKEN`                   |
| `npm run web`       | Dashboard on `127.0.0.1:5173`; needs `GITHUB_TOKEN` |
| `npm run build`     | Production build of the interface into `dist/web`   |
| `npm start`         | Production server for `dist/web`; see DEVELOPMENT   |

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
