# 0002. Adopt TypeScript, Node.js and npm

- Status: accepted
- Date: 2026-10-19

## Context

Quality gates (formatting, linting, commit validation) must be automated before any
application code is written, so that the first line of code is already held to the
standard. Those tools need a runtime, and the language of future code determines how
lint rules are configured.

## Decision

- **Language:** TypeScript in strict mode for all future source code.
- **Runtime:** Node.js 24 LTS, pinned in `.nvmrc` and in `engines` in `package.json`.
- **Package manager:** npm, pinned through `packageManager`. Dependencies are
  installed with `npm ci` from the committed `package-lock.json`.
- **Repository tooling:** Prettier (formatting), ESLint with `typescript-eslint`
  (linting), markdownlint (documentation), commitlint (commit messages), husky and
  lint-staged (local Git hooks). All are development dependencies with exact versions.

The application framework, data stores and deployment target remain undecided.

## Alternatives considered

- **Keep the stack undecided.** No gate could run, so standards would remain manual.
- **pnpm.** Faster and stricter, but requires an extra tool on every machine; npm
  ships with Node and is sufficient for a single package.
- **Biome instead of ESLint and Prettier.** One fast tool, but a smaller rule
  ecosystem and weaker type-aware linting than `typescript-eslint`.
- **TypeScript 7.** Not yet supported by `typescript-eslint`; TypeScript 6 is used
  until it is.

## Consequences

- Contributors need Node.js 24 installed. `npm ci` provides everything else.
- `npm run check` runs every gate locally, and CI runs the same commands.
- Moving to another language later requires a superseding record and a new lint setup.
- **Advisory policy.** Runtime dependencies must have no known advisory of moderate
  severity or higher; CI enforces this with `npm audit --omit=dev` and dependency
  review. A development-only advisory without a compatible fix may be accepted when the
  affected package receives no untrusted input. It is listed below, and Dependabot
  proposes the fix once one exists.

| Advisory            | Package (via)              | Reason accepted                                   |
| ------------------- | -------------------------- | ------------------------------------------------- |
| GHSA-vfj7-8cjw-p6xm | braces (markdownlint-cli2) | No patched release; only parses our own globs     |
| GHSA-238p-pmpm-9mq7 | katex (markdownlint)       | Fix outside the accepted range; math not rendered |
