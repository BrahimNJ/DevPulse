# 0006. Add a local web dashboard with React and Vite

- Status: accepted
- Date: 2026-10-20

## Context

ADR 0005 limited DevPulse to a command-line interface until a web interface was
specified. Issue #15 specifies one: a home page that shows the branch report of a
repository visually, run locally. The GitHub GraphQL API requires a token, which must
not be exposed to a browser.

## Decision

- **Interface:** a React 19 single-page application in `src/web/`, served by Vite 8.
  Styles are plain CSS with light and dark themes; no component or CSS framework.
- **API:** a `node:http` server in `src/server/` exposes
  `GET /api/branches?repo=<owner>/<repo>&staleDays=<n>`. It reuses the existing
  GitHub client and report, and is the only component that holds `GITHUB_TOKEN`.
- **One process:** `npm run web` starts the server, which mounts Vite in middleware
  mode for every path except the API. Vite serves the interface with hot reload.
- **Local only:** the server listens on `127.0.0.1`. Hosting, a production build and
  authentication are out of scope.
- **Shared contract:** `src/server/contract.ts` derives the response type from the
  domain report type, with dates as ISO strings. The interface imports it as a type
  only, so the API and the interface cannot drift.
- **Shared validation:** repository and threshold parsing moves to
  `src/branches/input.ts`, used by both the CLI and the API.
- **Dependencies:** `react` and `react-dom` at runtime; `vite`,
  `@vitejs/plugin-react`, `@types/react` and `@types/react-dom` for development, all
  pinned to exact versions.

This record extends ADR 0005, whose layout, runtime and test decisions still apply:
`src/web` and `src/server` are interface layers that depend on `branches/` and
`github/`, never the reverse.

## Alternatives considered

- **Do nothing.** The report stays terminal-only and cannot be shown visually.
- **`node:http` with plain HTML and JavaScript.** No dependency, but the interface
  would become hard to maintain as more analyses and views are added.
- **Next.js.** Server rendering and routing are not needed for one local page, and it
  would replace the existing server and runtime choices.
- **Calling GitHub from the browser.** Simpler, but exposes the token to the page.
- **Separate API and Vite processes.** Requires a proxy and a tool to run both;
  middleware mode keeps one command and one port.

## Consequences

- `npm run web` needs `GITHUB_TOKEN`, like the CLI, and stops with a clear message
  without it.
- TypeScript now includes the DOM library and JSX, so the type checker covers the
  interface with the same strict settings as the rest of the code.
- React components are verified by type checking, linting and a manual check of the
  running page; there are no component tests yet. Adding them requires a DOM test
  environment and a new decision.
- Large repositories are slow: GitHub serves 100 branches per request, so a repository
  with thousands of branches takes minutes. Caching or streaming is a separate change.
- Publishing the dashboard beyond a local machine needs a new record covering the
  build, hosting and how the token is protected.
