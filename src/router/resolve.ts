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
  return resolveTargetEndpoints(db, input)[0];
}

export function resolveTargetEndpoints(db: MyceliumDb, input: ResolveEndpointInput): ResolvedEndpoint[] {
  const candidates: ResolvedEndpoint[] = [];
  const seenEndpointIds = new Set<string>();

  const binding = findConversationBinding(db, {
    sourceAgentId: input.fromAgentId,
    targetAgentId: input.toAgentId,
    scope: { taskId: input.taskId },
  });

  if (binding?.preferred_endpoint_id && binding.endpoint_state === "healthy") {
    const endpoint = getEndpointById(db, binding.preferred_endpoint_id);
    if (endpoint?.state === "healthy") {
      candidates.push({ endpoint, reason: "binding" });
      seenEndpointIds.add(endpoint.endpoint_id);
    }
  }

  for (const endpoint of resolveHealthyEndpoints(db, input.toAgentId)) {
    if (seenEndpointIds.has(endpoint.endpoint_id)) continue;
    candidates.push({ endpoint, reason: "healthy-endpoint" });
    seenEndpointIds.add(endpoint.endpoint_id);
  }

  return candidates;
}
