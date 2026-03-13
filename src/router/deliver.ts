import { createBindingFromEndpoint } from "../db/bindings.js";
import type { MyceliumDb } from "../db/connection.js";
import {
  assignDeliveryEndpoint,
  createDelivery,
  deadLetterDelivery,
  getDelivery,
  incrementDeliveryAttempts,
  markDeliveryState,
  recordDeliveryAttempt,
} from "../db/deliveries.js";
import { markEndpointState, touchEndpoint } from "../db/endpoints.js";
import { handleMissingEndpoint } from "./fallback.js";
import { resolveTargetEndpoints } from "./resolve.js";

export type DeliverMessageInput = {
  fromAgentId?: string;
  toAgentId: string;
  messageBody: string;
  taskId?: string;
  priority?: "low" | "normal" | "high";
  spawnIfNeeded?: boolean;
  maxAttempts?: number;
  compatibleTransportIds?: string[];
};

export async function deliverMessage(
  db: MyceliumDb,
  runtime: any,
  input: DeliverMessageInput,
) {
  const maxAttempts = normalizeMaxAttempts(input.maxAttempts);
  const compatibleTransportIds = resolveCompatibleTransportIds(runtime, input.compatibleTransportIds);

  const delivery = createDelivery(db, {
    fromAgentId: input.fromAgentId,
    toAgentId: input.toAgentId,
    messageBody: input.messageBody,
    priority: input.priority,
    scopeTaskId: input.taskId,
    dedupeKey: `${input.fromAgentId ?? "unknown"}:${input.toAgentId}:${input.taskId ?? "global"}:${input.messageBody}`,
    maxAttempts,
  });

  const resolved = resolveTargetEndpoints(db, {
    fromAgentId: input.fromAgentId,
    toAgentId: input.toAgentId,
    taskId: input.taskId,
    compatibleTransportIds,
  });

  if (resolved.length === 0) {
    return {
      deliveryId: delivery.delivery_id,
      ...handleMissingEndpoint(db, {
        deliveryId: delivery.delivery_id,
        messageBody: input.messageBody,
        targetAgentId: input.toAgentId,
        spawnIfNeeded: input.spawnIfNeeded,
        compatibleTransportIds,
      }),
    };
  }

  markDeliveryState(db, delivery.delivery_id, "dispatched");

  let lastError = "delivery failed";
  const attemptedEndpoints = resolved.slice(0, maxAttempts);

  for (const [index, candidate] of attemptedEndpoints.entries()) {
    const { endpoint, reason } = candidate;
    const startedAt = Date.now();

    assignDeliveryEndpoint(db, delivery.delivery_id, endpoint.endpoint_id);
    incrementDeliveryAttempts(db, delivery.delivery_id);

    try {
      if (!runtime?.subagent?.run) {
        throw new Error("subagent runtime unavailable in tool context");
      }

      const result = await runtime.subagent.run({
        sessionKey: endpoint.address,
        message: input.messageBody,
        deliver: true,
        idempotencyKey: `mycelium:${delivery.delivery_id}`,
      });

      const latencyMs = Date.now() - startedAt;
      recordDeliveryAttempt(db, {
        deliveryId: delivery.delivery_id,
        endpointId: endpoint.endpoint_id,
        transportId: endpoint.transport_id,
        attemptNumber: index + 1,
        outcome: "success",
        latencyMs,
      });
      touchEndpoint(db, endpoint.endpoint_id, { state: "healthy", acked: true });
      markDeliveryState(db, delivery.delivery_id, "acked", { ackLevel: endpoint.ack_level ?? "endpoint", error: null });

      if (input.taskId) {
        createBindingFromEndpoint(db, endpoint, {
          sourceAgentId: input.fromAgentId,
          scope: { taskId: input.taskId },
        });
      }

      return {
        ok: true,
        deliveryId: delivery.delivery_id,
        target: input.toAgentId,
        endpointId: endpoint.endpoint_id,
        sessionKey: endpoint.address,
        runId: result?.runId,
        resolution: reason,
        attemptCount: index + 1,
        maxAttempts,
        state: "acked" as const,
        delivery: getDelivery(db, delivery.delivery_id),
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const latencyMs = Date.now() - startedAt;

      recordDeliveryAttempt(db, {
        deliveryId: delivery.delivery_id,
        endpointId: endpoint.endpoint_id,
        transportId: endpoint.transport_id,
        attemptNumber: index + 1,
        outcome: "transport_error",
        error: lastError,
        latencyMs,
      });
      markEndpointState(db, endpoint.endpoint_id, "suspect");
    }
  }

  const finalReason = buildFailureReason({
    requestedAttempts: maxAttempts,
    attemptedCount: attemptedEndpoints.length,
    availableCount: resolved.length,
    lastError,
  });

  markDeliveryState(db, delivery.delivery_id, "failed", { error: finalReason });
  deadLetterDelivery(db, {
    deliveryId: delivery.delivery_id,
    reason: finalReason,
    originalMessage: input.messageBody,
  });

  const finalDelivery = getDelivery(db, delivery.delivery_id);

  return {
    ok: false,
    deliveryId: delivery.delivery_id,
    target: input.toAgentId,
    endpointId: finalDelivery?.endpoint_id ?? attemptedEndpoints.at(-1)?.endpoint.endpoint_id ?? resolved.at(-1)?.endpoint.endpoint_id ?? null,
    resolution: resolved[0]?.reason,
    attemptCount: attemptedEndpoints.length,
    maxAttempts,
    state: "dead_lettered" as const,
    error: finalReason,
    delivery: finalDelivery,
  };
}

function normalizeMaxAttempts(maxAttempts?: number) {
  if (!Number.isFinite(maxAttempts)) return 3;
  return Math.max(1, Math.floor(maxAttempts as number));
}

function resolveCompatibleTransportIds(runtime: any, compatibleTransportIds?: string[]) {
  const explicit = normalizeTransportIds(compatibleTransportIds);
  if (explicit?.length) return explicit;

  const runtimeTransports = normalizeTransportIds(runtime?.mycelium?.compatibleTransportIds);
  if (runtimeTransports?.length) return runtimeTransports;

  return undefined;
}

function normalizeTransportIds(transportIds?: unknown): string[] | undefined {
  if (!Array.isArray(transportIds)) return undefined;
  const normalized = transportIds
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  return normalized.length ? normalized : undefined;
}

function buildFailureReason(input: {
  requestedAttempts: number;
  attemptedCount: number;
  availableCount: number;
  lastError: string;
}) {
  if (input.attemptedCount === 0) {
    return input.lastError;
  }

  if (input.availableCount > input.attemptedCount) {
    return `${input.lastError}; retry policy stopped after ${input.attemptedCount}/${input.requestedAttempts} attempts`;
  }

  return input.lastError;
}
