import { deadLetterDelivery, markDeliveryState } from "../db/deliveries.js";
import type { MyceliumDb } from "../db/connection.js";

export function handleMissingEndpoint(
  db: MyceliumDb,
  input: {
    deliveryId: string;
    messageBody: string;
    targetAgentId: string;
    spawnIfNeeded?: boolean;
  },
) {
  const reason = input.spawnIfNeeded
    ? `no live endpoint for ${input.targetAgentId}; spawn fallback is not implemented in v1`
    : `no live endpoint for ${input.targetAgentId}`;

  markDeliveryState(db, input.deliveryId, "failed", { error: reason });
  deadLetterDelivery(db, {
    deliveryId: input.deliveryId,
    reason,
    originalMessage: input.messageBody,
  });

  return {
    ok: false,
    state: "dead_lettered" as const,
    error: reason,
  };
}
