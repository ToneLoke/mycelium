import { findConversationBinding } from "../db/bindings.js";
import type { MyceliumDb } from "../db/connection.js";
import { getEndpointById, resolveHealthyEndpoints, type EndpointRecord } from "../db/endpoints.js";

export type ResolveEndpointInput = {
  fromAgentId?: string;
  toAgentId: string;
  taskId?: string;
  compatibleTransportIds?: string[];
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
  const compatibleTransportIds = normalizeCompatibleTransportIds(input.compatibleTransportIds);

  const binding = findConversationBinding(db, {
    sourceAgentId: input.fromAgentId,
    targetAgentId: input.toAgentId,
    scope: { taskId: input.taskId },
  });

  if (binding?.preferred_endpoint_id && binding.endpoint_state === "healthy") {
    const endpoint = getEndpointById(db, binding.preferred_endpoint_id);
    if (endpoint?.state === "healthy" && isCompatibleTransport(endpoint, compatibleTransportIds)) {
      candidates.push({ endpoint, reason: "binding" });
      seenEndpointIds.add(endpoint.endpoint_id);
    }
  }

  for (const endpoint of resolveHealthyEndpoints(db, input.toAgentId)) {
    if (seenEndpointIds.has(endpoint.endpoint_id)) continue;
    if (!isCompatibleTransport(endpoint, compatibleTransportIds)) continue;
    candidates.push({ endpoint, reason: "healthy-endpoint" });
    seenEndpointIds.add(endpoint.endpoint_id);
  }

  return candidates;
}

function normalizeCompatibleTransportIds(transportIds?: string[]): Set<string> | undefined {
  const normalized = transportIds?.map((value) => value.trim()).filter(Boolean);
  if (!normalized?.length) return undefined;
  return new Set(normalized);
}

function isCompatibleTransport(endpoint: EndpointRecord, compatibleTransportIds?: Set<string>) {
  if (!compatibleTransportIds) return true;
  return compatibleTransportIds.has(endpoint.transport_id);
}
