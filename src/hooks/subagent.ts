import { upsertConversationBinding } from "../db/bindings.js";
import type { MyceliumDb } from "../db/connection.js";
import { markEndpointState, touchEndpoint, upsertEndpoint } from "../db/endpoints.js";

type SubagentEvent = {
  sessionId?: string;
  sessionKey?: string;
  childSessionId?: string;
  childSessionKey?: string;
  childAgentId?: string;
  parentAgentId?: string;
  taskId?: string;
  threadId?: string;
  channelId?: string;
  transportId?: string;
  hostId?: string;
  targetSessionKey?: string;
  targetAgentId?: string;
};

function getSpawnedSessionKey(event: SubagentEvent) {
  return event.childSessionKey ?? event.sessionKey;
}

function getSpawnedAgentId(event: SubagentEvent) {
  return event.childAgentId ?? event.targetAgentId;
}

export function createSubagentHooks(db: MyceliumDb) {
  return {
    async onSubagentSpawned(event: SubagentEvent, ctx: { agentId?: string }) {
      const childAgentId = getSpawnedAgentId(event);
      const childSessionKey = getSpawnedSessionKey(event);
      if (!childAgentId || !childSessionKey) return;

      upsertEndpoint(db, {
        endpointId: childSessionKey,
        agentId: childAgentId,
        address: childSessionKey,
        transportId: event.transportId ?? "openclaw-session",
        hostId: event.hostId ?? "local",
        metadata: JSON.stringify({
          parentAgentId: event.parentAgentId ?? ctx.agentId ?? null,
          childSessionId: event.childSessionId ?? event.sessionId ?? null,
        }),
      });

      upsertConversationBinding(db, {
        sourceAgentId: event.parentAgentId ?? ctx.agentId,
        targetAgentId: childAgentId,
        endpointId: childSessionKey,
        scope: {
          taskId: event.taskId,
          threadId: event.threadId,
          channelId: event.channelId,
        },
      });
    },

    async onSubagentEnded(event: SubagentEvent) {
      const childSessionKey = getSpawnedSessionKey(event);
      if (!childSessionKey) return;
      markEndpointState(db, childSessionKey, "dead");
    },

    async onDeliveryTarget(event: SubagentEvent, ctx: { agentId?: string }) {
      const targetAgentId = event.targetAgentId ?? getSpawnedAgentId(event);
      const targetSessionKey = event.targetSessionKey ?? getSpawnedSessionKey(event);
      if (!targetAgentId || !targetSessionKey) return;

      touchEndpoint(db, targetSessionKey, { state: "healthy" });
      upsertConversationBinding(db, {
        sourceAgentId: ctx.agentId ?? event.parentAgentId,
        targetAgentId,
        endpointId: targetSessionKey,
        scope: {
          taskId: event.taskId,
          threadId: event.threadId,
          channelId: event.channelId,
        },
      });
    },
  };
}
