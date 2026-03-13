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
- explicit retry policy controls (`maxAttempts`) and compatible transport filtering (`compatibleTransports`)
- `agents`, `transport_adapters`, `endpoints`, `conversation_bindings`, `deliveries`, `delivery_attempts`, and `dead_letters` tables
- lifecycle hooks for `session_start`, `session_end`, `message_sent`, `subagent_spawned`, `subagent_ended`, and `subagent_delivery_target`
- maintenance service for endpoint aging, binding expiry cleanup, and delivery retention cleanup

Not implemented yet:
- spawn fallback when no live endpoint exists
- response-level correlation / ack tracking
- multi-host delivery
- operator command registration on current OpenClaw command API

That gap is intentional. v1 does real endpoint resolution and delivery journaling, but it does not pretend it can spawn or correlate replies when the runtime does not support it cleanly.

## Install

Use a linked local dev install for the first real activation test.

```bash
git clone <repo-url> ~/dev/mycelium
cd ~/dev/mycelium
npm install
npm run build
openclaw plugins install --link ~/dev/mycelium
openclaw gateway restart
openclaw plugins doctor
```

Why this flow first:
- Mycelium ships the OpenClaw plugin metadata expected by the current installer
- `better-sqlite3` is a native module
- OpenClaw install flows may use `--ignore-scripts` for safety, which can leave native bindings unbuilt in copied/published installs
- a linked local repo with a working local `node_modules` is the lowest-risk first activation path

Recommended trust config for a cleaner local setup:

```json
{
  "plugins": {
    "allow": ["mycelium"]
  }
}
```

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

After the initial linked install, the local dev loop is:

```bash
cd ~/dev/mycelium
npm run build
openclaw gateway restart
openclaw plugins doctor
```

## Current caveats

- The old `/mycelium status` command was removed from plugin registration for now because its previous contract does not match current OpenClaw command registration.
- If `better-sqlite3` native bindings are missing, rebuild dependencies in the repo before retrying the linked install.
- The safest first validation is plugin load + tool registration + hook/service startup, not published-package install.

## Public tool contract

```ts
mycelium_send({
  to: "krash",
  message: "What broke in CI?",
  taskId: "OPS-12",
  priority: "high",
  spawnIfNeeded: false,
  maxAttempts: 2,
  compatibleTransports: ["openclaw-session"],
});
```

Arguments:
- `to` — stable target agent id
- `message` — message body passed to `runtime.subagent.run()`
- `taskId` — optional task-scoped binding hint
- `priority` — `low | normal | high`
- `spawnIfNeeded` — keeps the request honest; if no live endpoint exists, v1 dead-letters instead of faking spawn
- `maxAttempts` — cap retries across resolved healthy endpoints; defaults to `3`
- `compatibleTransports` — optional allowlist of transport adapter ids to consider

Send flow:
1. create a delivery record
2. check for a task-scoped conversation binding
3. resolve healthy endpoints, filtered by compatible transport if requested
4. dispatch through `runtime.subagent.run()`
5. retry the next healthy compatible endpoint if a transport attempt fails and retry budget remains
6. record attempts/results and update endpoint health
7. dead-letter if no compatible endpoint exists or the retry budget is exhausted

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
