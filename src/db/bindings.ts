import { randomUUID } from "node:crypto";
import type { MyceliumDb } from "./connection.js";
import type { EndpointRecord } from "./endpoints.js";

export type BindingScope = {
  taskId?: string;
  threadId?: string;
  channelId?: string;
};

export type ConversationBindingRecord = {
  binding_id: string;
  source_agent_id: string | null;
  target_agent_id: string;
  scope_task_id: string | null;
  scope_thread_id: string | null;
  scope_channel_id: string | null;
  preferred_endpoint_id: string | null;
  ttl_seconds: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export function findConversationBinding(
  db: MyceliumDb,
  params: { sourceAgentId?: string; targetAgentId: string; scope?: BindingScope },
): (ConversationBindingRecord & { endpoint_state: string | null; endpoint_address: string | null }) | undefined {
  const scope = params.scope ?? {};

  return db
    .prepare(`
      SELECT
        b.*, e.state AS endpoint_state, e.address AS endpoint_address
      FROM conversation_bindings b
      LEFT JOIN endpoints e ON e.endpoint_id = b.preferred_endpoint_id
      WHERE b.target_agent_id = @targetAgentId
        AND (@sourceAgentId IS NULL OR b.source_agent_id = @sourceAgentId)
        AND (@taskId IS NULL OR b.scope_task_id = @taskId)
        AND (@threadId IS NULL OR b.scope_thread_id = @threadId)
        AND (@channelId IS NULL OR b.scope_channel_id = @channelId)
        AND (b.expires_at IS NULL OR b.expires_at > datetime('now'))
      ORDER BY b.updated_at DESC, b.created_at DESC
      LIMIT 1
    `)
    .get({
      sourceAgentId: params.sourceAgentId ?? null,
      targetAgentId: params.targetAgentId,
      taskId: scope.taskId ?? null,
      threadId: scope.threadId ?? null,
      channelId: scope.channelId ?? null,
    }) as ((ConversationBindingRecord & {
      endpoint_state: string | null;
      endpoint_address: string | null;
    }) | undefined);
}

export function upsertConversationBinding(
  db: MyceliumDb,
  params: {
    sourceAgentId?: string;
    targetAgentId: string;
    endpointId?: string;
    scope?: BindingScope;
    ttlSeconds?: number;
  },
) {
  const scope = params.scope ?? {};
  const existing = findConversationBinding(db, {
    sourceAgentId: params.sourceAgentId,
    targetAgentId: params.targetAgentId,
    scope,
  });

  const ttlSeconds = params.ttlSeconds ?? 86_400;
  const expiresAt = ttlSeconds > 0 ? `datetime('now', '+${ttlSeconds} seconds')` : "NULL";

  if (existing) {
    db.prepare(`
      UPDATE conversation_bindings
      SET preferred_endpoint_id = ?,
          ttl_seconds = ?,
          expires_at = ${expiresAt},
          updated_at = datetime('now')
      WHERE binding_id = ?
    `).run(params.endpointId ?? null, ttlSeconds, existing.binding_id);

    return existing.binding_id;
  }

  const bindingId = randomUUID();
  db.prepare(`
    INSERT INTO conversation_bindings (
      binding_id,
      source_agent_id,
      target_agent_id,
      scope_task_id,
      scope_thread_id,
      scope_channel_id,
      preferred_endpoint_id,
      ttl_seconds,
      expires_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ${expiresAt}
    )
  `).run(
    bindingId,
    params.sourceAgentId ?? null,
    params.targetAgentId,
    scope.taskId ?? null,
    scope.threadId ?? null,
    scope.channelId ?? null,
    params.endpointId ?? null,
    ttlSeconds,
  );

  return bindingId;
}

export function pruneExpiredBindings(db: MyceliumDb) {
  return db.prepare(`DELETE FROM conversation_bindings WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')`).run();
}

export function createBindingFromEndpoint(
  db: MyceliumDb,
  endpoint: EndpointRecord,
  params?: { sourceAgentId?: string; ttlSeconds?: number; scope?: BindingScope },
) {
  return upsertConversationBinding(db, {
    sourceAgentId: params?.sourceAgentId,
    targetAgentId: endpoint.agent_id,
    endpointId: endpoint.endpoint_id,
    ttlSeconds: params?.ttlSeconds,
    scope: params?.scope,
  });
}
