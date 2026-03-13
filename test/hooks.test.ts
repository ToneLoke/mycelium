import { afterEach, describe, expect, it } from "vitest";
import { findConversationBinding } from "../src/db/bindings.js";
import type { MyceliumDb } from "../src/db/connection.js";
import { getEndpointById } from "../src/db/endpoints.js";
import { createSessionHooks } from "../src/hooks/session.js";
import { createSubagentHooks } from "../src/hooks/subagent.js";
import { createTestDb } from "./helpers.js";

describe("hooks", () => {
  const dbs: MyceliumDb[] = [];

  afterEach(() => {
    while (dbs.length) dbs.pop()?.close();
  });

  it("ignores malformed hook payloads", async () => {
    const db = createTestDb();
    dbs.push(db);

    const sessionHooks = createSessionHooks(db);
    const subagentHooks = createSubagentHooks(db);

    await sessionHooks.onSessionStart({ sessionKey: "   " }, { agentId: "main" });
    await sessionHooks.onMessageSent({ sessionKey: 42 }, { agentId: "main" });
    await subagentHooks.onSubagentSpawned({ childAgentId: "skipper", childSessionKey: "   " }, { agentId: "main" });
    await subagentHooks.onDeliveryTarget({ targetAgentId: "", targetSessionKey: "session://bad" }, { agentId: "main" });

    const endpointCount = db.prepare("SELECT COUNT(*) AS count FROM endpoints").get() as { count: number };
    const bindingCount = db.prepare("SELECT COUNT(*) AS count FROM conversation_bindings").get() as { count: number };

    expect(endpointCount.count).toBe(0);
    expect(bindingCount.count).toBe(0);
  });

  it("records validated session and subagent payloads", async () => {
    const db = createTestDb();
    dbs.push(db);

    const sessionHooks = createSessionHooks(db);
    const subagentHooks = createSubagentHooks(db);

    await sessionHooks.onSessionStart({
      sessionId: "sess-1",
      sessionKey: "session://main",
      transportId: "openclaw-session",
      hostId: "host-a",
    }, { agentId: "main" });

    await sessionHooks.onMessageSent({
      sessionKey: "session://main",
      threadId: "thread-1",
      channelId: "channel-1",
    }, { agentId: "main" });

    await subagentHooks.onSubagentSpawned({
      childAgentId: "skipper",
      childSessionKey: "session://skipper",
      childSessionId: "sess-2",
      parentAgentId: "main",
      taskId: "TASK-3",
      threadId: "thread-1",
      channelId: "channel-1",
    }, { agentId: "main" });

    const mainEndpoint = getEndpointById(db, "session://main");
    const skipperEndpoint = getEndpointById(db, "session://skipper");
    const selfBinding = findConversationBinding(db, {
      sourceAgentId: "main",
      targetAgentId: "main",
      scope: { threadId: "thread-1", channelId: "channel-1" },
    });
    const childBinding = findConversationBinding(db, {
      sourceAgentId: "main",
      targetAgentId: "skipper",
      scope: { taskId: "TASK-3", threadId: "thread-1", channelId: "channel-1" },
    });

    expect(mainEndpoint?.host_id).toBe("host-a");
    expect(mainEndpoint?.metadata).toContain('"sessionId":"sess-1"');
    expect(skipperEndpoint?.metadata).toContain('"parentAgentId":"main"');
    expect(selfBinding?.preferred_endpoint_id).toBe("session://main");
    expect(childBinding?.preferred_endpoint_id).toBe("session://skipper");
  });
});
