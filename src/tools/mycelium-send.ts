export type MyceliumSendInput = {
  to: string;
  message: string;
  taskId?: string;
  priority?: "low" | "normal" | "high";
  spawnIfNeeded?: boolean;
};

export function createMyceliumSendTool() {
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
      const runtime = ctx?.runtime;
      if (!runtime?.subagent?.run) {
        return { ok: false, error: "subagent runtime unavailable", input };
      }

      const sessionKey = `agent:${input.to}`;

      try {
        const result = await runtime.subagent.run({
          sessionKey,
          message: input.message,
          deliver: true,
          idempotencyKey: `mycelium:${ctx?.agentId ?? "unknown"}:${input.to}:${Date.now()}`,
        });

        return { ok: true, runId: result.runId, target: input.to, sessionKey };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          target: input.to,
          input,
        };
      }
    },
  };
}
