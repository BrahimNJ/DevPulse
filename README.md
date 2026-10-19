# DevPulse

[![CI](https://github.com/BrahimNJ/DevPulse/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/BrahimNJ/DevPulse/actions/workflows/ci.yml)

DevPulse is a software project in its bootstrapping phase. The repository contains the
engineering standards, quality tooling, CI/CD, and AI agent configuration that govern
development. **No application functionality has been defined or implemented yet.**

## Status

| Area                       | State                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| Standards and workflow     | Established                                                                                        |
| Language and runtime       | TypeScript, Node.js 24 LTS, npm ([ADR 0002](docs/decisions/0002-adopt-typescript-node-and-npm.md)) |
| Lint, format, commit gates | Enforced locally and in CI                                                                         |
| CI/CD                      | CI and release automation active; local deployment proposed                                        |
| Claude Code configuration  | Established ([guide](docs/ai/CLAUDE_CODE.md))                                                      |
| Application source code    | Not started; no product definition yet                                                             |

## Quick start

```sh
npm ci
npm run check
```

Prerequisites and every command are listed in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Repository layout

```text
DevPulse/
├── CLAUDE.md                Claude Code entry point (imports AGENTS.md)
├── AGENTS.md                Rules for AI coding agents
├── CONTRIBUTING.md          Branching, commits, pull requests, testing, code quality
├── SECURITY.md              Vulnerability reporting
├── docs/
│   ├── ARCHITECTURE.md      Architectural constraints and decision process
│   ├── DEVELOPMENT.md       Setup, commands, quality gates, CI/CD
│   ├── GIT_WORKFLOW.md      Issue to release, end to end
│   ├── ai/CLAUDE_CODE.md    Using Claude Code agents, skills and hooks
│   └── decisions/           Architecture decision records
├── .claude/                 Shared Claude Code settings, hooks, subagents, skills
├── .github/                 Workflows, Dependabot, issue forms, PR template, CODEOWNERS
└── .husky/                  Git hooks
```

Source directories are created when the first component that needs them is accepted,
not in advance.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), then follow
[docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md). AI agents also follow
[AGENTS.md](AGENTS.md). Do not introduce dependencies without prior discussion.
