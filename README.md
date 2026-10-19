<div align="center">

# DevPulse

**A standards-first, AI-assisted engineering foundation.**
Every quality gate, pipeline, and agent workflow is in place and enforced before the first feature is written.

[![CI](https://github.com/BrahimNJ/DevPulse/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/BrahimNJ/DevPulse/actions/workflows/ci.yml)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-FE5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org)
[![release-please](https://img.shields.io/badge/release-release--please-4285F4?logo=google&logoColor=white)](https://github.com/googleapis/release-please)
[![Dependabot](https://img.shields.io/badge/Dependabot-enabled-025E8C?logo=dependabot&logoColor=white)](.github/dependabot.yml)

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![Node.js](https://img.shields.io/badge/Node.js-24%20LTS-5FA04E?logo=nodedotjs&logoColor=white)](.nvmrc)
[![ESLint](https://img.shields.io/badge/ESLint-strict%20type--checked-4B32C3?logo=eslint&logoColor=white)](eslint.config.mjs)
[![Prettier](https://img.shields.io/badge/code%20style-Prettier-F7B93E?logo=prettier&logoColor=black)](.prettierrc.json)
[![Claude Code](https://img.shields.io/badge/AI%20agents-Claude%20Code-D97757?logo=claude&logoColor=white)](docs/ai/CLAUDE_CODE.md)

[Highlights](#highlights) · [Tech stack](#tech-stack) · [Delivery pipeline](#delivery-pipeline) · [AI-assisted development](#ai-assisted-development) · [Quick start](#quick-start) · [Roadmap](#status-and-roadmap)

</div>

---

## Why DevPulse

Most projects add linting, CI, and conventions after the code exists, then fight the
backlog of violations. DevPulse inverts the order: the engineering system comes first,
so the first line of product code is already formatted, linted, type-checked, reviewed,
versioned, and released through an automated, auditable pipeline.

It is also a working reference for **AI-assisted development done with discipline**:
Claude Code runs inside explicit permissions, enforced hooks, and specialised
subagents, rather than as an unconstrained autocomplete.

## Highlights

| Area                        | What is in place                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Quality gates**           | Strict TypeScript, type-aware ESLint with complexity limits, Prettier, markdownlint; one command, `npm run check`, runs them all    |
| **Shift-left enforcement**  | Git hooks lint and format staged files, validate commit messages, and type-check before every push                                  |
| **CI pipeline**             | 8 parallel jobs aggregated into a single required `ci-success` check, plus PR title validation and dependency review                |
| **Supply-chain security**   | Actions pinned to commit SHAs, images to digests, read-only default token, gitleaks, npm audit and signature checks, licence policy |
| **Automated releases**      | Semantic versioning, changelog, tags, and GitHub releases generated from Conventional Commits by release-please                     |
| **AI agent engineering**    | Claude Code with shared permissions, guard-rail hooks, 5 scoped subagents, and 6 workflow skills, tuned for token efficiency        |
| **Architecture governance** | Every technical choice recorded as an Architecture Decision Record, with alternatives and consequences                              |

## Tech stack

| Concern            | Tools                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Language & runtime | ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white) ![Node.js](https://img.shields.io/badge/-Node.js%2024-5FA04E?logo=nodedotjs&logoColor=white) ![npm](https://img.shields.io/badge/-npm-CB3837?logo=npm&logoColor=white)                                                                                                                      |
| Code quality       | ![ESLint](https://img.shields.io/badge/-ESLint-4B32C3?logo=eslint&logoColor=white) ![typescript-eslint](https://img.shields.io/badge/-typescript--eslint-3178C6?logo=typescript&logoColor=white) ![Prettier](https://img.shields.io/badge/-Prettier-F7B93E?logo=prettier&logoColor=black) ![markdownlint](https://img.shields.io/badge/-markdownlint-000000?logo=markdown&logoColor=white) |
| Git workflow       | ![Conventional Commits](https://img.shields.io/badge/-Conventional%20Commits-FE5196?logo=conventionalcommits&logoColor=white) ![commitlint](https://img.shields.io/badge/-commitlint-000000?logo=commitlint&logoColor=white) ![husky](https://img.shields.io/badge/-husky-42B983) ![lint-staged](https://img.shields.io/badge/-lint--staged-6E6E6E)                                        |
| CI/CD              | ![GitHub Actions](https://img.shields.io/badge/-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white) ![release-please](https://img.shields.io/badge/-release--please-4285F4?logo=google&logoColor=white) ![actionlint](https://img.shields.io/badge/-actionlint-2088FF)                                                                                                             |
| Security           | ![Dependabot](https://img.shields.io/badge/-Dependabot-025E8C?logo=dependabot&logoColor=white) ![gitleaks](https://img.shields.io/badge/-gitleaks-B8282D) ![Dependency Review](https://img.shields.io/badge/-Dependency%20Review-181717?logo=github&logoColor=white)                                                                                                                       |
| AI tooling         | ![Claude Code](https://img.shields.io/badge/-Claude%20Code-D97757?logo=claude&logoColor=white) subagents, skills, hooks, permission policies                                                                                                                                                                                                                                               |
| Editor             | ![VS Code](https://img.shields.io/badge/-VS%20Code-007ACC) ![EditorConfig](https://img.shields.io/badge/-EditorConfig-FEFEFE?logo=editorconfig&logoColor=black) recommended extensions, format on save                                                                                                                                                                                     |

The reasoning behind each choice, including the alternatives that were rejected, is in
[`docs/decisions/`](docs/decisions/).

## Delivery pipeline

```mermaid
flowchart LR
    A[Issue] --> B[Branch<br/>type/description]
    B --> C[Commit]
    C -->|pre-commit<br/>lint-staged| C
    C -->|commit-msg<br/>commitlint| D[Push]
    D -->|pre-push<br/>typecheck| E[Pull request]
    E --> F{CI}
    F -->|format · lint · types<br/>commits · audit · secrets<br/>actionlint · PR title<br/>dependency review| G[ci-success]
    G --> H[Merge to main]
    H --> I[release-please<br/>release PR]
    I --> J[Tag vX.Y.Z<br/>+ CHANGELOG<br/>+ GitHub release]
```

### Quality gates

| Gate                          | Local hook | CI  |
| ----------------------------- | ---------- | --- |
| Formatting (Prettier)         | pre-commit | ✅  |
| Linting (ESLint, type-aware)  | pre-commit | ✅  |
| Documentation (markdownlint)  | pre-commit | ✅  |
| Type checking (TypeScript)    | pre-push   | ✅  |
| Commit messages (commitlint)  | commit-msg | ✅  |
| Pull request title            |            | ✅  |
| Secret scanning (gitleaks)    |            | ✅  |
| Dependency audit & signatures |            | ✅  |
| Dependency & licence review   |            | ✅  |
| Workflow linting (actionlint) |            | ✅  |

Every gate runs the same npm script locally and in CI, so a green `npm run check`
predicts a green pipeline.

## AI-assisted development

DevPulse ships a versioned [Claude Code](https://docs.claude.com/en/docs/claude-code/overview)
configuration, so every agent session starts with the same context, permissions, and
guard rails.

| Component   | Purpose                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` | Lean session entry point: stack, commands, workflow; imports the agent rules instead of duplicating them                   |
| Permissions | Verification runs freely; pushes, PRs and installs ask first; force pushes, pushes to `main`, and `--no-verify` are denied |
| Hooks       | Block edits to secrets and generated files; auto-format every file the agent writes                                        |
| Subagents   | `repo-explorer` (Haiku), `code-reviewer`, `adr-writer`, `docs-writer`, `ci-doctor` (Sonnet), each with minimal tools       |
| Skills      | `/issue` → `/start-work` → `/check` → `/commit` → `/pr`, plus `/adr`                                                       |

**Token efficiency by design:** cheap models for exploration, isolated subagent contexts
for wide searches, a single source of truth per rule, and hooks that remove formatting
round trips. Details in the [Claude Code guide](docs/ai/CLAUDE_CODE.md).

## Quick start

**Prerequisites:** Git and Node.js 24 LTS.

```sh
git clone https://github.com/BrahimNJ/DevPulse.git
cd DevPulse
npm ci          # installs pinned dependencies and activates the Git hooks
npm run check   # format, lint, Markdown, and type checks
```

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run check`     | Run every quality gate                       |
| `npm run lint:fix`  | Fix ESLint findings automatically            |
| `npm run format`    | Format the repository with Prettier          |
| `npm run typecheck` | Strict TypeScript check, JavaScript included |

The full command reference is in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Project structure

```text
DevPulse/
├── .claude/              Claude Code settings, hooks, subagents, skills
├── .github/              CI/CD workflows, Dependabot, issue forms, PR template, CODEOWNERS
├── .husky/               Git hooks
├── docs/
│   ├── ai/               Claude Code usage and token-efficiency guide
│   ├── decisions/        Architecture Decision Records
│   ├── ARCHITECTURE.md   Constraints and decision process
│   ├── DEVELOPMENT.md    Setup, commands, quality gates, CI/CD
│   └── GIT_WORKFLOW.md   From issue to release
├── AGENTS.md             Rules for AI coding agents
├── CLAUDE.md             Claude Code entry point
├── CONTRIBUTING.md       Branching, commits, pull requests, code quality
└── SECURITY.md           Vulnerability reporting
```

## Status and roadmap

| Phase                     | Scope                                                                    | Status  |
| ------------------------- | ------------------------------------------------------------------------ | ------- |
| 1. Engineering foundation | Standards, toolchain, CI/CD, release automation, AI agent configuration  | ✅ Done |
| 2. Product definition     | Problem statement and first component, recorded as ADRs                  | Planned |
| 3. First component        | Application framework, test runner, local deployment with Docker Compose | Planned |

Planned items are decided through the [ADR process](docs/ARCHITECTURE.md#decision-records)
before any code is written.

## Documentation

| Document                                         | Covers                                             |
| ------------------------------------------------ | -------------------------------------------------- |
| [CONTRIBUTING.md](CONTRIBUTING.md)               | Branch naming, Conventional Commits, PRs, testing  |
| [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)     | The full path from issue to release                |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)       | Prerequisites, commands, gates, pipelines, secrets |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)     | Architectural constraints and the decision process |
| [docs/ai/CLAUDE_CODE.md](docs/ai/CLAUDE_CODE.md) | Agents, skills, hooks, and token efficiency        |
| [SECURITY.md](SECURITY.md)                       | Private vulnerability reporting                    |

## Author

Built and maintained by [@BrahimNJ](https://github.com/BrahimNJ).
