import type { MyceliumDb } from "../db/connection.js";
import { deliverMessage } from "../router/deliver.js";

export type MyceliumSendInput = {
  to: string;
  message: string;
  taskId?: string;
  priority?: "low" | "normal" | "high";
  spawnIfNeeded?: boolean;
};

export function createMyceliumSendTool(db: MyceliumDb) {
  return {
    name: "mycelium_send",
    description: "Send a message to another agent by stable name.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        message: { type: "string" },
        taskId: { type: "string" },
        priority: { type: "string", enum: ["low", "normal", "high"] },
        spawnIfNeeded: { type: "boolean" },
      },
      required: ["to", "message"],
    },
    async execute(input: MyceliumSendInput, ctx?: { runtime?: any; agentId?: string }) {
      if (!input.to.trim()) {
        return { ok: false, error: "target agent is required" };
      }

      if (!input.message.trim()) {
        return { ok: false, error: "message is required" };
      }

      return deliverMessage(db, ctx?.runtime, {
        fromAgentId: ctx?.agentId,
        toAgentId: input.to.trim(),
        messageBody: input.message,
        taskId: input.taskId,
        priority: input.priority,
        spawnIfNeeded: input.spawnIfNeeded ?? true,
      });
    },
  };
}
