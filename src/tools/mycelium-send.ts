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
        spawnIfNeeded: { type: "boolean" }
      },
      required: ["to", "message"]
    },
    async execute(input: MyceliumSendInput) {
      return { ok: false, todo: true, input };
    }
  };
}
