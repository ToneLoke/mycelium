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
};

export async function deliverMessage(
  db: MyceliumDb,
  runtime: any,
  input: DeliverMessageInput,
) {
  const delivery = createDelivery(db, {
    fromAgentId: input.fromAgentId,
    toAgentId: input.toAgentId,
    messageBody: input.messageBody,
    priority: input.priority,
    scopeTaskId: input.taskId,
    dedupeKey: `${input.fromAgentId ?? "unknown"}:${input.toAgentId}:${input.taskId ?? "global"}:${input.messageBody}`,
  });

  const resolved = resolveTargetEndpoints(db, {
    fromAgentId: input.fromAgentId,
    toAgentId: input.toAgentId,
    taskId: input.taskId,
  });

  if (resolved.length === 0) {
    return {
      deliveryId: delivery.delivery_id,
      ...handleMissingEndpoint(db, {
        deliveryId: delivery.delivery_id,
        messageBody: input.messageBody,
        targetAgentId: input.toAgentId,
        spawnIfNeeded: input.spawnIfNeeded,
      }),
    };
  }

  markDeliveryState(db, delivery.delivery_id, "dispatched");

  let lastError = "delivery failed";

  for (const [index, candidate] of resolved.entries()) {
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

  markDeliveryState(db, delivery.delivery_id, "failed", { error: lastError });
  deadLetterDelivery(db, {
    deliveryId: delivery.delivery_id,
    reason: lastError,
    originalMessage: input.messageBody,
  });

  const finalDelivery = getDelivery(db, delivery.delivery_id);

  return {
    ok: false,
    deliveryId: delivery.delivery_id,
    target: input.toAgentId,
    endpointId: finalDelivery?.endpoint_id ?? resolved.at(-1)?.endpoint.endpoint_id ?? null,
    resolution: resolved[0]?.reason,
    attemptCount: resolved.length,
    state: "dead_lettered" as const,
    error: lastError,
    delivery: finalDelivery,
  };
}
