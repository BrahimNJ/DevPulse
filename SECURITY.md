# Security Policy

## Supported versions

DevPulse has no released application yet. Security fixes apply to the `main` branch.

## Reporting a vulnerability

Do not open a public issue, pull request, or discussion for a vulnerability.

Report it privately through
[GitHub security advisories](https://github.com/BrahimNJ/DevPulse/security/advisories/new).
Include the affected file or commit, reproduction steps, and the impact you expect.

You can expect an acknowledgement within five working days. The report stays private
until a fix is available, and the reporter is credited unless they prefer otherwise.

## Committed secrets

If a secret is committed, even on a branch that was never merged:

1. Revoke or rotate it immediately; removing it from history does not make it safe.
2. Report it privately as above.

## Safeguards in this repository

- gitleaks scans the full history on every pull request and push to `main`.
- Dependency review blocks pull requests that add vulnerable runtime dependencies.
- Dependabot proposes updates for npm packages and GitHub Actions weekly.
- Workflows use pinned actions and a read-only default token.
