# Mycelium

<div align="center">

Session routing for multi-agent OpenClaw systems.

Stable agent-to-agent delivery by name, backed by SQLite endpoint tracking and delivery journaling.

[![OpenClaw Plugin](https://img.shields.io/badge/OpenClaw-plugin-6f42c1)](#install)
[![TypeScript](https://img.shields.io/badge/TypeScript-ESM-3178c6)](#development)
[![SQLite](https://img.shields.io/badge/SQLite-backed-003b57)](#how-it-works)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](#license)

</div>

Mycelium is an OpenClaw plugin for routing messages between agents by stable agent ID instead of ephemeral session keys.

It keeps a local registry of live endpoints, records delivery attempts, preserves task-scoped conversation bindings, and cleans up stale state in the background.

It is intentionally narrow in v1: single-host routing, honest failure modes, and no fake spawn/correlation behavior when the runtime cannot support it cleanly.

## Why this exists

Multi-agent systems get messy fast when agents cannot reliably find each other.

Without a stable routing layer, you end up depending on:
- short-lived session identifiers
- ad hoc handoff logic
- brittle assumptions about which agent process is still alive
- poor visibility into what was attempted, retried, or dropped

Mycelium gives OpenClaw a local routing substrate for that problem.

## What it does

- Resolves target agents by stable name
- Tracks live delivery endpoints in SQLite
- Learns session/subagent lifecycle changes from OpenClaw hooks
- Stores delivery history, attempt records, and dead letters
- Supports task-scoped conversation bindings for continuity
- Retries across healthy compatible endpoints
- Runs background maintenance for stale endpoints and expired bindings

## v1 status

Mycelium is a real plugin with a real tool contract, database schema, lifecycle hooks, and maintenance service.

What is implemented today:
- `mycelium_send` tool with SQLite-backed endpoint resolution
- healthy-endpoint retry with `maxAttempts`
- transport filtering with `compatibleTransports`
- `agents`, `transport_adapters`, `endpoints`, `conversation_bindings`, `deliveries`, `delivery_attempts`, and `dead_letters` tables
- lifecycle hooks for `session_start`, `session_end`, `message_sent`, `subagent_spawned`, `subagent_ended`, and `subagent_delivery_target`
- maintenance service for endpoint aging, binding expiry cleanup, and delivery retention cleanup

What is not implemented yet:
- spawn fallback when no live endpoint exists
- response-level correlation or ack tracking
- multi-host delivery
- operator command registration on the current OpenClaw command API

That boundary is deliberate. If there is no live compatible endpoint, v1 records the failure honestly instead of pretending it can recover by magic.

## Install

Use a linked local install for the first real activation test.

```bash
git clone <repo-url> ~/dev/mycelium
cd ~/dev/mycelium
npm install
npm run build
openclaw plugins install --link ~/dev/mycelium
openclaw gateway restart
openclaw plugins doctor
```

Why this is the safest first path:
- Mycelium ships OpenClaw plugin metadata directly from the repo
- `better-sqlite3` is a native module
- some install flows may use `--ignore-scripts`, which can leave native bindings unbuilt in copied or published installs
- a linked repo with known-good local `node_modules` is the lowest-risk activation path right now

Recommended trust config:

```json
{
  "plugins": {
    "allow": ["mycelium"]
  }
}
```

## Quick start

1. Install and link the plugin locally
2. Build it once with `npm run build`
3. Restart the OpenClaw gateway
4. Confirm plugin load with `openclaw plugins doctor`
5. Call `mycelium_send` from an agent session

Example:

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

## Tool contract

Arguments:
- `to` — stable target agent ID
- `message` — message body passed to `runtime.subagent.run()`
- `taskId` — optional task-scoped binding hint
- `priority` — `low | normal | high`
- `spawnIfNeeded` — currently keeps the contract honest; if no live endpoint exists, v1 dead-letters instead of spawning
- `maxAttempts` — retry cap across resolved healthy endpoints; defaults to `3`
- `compatibleTransports` — optional allowlist of transport adapter IDs to consider

## How it works

High-level send flow:

1. Create a delivery record
2. Check for a task-scoped conversation binding
3. Resolve healthy endpoints, optionally filtered by transport
4. Dispatch through `runtime.subagent.run()`
5. Retry the next healthy compatible endpoint if an attempt fails and budget remains
6. Record attempt results and update endpoint health
7. Dead-letter if no compatible endpoint exists or retries are exhausted

Runtime state is stored locally at:

```text
~/.openclaw/state/mycelium.db
```

## Development

Requirements:
- Node.js
- npm
- an OpenClaw environment for end-to-end validation

Local commands:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Typical dev loop after the first linked install:

```bash
cd ~/dev/mycelium
npm run build
openclaw gateway restart
openclaw plugins doctor
```

## Current limitations

- Single-host v1 only
- No automatic spawn fallback when the target agent has no live endpoint
- No response correlation / ack layer yet
- No operator command wired up on the current OpenClaw command API
- First-time activation is most reliable through a linked local install
- If `better-sqlite3` native bindings are missing, rebuild dependencies in the repo before retrying

## Roadmap

Near-term obvious next steps:
- Add safe spawn fallback once runtime support is clean enough to rely on
- Add response correlation and acknowledgment tracking
- Add better operational visibility around routing health and dead letters
- Revisit command registration when the current OpenClaw command contract is stable
- Explore multi-host routing after the single-host model is solid

## Architecture shape

- Plugin-first
- SQLite-backed
- Event-driven
- Single-host by design in v1
- Honest about unsupported runtime paths

## Links

- Plugin metadata: [`openclaw.plugin.json`](./openclaw.plugin.json)
- Source: [`src/index.ts`](./src/index.ts)
- Tests: [`test/`](./test)
- Package metadata: [`package.json`](./package.json)

## License

Apache-2.0
