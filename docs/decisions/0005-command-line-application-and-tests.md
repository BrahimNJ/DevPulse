# 0005. Ship a command-line application, run TypeScript natively, test with node:test

- Status: accepted
- Date: 2026-10-20

## Context

The first feature, branch statistics for a public GitHub repository (#12), is the
first application code. It requires answers to questions that
[ARCHITECTURE.md](../ARCHITECTURE.md) left open: where source code lives, how
TypeScript is executed, which test runner is used, and how GitHub is queried. The
architectural constraints favour the standard library, layered code, and tests that
need neither a network nor a clock.

## Decision

- **Interface:** a command-line application, `npm run devpulse -- <command>`. No web
  interface or server until one is specified.
- **Layout:** source in `src/`, split by responsibility, dependencies flowing one way:

  | Path            | Layer          | Depends on             |
  | --------------- | -------------- | ---------------------- |
  | `src/cli/`      | Interface      | `branches/`, `github/` |
  | `src/github/`   | Infrastructure | `branches/` (types)    |
  | `src/branches/` | Domain         | Nothing outside itself |

  Tests sit next to the code as `*.test.ts`. External effects (`fetch`, the current
  date, output streams, environment variables) are passed in, never imported, so that
  every layer is testable in isolation.

- **Execution:** Node.js 24 runs the `.ts` files directly through type stripping.
  There is no build step and no `dist/`. TypeScript enforces the restrictions this
  implies with `erasableSyntaxOnly` (no enums, namespaces or parameter properties) and
  imports name their `.ts` extension (`allowImportingTsExtensions`).
- **Tests:** the built-in `node:test` runner and `node:assert`, run by `npm test` and
  included in `npm run check` and CI.
- **GitHub access:** the native `fetch`. Branches and their last commits come from the
  GraphQL API, 100 per request. Protection status comes from the REST endpoint
  `GET /repos/{owner}/{repo}/branches?protected=true`, because the GraphQL
  `branchProtectionRule` field ignores rulesets and is hidden from non-admins. A token
  is required and read from `GITHUB_TOKEN`.
- **Arguments:** `parseArgs` from `node:util`.

No dependency is added.

## Alternatives considered

- **Do nothing.** The feature cannot be built without these answers.
- **Compile with `tsc` to `dist/`.** Allows all TypeScript syntax, but adds a build
  step and source maps for no benefit at this size.
- **`tsx` or `ts-node`.** Extra dependency for something Node.js 24 does natively.
- **Vitest or Jest.** Richer mocking and watch modes, but each adds a dependency tree
  that the built-in runner makes unnecessary for now.
- **REST only.** Works without a token, but needs one request per branch to read its
  last commit; the unauthenticated limit of 60 requests per hour caps a repository at
  about 55 branches.
- **Octokit.** Typed and convenient, but a dependency for two endpoints.
- **A CLI framework (Commander, yargs).** Unneeded for one command; `parseArgs` covers
  options and validation.

## Consequences

- Contributors run the tool with `GITHUB_TOKEN=$(gh auth token) npm run devpulse -- …`.
  Running it without a token fails with a message that explains how to set one.
- Non-erasable TypeScript syntax is rejected by the type checker, so code uses union
  types instead of enums and explicit fields instead of parameter properties.
- Publishing the CLI as an npm package, or adding a web interface, needs a new record.
- A large repository costs one GraphQL request per 100 branches, plus one REST request
  per 100 protected branches. Caching is out of scope until it is needed.
- Moving to another test runner later only changes the `test` script and imports.
