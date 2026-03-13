import { randomUUID } from "node:crypto";
import type { MyceliumDb } from "./connection.js";

export type DeliveryState = "queued" | "dispatched" | "acked" | "failed" | "dead_lettered";
export type AttemptOutcome = "success" | "transport_error" | "endpoint_error" | "timeout";

export type CreateDeliveryInput = {
  fromAgentId?: string;
  toAgentId: string;
  messageBody: string;
  endpointId?: string;
  priority?: "low" | "normal" | "high";
  scopeTaskId?: string;
  dedupeKey?: string;
  hopCount?: number;
  maxHops?: number;
  correlationId?: string;
  maxAttempts?: number;
};

export type DeliveryRecord = {
  delivery_id: string;
  correlation_id: string | null;
  from_agent_id: string | null;
  to_agent_id: string;
  endpoint_id: string | null;
  message_body: string;
  state: DeliveryState;
  ack_level: string | null;
  attempt_count: number;
  max_attempts: number;
  priority: string;
  sensitivity: string;
  scope_task_id: string | null;
  dedupe_key: string | null;
  hop_count: number;
  max_hops: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export function createDelivery(db: MyceliumDb, input: CreateDeliveryInput): DeliveryRecord {
  const deliveryId = randomUUID();
  db.prepare(`
    INSERT INTO deliveries (
      delivery_id,
      correlation_id,
      from_agent_id,
      to_agent_id,
      endpoint_id,
      message_body,
      priority,
      scope_task_id,
      dedupe_key,
      hop_count,
      max_hops,
      max_attempts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    deliveryId,
    input.correlationId ?? null,
    input.fromAgentId ?? null,
    input.toAgentId,
    input.endpointId ?? null,
    input.messageBody,
    input.priority ?? "normal",
    input.scopeTaskId ?? null,
    input.dedupeKey ?? null,
    input.hopCount ?? 0,
    input.maxHops ?? 5,
    input.maxAttempts ?? 3,
  );

  return getDelivery(db, deliveryId)!;
}

export function getDelivery(db: MyceliumDb, deliveryId: string): DeliveryRecord | undefined {
  return db.prepare(`SELECT * FROM deliveries WHERE delivery_id = ?`).get(deliveryId) as DeliveryRecord | undefined;
}

export function assignDeliveryEndpoint(db: MyceliumDb, deliveryId: string, endpointId: string) {
  db.prepare(`
    UPDATE deliveries
    SET endpoint_id = ?, updated_at = datetime('now')
    WHERE delivery_id = ?
  `).run(endpointId, deliveryId);
}

export function markDeliveryState(
  db: MyceliumDb,
  deliveryId: string,
  state: DeliveryState,
  updates?: { ackLevel?: string; error?: string | null },
) {
  db.prepare(`
    UPDATE deliveries
    SET state = ?,
        ack_level = COALESCE(?, ack_level),
        error = ?,
        updated_at = datetime('now')
    WHERE delivery_id = ?
  `).run(state, updates?.ackLevel ?? null, updates?.error ?? null, deliveryId);
}

export function incrementDeliveryAttempts(db: MyceliumDb, deliveryId: string) {
  db.prepare(`
    UPDATE deliveries
    SET attempt_count = attempt_count + 1,
        updated_at = datetime('now')
    WHERE delivery_id = ?
  `).run(deliveryId);
}

export function recordDeliveryAttempt(
  db: MyceliumDb,
  input: {
    deliveryId: string;
    endpointId?: string;
    transportId?: string;
    attemptNumber: number;
    outcome: AttemptOutcome;
    error?: string;
    latencyMs?: number;
  },
) {
  db.prepare(`
    INSERT INTO delivery_attempts (
      attempt_id,
      delivery_id,
      endpoint_id,
      transport_id,
      attempt_number,
      outcome,
      error,
      latency_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.deliveryId,
    input.endpointId ?? null,
    input.transportId ?? null,
    input.attemptNumber,
    input.outcome,
    input.error ?? null,
    input.latencyMs ?? null,
  );
}

export function deadLetterDelivery(db: MyceliumDb, input: { deliveryId: string; reason: string; originalMessage: string }) {
  db.prepare(`
    INSERT INTO dead_letters (dead_letter_id, delivery_id, reason, original_message)
    VALUES (?, ?, ?, ?)
  `).run(randomUUID(), input.deliveryId, input.reason, input.originalMessage);

  markDeliveryState(db, input.deliveryId, "dead_lettered", { error: input.reason });
}

export function pruneHistoricalDeliveries(db: MyceliumDb) {
  return db.prepare(`
    DELETE FROM deliveries
    WHERE state IN ('acked', 'dead_lettered')
      AND created_at < datetime('now', '-7 days')
  `).run();
}
