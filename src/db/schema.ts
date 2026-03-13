export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  display_name TEXT,
  role TEXT,
  labels TEXT,
  default_transport TEXT DEFAULT 'openclaw-session',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transport_adapters (
  transport_id TEXT PRIMARY KEY,
  ack_level TEXT NOT NULL DEFAULT 'transport',
  supports_resume INTEGER NOT NULL DEFAULT 0,
  supports_spawn INTEGER NOT NULL DEFAULT 0,
  config TEXT
);

CREATE TABLE IF NOT EXISTS endpoints (
  endpoint_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  host_id TEXT NOT NULL DEFAULT 'local',
  transport_id TEXT NOT NULL REFERENCES transport_adapters(transport_id),
  address TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'healthy',
  ack_level TEXT,
  spawned_at TEXT,
  last_seen_at TEXT,
  last_ack_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
