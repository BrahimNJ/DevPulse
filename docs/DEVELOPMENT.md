# Development Guide

Environment setup, commands, quality gates, CI/CD, and the Definition of Done. The
contribution workflow itself is in [CONTRIBUTING.md](../CONTRIBUTING.md); the Git
workflow end to end is in [GIT_WORKFLOW.md](GIT_WORKFLOW.md).

## Current State

Repository tooling, CI, release automation and the first feature, the `branches`
command, are in place. Node.js runs the TypeScript sources directly, so there is **no
build step** ([ADR 0005](decisions/0005-command-line-application-and-tests.md)).

## Prerequisites

| Tool    | Version               | Notes                                        |
| ------- | --------------------- | -------------------------------------------- |
| Git     | 2.40 or later         |                                              |
| Node.js | 24 LTS (see `.nvmrc`) | `engine-strict` rejects other major versions |
| npm     | 11 or later           | Bundled with Node.js 24                      |
| Docker  | Not required yet      | Required once local deployment is accepted   |

Tests need no secret. Running the CLI needs a GitHub token in `GITHUB_TOKEN`, because
the GraphQL API rejects anonymous requests. With the GitHub CLI installed:

```sh
GITHUB_TOKEN=$(gh auth token) npm run devpulse -- branches nodejs/node
```

Never commit a token. If a `.env` file is introduced, it stays untracked and a committed
`.env.example` carries placeholder values only.

## Setup

```sh
git clone https://github.com/BrahimNJ/DevPulse.git
cd DevPulse
npm ci            # installs pinned dependencies and activates the Git hooks
npm run check     # every gate should pass on a fresh clone
```

## Commands

| Command                | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm run check`        | Runs `format:check`, `lint`, `lint:md`, `typecheck` and `test` |
| `npm run format`       | Formats all files with Prettier                                |
| `npm run format:check` | Fails if any file is not formatted                             |
| `npm run lint`         | ESLint, type-aware, zero warnings allowed                      |
| `npm run lint:fix`     | ESLint with automatic fixes                                    |
| `npm run lint:md`      | markdownlint on every Markdown file                            |
| `npm run typecheck`    | TypeScript in strict mode, JavaScript included via `checkJs`   |
| `npm test`             | Unit tests with `node:test`, matching `src/**/*.test.ts`       |
| `npm run devpulse`     | Runs the CLI, for example `npm run devpulse -- --help`         |
| `npm run lint:commits` | commitlint on every commit between `origin/main` and `HEAD`    |

## Tooling

| Concern         | Tool                                              | Configuration                       |
| --------------- | ------------------------------------------------- | ----------------------------------- |
| Editor baseline | EditorConfig (LF, UTF-8, 2 spaces, final newline) | `.editorconfig`, `.gitattributes`   |
| Formatting      | Prettier                                          | `.prettierrc.json`                  |
| Linting         | ESLint with `typescript-eslint` strict rules      | `eslint.config.mjs`                 |
| Types           | TypeScript, strict                                | `tsconfig.json`                     |
| Documentation   | markdownlint                                      | `.markdownlint-cli2.jsonc`          |
| Commit messages | commitlint, Conventional Commits                  | `commitlint.config.mjs`             |
| Git hooks       | husky and lint-staged                             | `.husky/`, `lint-staged.config.mjs` |
| Tests           | `node:test` and `node:assert`, built into Node.js | `test` script in `package.json`     |

### Git hooks

| Hook         | Runs                                                           |
| ------------ | -------------------------------------------------------------- |
| `pre-commit` | lint-staged: ESLint, markdownlint and Prettier on staged files |
| `commit-msg` | commitlint                                                     |
| `pre-push`   | `npm run typecheck`                                            |

Hooks are never skipped with `--no-verify`. If a hook is wrong, fix it in a pull request.

### Editor

`.vscode/extensions.json` recommends the ESLint, Prettier, EditorConfig and
markdownlint extensions; `.vscode/settings.json` formats on save with Prettier.

## Quality Gates

A change is complete when all of the following hold.

### Before pushing

- The change is limited to one concern and the branch follows the naming convention.
- Commits follow Conventional Commits and explain why.
- `npm run check` passes.
- Tests pass, and a bug fix includes a test that failed before the fix.
- Documentation matches the behaviour.
- No secrets, `.env` files, build output, or editor artefacts are staged.

### In CI, on every pull request

- Format, lint, Markdown and type checks and unit tests pass.
- Every commit message and the pull request title are valid Conventional Commits.
- No secret is present in the history (gitleaks).
- No runtime dependency with a known advisory is introduced; npm signatures verify.
- Workflows pass actionlint.

### At merge

- At least one approving review.
- All review comments resolved.
- `ci-success` and `pr-title` are green.

## CI/CD

CI makes the quality gates objective, so that [CONTRIBUTING.md](../CONTRIBUTING.md) is
enforced without relying on reviewer memory.

| Workflow           | Trigger                    | Jobs                                                                                     |
| ------------------ | -------------------------- | ---------------------------------------------------------------------------------------- |
| `ci.yml`           | Pull request, push to main | format, lint, Markdown, types, tests, commits, audit, actionlint, gitleaks, `ci-success` |
| `pull-request.yml` | Pull request               | `pr-title`, `dependency-review`                                                          |
| `release.yml`      | Push to main               | `release-please`                                                                         |
| Dependabot         | Weekly, Monday             | Grouped updates for npm and GitHub Actions                                               |

Pipeline rules:

- Every action is pinned to a full commit SHA, and images to a digest.
- The default token is read-only; jobs request write scopes individually.
- `ci-success` is the single required status check; it fails if any job fails.
- CI runs the same npm scripts as local development.

### Required secrets

| Secret                 | Required | Purpose                                            |
| ---------------------- | -------- | -------------------------------------------------- |
| `RELEASE_PLEASE_TOKEN` | Optional | Lets CI run on release pull requests; see ADR 0004 |

`GITHUB_TOKEN` is provided automatically. No other secret is used.

### Releases

Defined in [ADR 0004](decisions/0004-release-and-local-deployment.md). release-please
keeps a release pull request open on `main`. Merging it bumps the version, updates
`CHANGELOG.md`, and creates the `vX.Y.Z` tag and GitHub release. Neither file is
edited by hand.

### Local deployment (proposed)

When the first runnable component is accepted, `docker compose up --build` will start
it locally from the repository root, with configuration from `.env`. Nothing is
deployed yet; see ADR 0004.

## Definition of Done

A piece of work is done when it is merged into `main` and:

- The problem it solves is described in the linked issue and closed by the pull request.
- All quality gates above are satisfied.
- Documentation and architectural decision records are updated where required.
- Any follow-up work is filed as a new issue rather than left undocumented.
