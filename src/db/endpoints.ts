import type { MyceliumDb } from "./connection.js";

export type EndpointState = "healthy" | "suspect" | "stale" | "dead" | "draining";

export type EndpointRecord = {
  endpoint_id: string;
  agent_id: string;
  host_id: string;
  transport_id: string;
  address: string;
  state: EndpointState;
  ack_level: string | null;
  spawned_at: string | null;
  last_seen_at: string | null;
  last_ack_at: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type EndpointUpsertInput = {
  endpointId: string;
  agentId: string;
  address: string;
  transportId?: string;
  hostId?: string;
  state?: EndpointState;
  ackLevel?: string;
  metadata?: string;
};

export function upsertEndpoint(db: MyceliumDb, input: EndpointUpsertInput) {
  const stmt = db.prepare(`
    INSERT INTO endpoints (
      endpoint_id, agent_id, host_id, transport_id, address, state, ack_level, metadata, spawned_at, last_seen_at, updated_at
    ) VALUES (
      @endpointId, @agentId, @hostId, @transportId, @address, @state, @ackLevel, @metadata, datetime('now'), datetime('now'), datetime('now')
    )
    ON CONFLICT(endpoint_id) DO UPDATE SET
      agent_id = excluded.agent_id,
      host_id = excluded.host_id,
      transport_id = excluded.transport_id,
      address = excluded.address,
      state = excluded.state,
      ack_level = excluded.ack_level,
      metadata = excluded.metadata,
      last_seen_at = datetime('now'),
      updated_at = datetime('now')
  `);

  stmt.run({
    transportId: input.transportId ?? "openclaw-session",
    hostId: input.hostId ?? "local",
    state: input.state ?? "healthy",
    ackLevel: input.ackLevel ?? null,
    metadata: input.metadata ?? null,
    ...input,
  });
}

export function getEndpointById(db: MyceliumDb, endpointId: string): EndpointRecord | undefined {
  return db
    .prepare(`SELECT * FROM endpoints WHERE endpoint_id = ?`)
    .get(endpointId) as EndpointRecord | undefined;
}

export function resolveHealthyEndpoints(db: MyceliumDb, agentId: string): EndpointRecord[] {
  return db
    .prepare(`
      SELECT *
      FROM endpoints
      WHERE agent_id = ?
        AND state = 'healthy'
      ORDER BY COALESCE(last_seen_at, created_at) DESC, created_at DESC
    `)
    .all(agentId) as EndpointRecord[];
}

export function markEndpointState(db: MyceliumDb, endpointId: string, state: EndpointState) {
  db.prepare(
    `UPDATE endpoints SET state = ?, updated_at = datetime('now') WHERE endpoint_id = ?`,
  ).run(state, endpointId);
}

export function touchEndpoint(db: MyceliumDb, endpointId: string, updates?: { state?: EndpointState; acked?: boolean }) {
  db.prepare(
    `
      UPDATE endpoints
      SET state = COALESCE(?, state),
          last_seen_at = datetime('now'),
          last_ack_at = CASE WHEN ? = 1 THEN datetime('now') ELSE last_ack_at END,
          updated_at = datetime('now')
      WHERE endpoint_id = ?
    `,
  ).run(updates?.state ?? null, updates?.acked ? 1 : 0, endpointId);
}
