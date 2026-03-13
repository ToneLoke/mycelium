# Mycelium

Session routing for multi-agent OpenClaw systems.

Mycelium is an OpenClaw plugin that lets agents send messages to each other by stable name instead of hunting for ephemeral session keys.

## Why

Multi-agent systems break down when agents can't reliably find each other.

Mycelium provides:
- name-based agent routing
- SQLite-backed endpoint registry
- event-driven session tracking via OpenClaw hooks
- delivery journal and retry logic
- background cleanup for stale endpoints

## What problem it solves

Without Mycelium, agent-to-agent communication depends on ephemeral session keys or unreliable fire-and-forget messaging. That leads to dropped work, stale status, and humans acting as the relay layer.

Mycelium turns that into:
- `mycelium_send("krash", "What's the E2E status?")`
- resolve the best live endpoint
- deliver or retry
- spawn if needed
- keep continuity by task or thread

## Planned install

```bash
openclaw plugin install @openclaw/mycelium
```

## Planned capabilities

- Native `mycelium_send` agent tool
- Plugin hook integration for session lifecycle tracking
- SQLite registry for endpoints, bindings, and deliveries
- Background maintenance service for aging and cleanup
- Human status command for reachability and health

## Status

Design complete. Implementation next.

## Architecture summary

- **Plugin-first**
- **SQLite-backed**
- **Event-driven**
- **Single-host v1**
- **Multi-host later**

## Vision

Mycelium becomes the session routing layer for serious OpenClaw multi-agent deployments.
