import { upsertConversationBinding } from "../db/bindings.js";
import type { MyceliumDb } from "../db/connection.js";
import { markEndpointState, touchEndpoint, upsertEndpoint } from "../db/endpoints.js";
import { readNonEmptyString } from "./guards.js";

export function createSessionHooks(db: MyceliumDb) {
  return {
    async onSessionStart(event: unknown, ctx: { agentId?: string }) {
      const sessionKey = readNonEmptyString((event as Record<string, unknown> | undefined)?.sessionKey);
      const sessionId = readNonEmptyString((event as Record<string, unknown> | undefined)?.sessionId);
      const transportId = readNonEmptyString((event as Record<string, unknown> | undefined)?.transportId);
      const hostId = readNonEmptyString((event as Record<string, unknown> | undefined)?.hostId);

      if (!ctx.agentId || !sessionKey) return;
      upsertEndpoint(db, {
        endpointId: sessionKey,
        agentId: ctx.agentId,
        address: sessionKey,
        transportId: transportId ?? "openclaw-session",
        hostId: hostId ?? "local",
        metadata: JSON.stringify({ sessionId: sessionId ?? null }),
      });
    },

    async onSessionEnd(event: unknown) {
      const sessionKey = readNonEmptyString((event as Record<string, unknown> | undefined)?.sessionKey);
      if (!sessionKey) return;
      markEndpointState(db, sessionKey, "dead");
    },

    async onMessageSent(event: unknown, ctx: { agentId?: string }) {
      const sessionKey = readNonEmptyString((event as Record<string, unknown> | undefined)?.sessionKey);
      const threadId = readNonEmptyString((event as Record<string, unknown> | undefined)?.threadId);
      const channelId = readNonEmptyString((event as Record<string, unknown> | undefined)?.channelId);

      if (!sessionKey) return;
      touchEndpoint(db, sessionKey, { state: "healthy" });

      if (ctx.agentId) {
        upsertConversationBinding(db, {
          sourceAgentId: ctx.agentId,
          targetAgentId: ctx.agentId,
          endpointId: sessionKey,
          scope: {
            threadId,
            channelId,
          },
          ttlSeconds: 86_400,
        });
      }
    },
  };
}
