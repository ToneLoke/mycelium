# Contributing

Thanks for contributing to Mycelium.

This project is intentionally small-scope right now. Please optimize for correctness, clarity, and honest behavior over speculative features.

## Before opening a PR

- Read the current README and stay within the documented v1 boundaries.
- Prefer focused changes over broad rewrites.
- Keep docs aligned with the actual implementation.
- Avoid adding fake fallback behavior that the runtime cannot support reliably.

## Local setup

Clone the repo wherever you want and work from that directory:

```bash
git clone https://github.com/ToneLoke/mycelium.git
cd mycelium
npm install
```

Run the standard checks before you open a PR:

```bash
npm run typecheck
npm test
npm run build
```

## Development notes

- The plugin is currently designed for single-host routing.
- SQLite state is stored at `~/.openclaw/state/mycelium.db` when the plugin runs inside OpenClaw.
- `spawnIfNeeded` is part of the tool contract, but v1 does not actually spawn missing targets yet.
- If `better-sqlite3` native bindings are missing, rebuild dependencies locally before retrying.

## Pull request guidance

Good PRs here are:
- small
- tested
- truthful in docs
- explicit about limitations

Please include:
- what changed
- why it changed
- any behavior or docs impact

## What not to do right now

Please do not add these as “paper features” without real runtime support:
- automatic spawn fallback
- fake delivery correlation/ack behavior
- multi-host routing claims
- command registration that depends on outdated OpenClaw command contracts
