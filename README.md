# DevPulse

DevPulse is a software project under active bootstrapping. This repository currently
contains the engineering standards and documentation that govern development.
**No application functionality has been defined or implemented yet.**

## Status

| Area | State |
| --- | --- |
| Repository standards | Established |
| Documentation | Established |
| Technology stack | To be decided (see [Architecture](docs/ARCHITECTURE.md)) |
| Application source code | Not started |
| CI/CD pipelines | Not started (see [Development](docs/DEVELOPMENT.md)) |

The technology stack, module boundaries, and runtime architecture will be decided
through Architecture Decision Records before any application code is written.

## Repository Layout

```
DevPulse/
├── README.md            Project overview and entry point
├── CONTRIBUTING.md      Contributor workflow and standards
├── AGENTS.md            Rules for AI agents operating in this repository
├── docs/
│   ├── ARCHITECTURE.md  Architectural constraints and decision process
│   └── DEVELOPMENT.md   Local setup, quality gates, CI/CD role
├── backend/             Backend source (not started)
├── frontend/            Frontend source (not started)
├── infrastructure/      Infrastructure definitions (not started)
└── .github/             Issue forms, PR template, CI/CD workflows
```

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute: branching, commits, pull requests.
- [AGENTS.md](AGENTS.md) — mandatory rules for AI coding agents working on this repository.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architectural constraints and the decision process.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — environment expectations, quality gates, CI/CD role.

## Contributing

All contributions follow the workflow in [CONTRIBUTING.md](CONTRIBUTING.md). The short
version: branch from `main`, use Conventional Commits, open a pull request, and keep
`main` passing CI. Do not introduce dependencies without prior discussion.
