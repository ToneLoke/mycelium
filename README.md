# Mycelium

Session routing for multi-agent OpenClaw systems.

Mycelium is an OpenClaw plugin that lets agents send messages to each other by stable name instead of hunting for ephemeral session keys.

## Why

Multi-agent systems break down when agents can't reliably find each other.

Mycelium provides:
- name-based agent routing
- SQLite-backed endpoint registry
- event-driven session tracking via OpenClaw hooks
- delivery journal and dead-letter tracking
- conversation bindings for task-scoped continuity
- background cleanup for stale endpoints and expired bindings

## Current v1 shape

Implemented now:
- `mycelium_send` tool backed by SQLite endpoint resolution with healthy-endpoint retry
- `agents`, `transport_adapters`, `endpoints`, `conversation_bindings`, `deliveries`, `delivery_attempts`, and `dead_letters` tables
- lifecycle hooks for `session_start`, `session_end`, `message_sent`, `subagent_spawned`, `subagent_ended`, and `subagent_delivery_target`
- `/mycelium status` command when the host runtime exposes `registerCommand()`
- maintenance service for endpoint aging, binding expiry cleanup, and delivery retention cleanup

Not implemented yet:
- spawn fallback when no live endpoint exists
- response-level correlation / ack tracking
- multi-host delivery

That gap is intentional. v1 does real endpoint resolution and delivery journaling, but it does not pretend it can spawn or correlate replies when the runtime does not support it cleanly.

## Install

```bash
npm install @openclaw/mycelium
openclaw plugin install @openclaw/mycelium
```

## Development

```bash
npm install
npm run typecheck
npm run build
```

## Example

```ts
mycelium_send({
  to: "krash",
  message: "What broke in CI?",
  taskId: "OPS-12",
  priority: "high",
  spawnIfNeeded: false,
});
```

Send flow:
1. create a delivery record
2. check for a task-scoped conversation binding
3. resolve the best healthy endpoint from SQLite
4. dispatch through `runtime.subagent.run()`
5. retry the next healthy endpoint if one transport attempt fails
6. record attempts/results and update endpoint health
7. dead-letter if no endpoint exists or all healthy endpoints fail

## Architecture summary

- **Plugin-first**
- **SQLite-backed**
- **Event-driven**
- **Single-host v1**
- **Honest about unsupported runtime paths**

## Local state

Mycelium stores its SQLite database at:

```text
~/.openclaw/state/mycelium.db
```

## License

Apache-2.0
