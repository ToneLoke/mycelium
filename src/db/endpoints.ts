import type { MyceliumDb } from "./connection.js";

export type EndpointUpsertInput = {
  endpointId: string;
  agentId: string;
  address: string;
  transportId?: string;
  hostId?: string;
  state?: string;
  metadata?: string;
};

export function upsertEndpoint(db: MyceliumDb, input: EndpointUpsertInput) {
  const stmt = db.prepare(`
    INSERT INTO endpoints (
      endpoint_id, agent_id, host_id, transport_id, address, state, metadata, spawned_at, last_seen_at, updated_at
    ) VALUES (
      @endpointId, @agentId, @hostId, @transportId, @address, @state, @metadata, datetime('now'), datetime('now'), datetime('now')
    )
    ON CONFLICT(endpoint_id) DO UPDATE SET
      agent_id = excluded.agent_id,
      host_id = excluded.host_id,
      transport_id = excluded.transport_id,
      address = excluded.address,
      state = excluded.state,
      metadata = excluded.metadata,
      last_seen_at = datetime('now'),
      updated_at = datetime('now')
  `);

  stmt.run({
    transportId: input.transportId ?? "openclaw-session",
    hostId: input.hostId ?? "local",
    state: input.state ?? "healthy",
    metadata: input.metadata ?? null,
    ...input,
  });
}

export function markEndpointState(db: MyceliumDb, endpointId: string, state: string) {
  db.prepare(
    `UPDATE endpoints SET state = ?, updated_at = datetime('now') WHERE endpoint_id = ?`,
  ).run(state, endpointId);
}
