import { markEndpointState, upsertEndpoint } from "../db/endpoints.js";
import type { MyceliumDb } from "../db/connection.js";

export function createSessionHooks(db: MyceliumDb) {
  return {
    async onSessionStart(event: { sessionId?: string; sessionKey?: string }, ctx: { agentId?: string }) {
      if (!ctx.agentId || !event.sessionKey) return;
      upsertEndpoint(db, {
        endpointId: event.sessionKey,
        agentId: ctx.agentId,
        address: event.sessionKey,
        metadata: JSON.stringify({ sessionId: event.sessionId ?? null }),
      });
    },

    async onSessionEnd(event: { sessionKey?: string }) {
      if (!event.sessionKey) return;
      markEndpointState(db, event.sessionKey, "dead");
    },
  };
}
