import { afterEach, describe, expect, it, vi } from "vitest";
import { getDelivery } from "../src/db/deliveries.js";
import { resolveHealthyEndpoints, upsertEndpoint } from "../src/db/endpoints.js";
import { deliverMessage } from "../src/router/deliver.js";
import { resolveTargetEndpoints } from "../src/router/resolve.js";
import type { MyceliumDb } from "../src/db/connection.js";
import { upsertConversationBinding } from "../src/db/bindings.js";
import { createTestDb } from "./helpers.js";

describe("router", () => {
  const dbs: MyceliumDb[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    while (dbs.length) dbs.pop()?.close();
  });

  it("prefers a healthy binding first, then other healthy endpoints", () => {
    const db = createTestDb();
    dbs.push(db);

    upsertEndpoint(db, {
      endpointId: "skipper-secondary",
      agentId: "skipper",
      address: "session://secondary",
    });
    upsertEndpoint(db, {
      endpointId: "skipper-primary",
      agentId: "skipper",
      address: "session://primary",
    });

    upsertConversationBinding(db, {
      sourceAgentId: "main",
      targetAgentId: "skipper",
      endpointId: "skipper-primary",
      scope: { taskId: "TASK-1" },
    });

    const resolved = resolveTargetEndpoints(db, {
      fromAgentId: "main",
      toAgentId: "skipper",
      taskId: "TASK-1",
    });

    expect(resolved.map((entry) => [entry.endpoint.endpoint_id, entry.reason])).toEqual([
      ["skipper-primary", "binding"],
      ["skipper-secondary", "healthy-endpoint"],
    ]);
  });

  it("retries the next healthy endpoint after a transport failure", async () => {
    const db = createTestDb();
    dbs.push(db);

    upsertEndpoint(db, {
      endpointId: "skipper-a",
      agentId: "skipper",
      address: "session://a",
    });
    upsertEndpoint(db, {
      endpointId: "skipper-b",
      agentId: "skipper",
      address: "session://b",
    });

    const run = vi.fn()
      .mockRejectedValueOnce(new Error("endpoint a unavailable"))
      .mockResolvedValueOnce({ runId: "run-2" });

    const result = await deliverMessage(db, { subagent: { run } }, {
      fromAgentId: "main",
      toAgentId: "skipper",
      messageBody: "Ship it",
      taskId: "TASK-2",
    });

    expect(result.ok).toBe(true);
    expect(result.endpointId).toBe("skipper-b");
    expect(result.attemptCount).toBe(2);
    expect(run).toHaveBeenNthCalledWith(1, expect.objectContaining({ sessionKey: "session://a" }));
    expect(run).toHaveBeenNthCalledWith(2, expect.objectContaining({ sessionKey: "session://b" }));

    const attempts = db
      .prepare("SELECT endpoint_id, outcome, error, attempt_number FROM delivery_attempts WHERE delivery_id = ? ORDER BY attempt_number")
      .all(result.deliveryId);

    expect(attempts).toEqual([
      expect.objectContaining({ endpoint_id: "skipper-a", outcome: "transport_error", attempt_number: 1, error: "endpoint a unavailable" }),
      expect.objectContaining({ endpoint_id: "skipper-b", outcome: "success", attempt_number: 2, error: null }),
    ]);

    const delivery = getDelivery(db, result.deliveryId)!;
    expect(delivery.state).toBe("acked");
    expect(delivery.attempt_count).toBe(2);
    expect(delivery.endpoint_id).toBe("skipper-b");

    const endpointStates = resolveHealthyEndpoints(db, "skipper").map((endpoint) => endpoint.endpoint_id);
    expect(endpointStates).toContain("skipper-b");
    expect(endpointStates).not.toContain("skipper-a");
  });
});
