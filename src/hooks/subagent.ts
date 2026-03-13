import { upsertConversationBinding } from "../db/bindings.js";
import type { MyceliumDb } from "../db/connection.js";
import { markEndpointState, touchEndpoint, upsertEndpoint } from "../db/endpoints.js";
import { readNonEmptyString } from "./guards.js";

function getEventValue(event: unknown, key: string) {
  return readNonEmptyString((event as Record<string, unknown> | undefined)?.[key]);
}

function getSpawnedSessionKey(event: unknown) {
  return getEventValue(event, "childSessionKey") ?? getEventValue(event, "sessionKey");
}

function getSpawnedAgentId(event: unknown) {
  return getEventValue(event, "childAgentId") ?? getEventValue(event, "targetAgentId");
}

export function createSubagentHooks(db: MyceliumDb) {
  return {
    async onSubagentSpawned(event: unknown, ctx: { agentId?: string }) {
      const childAgentId = getSpawnedAgentId(event);
      const childSessionKey = getSpawnedSessionKey(event);
      const transportId = getEventValue(event, "transportId");
      const hostId = getEventValue(event, "hostId");
      const parentAgentId = getEventValue(event, "parentAgentId");
      const childSessionId = getEventValue(event, "childSessionId") ?? getEventValue(event, "sessionId");
      const taskId = getEventValue(event, "taskId");
      const threadId = getEventValue(event, "threadId");
      const channelId = getEventValue(event, "channelId");

      if (!childAgentId || !childSessionKey) return;

      upsertEndpoint(db, {
        endpointId: childSessionKey,
        agentId: childAgentId,
        address: childSessionKey,
        transportId: transportId ?? "openclaw-session",
        hostId: hostId ?? "local",
        metadata: JSON.stringify({
          parentAgentId: parentAgentId ?? ctx.agentId ?? null,
          childSessionId: childSessionId ?? null,
        }),
      });

      upsertConversationBinding(db, {
        sourceAgentId: parentAgentId ?? ctx.agentId,
        targetAgentId: childAgentId,
        endpointId: childSessionKey,
        scope: {
          taskId,
          threadId,
          channelId,
        },
      });
    },

    async onSubagentEnded(event: unknown) {
      const childSessionKey = getSpawnedSessionKey(event);
      if (!childSessionKey) return;
      markEndpointState(db, childSessionKey, "dead");
    },

    async onDeliveryTarget(event: unknown, ctx: { agentId?: string }) {
      const targetAgentId = getEventValue(event, "targetAgentId") ?? getSpawnedAgentId(event);
      const targetSessionKey = getEventValue(event, "targetSessionKey") ?? getSpawnedSessionKey(event);
      const parentAgentId = getEventValue(event, "parentAgentId");
      const taskId = getEventValue(event, "taskId");
      const threadId = getEventValue(event, "threadId");
      const channelId = getEventValue(event, "channelId");

      if (!targetAgentId || !targetSessionKey) return;

      touchEndpoint(db, targetSessionKey, { state: "healthy" });
      upsertConversationBinding(db, {
        sourceAgentId: ctx.agentId ?? parentAgentId,
        targetAgentId,
        endpointId: targetSessionKey,
        scope: {
          taskId,
          threadId,
          channelId,
        },
      });
    },
  };
}
