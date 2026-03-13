import { findConversationBinding } from "../db/bindings.js";
import type { MyceliumDb } from "../db/connection.js";
import { getEndpointById, resolveHealthyEndpoints, type EndpointRecord } from "../db/endpoints.js";

export type ResolveEndpointInput = {
  fromAgentId?: string;
  toAgentId: string;
  taskId?: string;
};

export type ResolvedEndpoint = {
  endpoint: EndpointRecord;
  reason: "binding" | "healthy-endpoint";
};

export function resolveTargetEndpoint(db: MyceliumDb, input: ResolveEndpointInput): ResolvedEndpoint | undefined {
  const binding = findConversationBinding(db, {
    sourceAgentId: input.fromAgentId,
    targetAgentId: input.toAgentId,
    scope: { taskId: input.taskId },
  });

  if (binding?.preferred_endpoint_id && binding.endpoint_state === "healthy") {
    const endpoint = getEndpointById(db, binding.preferred_endpoint_id);
    if (endpoint?.state === "healthy") {
      return { endpoint, reason: "binding" };
    }
  }

  const [endpoint] = resolveHealthyEndpoints(db, input.toAgentId);
  if (!endpoint) return undefined;

  return { endpoint, reason: "healthy-endpoint" };
}
