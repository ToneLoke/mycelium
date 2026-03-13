import type { MyceliumDb } from "../db/connection.js";
import { deadLetterDelivery, markDeliveryState } from "../db/deliveries.js";
import { transportSupportsSpawn } from "../db/transports.js";

export function handleMissingEndpoint(
  db: MyceliumDb,
  input: {
    deliveryId: string;
    messageBody: string;
    targetAgentId: string;
    spawnIfNeeded?: boolean;
    compatibleTransportIds?: string[];
  },
) {
  const transportDetail = input.compatibleTransportIds?.length
    ? ` for compatible transports: ${input.compatibleTransportIds.join(", ")}`
    : "";

  const spawnCapabilityDetail = input.spawnIfNeeded
    ? describeSpawnCapability(db, input.compatibleTransportIds)
    : "";

  const reason = input.spawnIfNeeded
    ? `no live endpoint for ${input.targetAgentId}${transportDetail}; ${spawnCapabilityDetail}spawn fallback is not implemented in v1`
    : `no live endpoint for ${input.targetAgentId}${transportDetail}`;

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

function describeSpawnCapability(db: MyceliumDb, transportIds?: string[]) {
  const normalized = transportIds?.map((value) => value.trim()).filter(Boolean);
  if (!normalized?.length) return "";

  const spawnable = normalized.filter((transportId) => transportSupportsSpawn(db, transportId));
  if (spawnable.length > 0) {
    return `compatible spawn-capable transports exist (${spawnable.join(", ")}), but `;
  }

  return "compatible transports are not spawn-capable, and ";
}
