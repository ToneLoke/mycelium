# Roadmap

Mycelium is intentionally narrow in v1: reliable single-host agent routing, SQLite-backed state, and honest failure behavior.

## Current v1 baseline

Implemented today:
- stable agent-ID routing via `mycelium_send`
- SQLite-backed endpoint and delivery state
- healthy-endpoint retry with attempt limits
- transport compatibility filtering
- task-scoped conversation bindings
- lifecycle-hook updates from OpenClaw session/subagent events
- background maintenance for stale endpoints, expired bindings, and delivery retention cleanup

Not implemented yet:
- spawn fallback when no live compatible endpoint exists
- response correlation / ack tracking
- multi-host delivery
- operator command registration on the current OpenClaw command API

## Near-term priorities

1. Safe spawn fallback
   - only if the runtime contract is clean and failure handling is explicit

2. Response correlation / ack tracking
   - enough to answer “did this get delivered and replied to?” without inventing semantics

3. Better operational visibility
   - delivery inspection, dead-letter visibility, and routing-health diagnostics

4. Command/API ergonomics
   - revisit operator commands when the underlying OpenClaw command contract is stable

5. Multi-host design exploration
   - only after the single-host model is solid and observable
