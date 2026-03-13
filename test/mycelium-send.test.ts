import { afterEach, describe, expect, it, vi } from "vitest";
import type { MyceliumDb } from "../src/db/connection.js";
import { getDelivery } from "../src/db/deliveries.js";
import { upsertEndpoint } from "../src/db/endpoints.js";
import { createMyceliumSendTool } from "../src/tools/mycelium-send.js";
import { createTestDb } from "./helpers.js";

describe("mycelium_send tool", () => {
  const dbs: MyceliumDb[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    while (dbs.length) dbs.pop()?.close();
  });

  it("routes through the public tool contract with retry policy and transport filtering", async () => {
    const db = createTestDb();
    dbs.push(db);

    upsertEndpoint(db, {
      endpointId: "skipper-gateway",
      agentId: "skipper",
      address: "gateway://skipper",
      transportId: "gateway-send",
    });
    upsertEndpoint(db, {
      endpointId: "skipper-session-a",
      agentId: "skipper",
      address: "session://skipper-a",
      transportId: "openclaw-session",
    });
    upsertEndpoint(db, {
      endpointId: "skipper-session-b",
      agentId: "skipper",
      address: "session://skipper-b",
      transportId: "openclaw-session",
    });

    const run = vi.fn()
      .mockRejectedValueOnce(new Error("session a unavailable"))
      .mockResolvedValueOnce({ runId: "run-2" });

    const tool = createMyceliumSendTool(db);
    const result = await tool.execute({
      to: "skipper",
      message: "Ship it",
      taskId: "TASK-42",
      maxAttempts: 2,
      compatibleTransports: ["openclaw-session"],
    }, {
      agentId: "main",
      runtime: {
        subagent: { run },
        mycelium: { compatibleTransportIds: ["gateway-send"] },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.endpointId).toBe("skipper-session-b");
    expect(result.attemptCount).toBe(2);
    expect(result.maxAttempts).toBe(2);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(1, expect.objectContaining({ sessionKey: "session://skipper-a" }));
    expect(run).toHaveBeenNthCalledWith(2, expect.objectContaining({ sessionKey: "session://skipper-b" }));

    const delivery = getDelivery(db, result.deliveryId)!;
    expect(delivery.to_agent_id).toBe("skipper");
    expect(delivery.scope_task_id).toBe("TASK-42");
    expect(delivery.max_attempts).toBe(2);
    expect(delivery.endpoint_id).toBe("skipper-session-b");

    const attempts = db
      .prepare("SELECT endpoint_id, transport_id, outcome, attempt_number FROM delivery_attempts WHERE delivery_id = ? ORDER BY attempt_number")
      .all(result.deliveryId);

    expect(attempts).toEqual([
      expect.objectContaining({ endpoint_id: "skipper-session-a", transport_id: "openclaw-session", outcome: "transport_error", attempt_number: 1 }),
      expect.objectContaining({ endpoint_id: "skipper-session-b", transport_id: "openclaw-session", outcome: "success", attempt_number: 2 }),
    ]);
  });

  it("keeps v1 honest when spawn fallback is requested but unsupported", async () => {
    const db = createTestDb();
    dbs.push(db);

    const tool = createMyceliumSendTool(db);
    const result = await tool.execute({
      to: "skipper",
      message: "Wake up",
      spawnIfNeeded: true,
      compatibleTransports: ["gateway-send"],
    }, {
      agentId: "main",
      runtime: {
        subagent: { run: vi.fn() },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.state).toBe("dead_lettered");
    expect(result.error).toContain("spawn fallback is not implemented in v1");
    expect(result.error).toContain("compatible transports: gateway-send");
  });
});
