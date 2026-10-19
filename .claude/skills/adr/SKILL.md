---
name: adr
description: Record an architecture decision in docs/decisions/ using the repository format.
argument-hint: <decision to record>
---

Record this decision: $ARGUMENTS

Delegate to the `adr-writer` subagent with the decision, the context from this
conversation, and the alternatives discussed. Then link the new record from the
relevant section of `docs/ARCHITECTURE.md` if it changes a constraint or answers an
open question, and show the user the result.
