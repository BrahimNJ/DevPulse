# 0004. Automate releases and deploy locally with Docker Compose

- Status: release automation **accepted**; local deployment **proposed**, to be
  superseded by [0007](0007-public-deployment-on-cloud-run.md) once it is accepted
- Date: 2026-10-19

## Context

DevPulse needs a delivery process before it has something to deliver, so that the
first application change is versioned and traceable from day one. Hosting is
undecided; for now the only deployment target is a developer machine.

## Decision

### Release automation (accepted)

[release-please](https://github.com/googleapis/release-please) runs on every push to
`main`. It reads Conventional Commit messages since the last release and maintains a
release pull request that bumps the version in `package.json`, updates `CHANGELOG.md`
and, once merged, creates a `vX.Y.Z` tag and a GitHub release.

- Versions follow Semantic Versioning. Before `1.0.0`, `feat` bumps the minor version
  and breaking changes bump the minor version too.
- A release is cut only by merging the release pull request; nothing is published
  automatically.
- `feat`, `fix`, `perf`, `revert` and breaking changes appear in the changelog; other
  types appear only when they affect users.

### Local deployment (proposed)

When the first runnable component is accepted, it ships with a `Dockerfile` and a
root `compose.yaml` so that `docker compose up --build` starts the full system
locally from a released tag. Configuration comes from an untracked `.env`, with a
committed `.env.example`. No container file is added before a component exists.

## Alternatives considered

- **semantic-release.** Publishes on every merge without a review step; release-please
  keeps a human approval in the loop through its release pull request.
- **Manual tagging.** Error-prone and leaves the changelog to memory.
- **Scripts run directly on the host for deployment.** Results depend on each
  machine; containers give the reproducibility required by ARCHITECTURE.md.

## Consequences

- Commit and pull request titles must be valid Conventional Commits; CI enforces both.
- Pull requests opened with the default `GITHUB_TOKEN` do not trigger other workflows.
  To run CI on release pull requests, set a `RELEASE_PLEASE_TOKEN` secret (fine-grained
  token with contents and pull request write access); the workflow falls back to
  `GITHUB_TOKEN` otherwise.
- Docker becomes a development prerequisite once the local deployment is accepted.
