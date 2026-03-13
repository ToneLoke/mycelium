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
CREATE INDEX IF NOT EXISTS idx_endpoints_agent ON endpoints(agent_id);
CREATE INDEX IF NOT EXISTS idx_endpoints_state ON endpoints(state);
CREATE INDEX IF NOT EXISTS idx_endpoints_agent_state_seen ON endpoints(agent_id, state, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS conversation_bindings (
  binding_id TEXT PRIMARY KEY,
  source_agent_id TEXT,
  target_agent_id TEXT NOT NULL,
  scope_task_id TEXT,
  scope_thread_id TEXT,
  scope_channel_id TEXT,
  preferred_endpoint_id TEXT REFERENCES endpoints(endpoint_id),
  ttl_seconds INTEGER,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bindings_target ON conversation_bindings(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_bindings_scope_task ON conversation_bindings(scope_task_id);
CREATE INDEX IF NOT EXISTS idx_bindings_expires_at ON conversation_bindings(expires_at);

CREATE TABLE IF NOT EXISTS deliveries (
  delivery_id TEXT PRIMARY KEY,
  correlation_id TEXT,
  from_agent_id TEXT,
  to_agent_id TEXT NOT NULL,
  endpoint_id TEXT REFERENCES endpoints(endpoint_id),
  message_body TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'queued',
  ack_level TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  priority TEXT NOT NULL DEFAULT 'normal',
  sensitivity TEXT NOT NULL DEFAULT 'internal',
  scope_task_id TEXT,
  dedupe_key TEXT,
  hop_count INTEGER NOT NULL DEFAULT 0,
  max_hops INTEGER NOT NULL DEFAULT 5,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deliveries_state ON deliveries(state);
CREATE INDEX IF NOT EXISTS idx_deliveries_to ON deliveries(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_dedupe ON deliveries(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_deliveries_created ON deliveries(created_at);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  attempt_id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES deliveries(delivery_id) ON DELETE CASCADE,
  endpoint_id TEXT REFERENCES endpoints(endpoint_id),
  transport_id TEXT,
  attempt_number INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  error TEXT,
  latency_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_delivery ON delivery_attempts(delivery_id);

CREATE TABLE IF NOT EXISTS dead_letters (
  dead_letter_id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES deliveries(delivery_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  original_message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dead_letters_delivery ON dead_letters(delivery_id);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  description TEXT
);
`;
