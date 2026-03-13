import { upsertConversationBinding } from "../db/bindings.js";
import type { MyceliumDb } from "../db/connection.js";
import { markEndpointState, touchEndpoint, upsertEndpoint } from "../db/endpoints.js";

type SessionEvent = {
  sessionId?: string;
  sessionKey?: string;
  threadId?: string;
  channelId?: string;
  transportId?: string;
  hostId?: string;
};

export function createSessionHooks(db: MyceliumDb) {
  return {
    async onSessionStart(event: SessionEvent, ctx: { agentId?: string }) {
      if (!ctx.agentId || !event.sessionKey) return;
      upsertEndpoint(db, {
        endpointId: event.sessionKey,
        agentId: ctx.agentId,
        address: event.sessionKey,
        transportId: event.transportId ?? "openclaw-session",
        hostId: event.hostId ?? "local",
        metadata: JSON.stringify({ sessionId: event.sessionId ?? null }),
      });
    },

    async onSessionEnd(event: SessionEvent) {
      if (!event.sessionKey) return;
      markEndpointState(db, event.sessionKey, "dead");
    },

    async onMessageSent(event: SessionEvent, ctx: { agentId?: string }) {
      if (!event.sessionKey) return;
      touchEndpoint(db, event.sessionKey, { state: "healthy" });

      if (ctx.agentId) {
        upsertConversationBinding(db, {
          sourceAgentId: ctx.agentId,
          targetAgentId: ctx.agentId,
          endpointId: event.sessionKey,
          scope: {
            threadId: event.threadId,
            channelId: event.channelId,
          },
          ttlSeconds: 86_400,
        });
      }
    },
  };
}
