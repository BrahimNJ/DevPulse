# 0003. Adopt a shared Claude Code configuration

- Status: accepted
- Date: 2026-10-19

## Context

Claude Code is the primary AI coding agent for DevPulse. Without shared configuration,
each session rediscovers the repository, asks for the same permissions, and may apply
the standards inconsistently. Every token spent on rediscovery or on repeated rules is
context not available for the task.

## Decision

The repository commits a shared Claude Code configuration:

- `CLAUDE.md`: a short entry point loaded every session; it imports `AGENTS.md` and
  links to the rest instead of copying it.
- `.claude/settings.json`: team permissions (allow, ask, deny) and hooks.
- `.claude/hooks/`: Node scripts that block edits to secrets and generated files, and
  format every edited file.
- `.claude/agents/`: subagents with minimal tools and an explicit model.
- `.claude/skills/`: the issue → branch → commit → pull request workflow as commands.

Personal overrides live in `.claude/settings.local.json` and `CLAUDE.local.md`, which
are ignored by Git. Usage is documented in [docs/ai/CLAUDE_CODE.md](../ai/CLAUDE_CODE.md).

## Alternatives considered

- **Do nothing.** Each contributor configures their own agent; behaviour diverges.
- **Rules in `CLAUDE.md` only.** Instructions are advisory; hooks and permission rules
  are enforced by the harness and cannot be forgotten.
- **Tool-agnostic configuration only (`AGENTS.md`).** Kept as the shared rule set, but
  it cannot express permissions, hooks, or subagents.

## Consequences

- Agent behaviour changes through reviewed pull requests, like code.
- Hooks require Node.js, already a prerequisite per ADR 0002.
- Configuration must follow Claude Code releases; Dependabot does not track it, so it
  is reviewed when Claude Code changes its settings format.
