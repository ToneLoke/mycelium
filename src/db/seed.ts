import type { MyceliumDb } from "./connection.js";

const DEFAULT_AGENTS = [
  ["main", "Rooty", "orchestrator"],
  ["tai", "Tai", "research"],
  ["skipper", "Skipper", "engineering"],
  ["krash", "Krash", "qa"],
  ["marshal", "Marshal", "product"],
  ["bob", "Bob", "design"],
] as const;

const DEFAULT_TRANSPORTS = [
  ["openclaw-session", "endpoint", 1, 0],
  ["gateway-send", "transport", 0, 1],
] as const;

export function seedDefaults(db: MyceliumDb) {
  const insertAgent = db.prepare(`
    INSERT INTO agents (agent_id, display_name, role)
    VALUES (?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET
      display_name = excluded.display_name,
      role = excluded.role,
      updated_at = datetime('now')
  `);

  const insertTransport = db.prepare(`
    INSERT INTO transport_adapters (transport_id, ack_level, supports_resume, supports_spawn)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(transport_id) DO UPDATE SET
      ack_level = excluded.ack_level,
      supports_resume = excluded.supports_resume,
      supports_spawn = excluded.supports_spawn
  `);

  for (const row of DEFAULT_AGENTS) insertAgent.run(...row);
  for (const row of DEFAULT_TRANSPORTS) insertTransport.run(...row);
}
