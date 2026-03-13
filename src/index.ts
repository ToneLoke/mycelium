export const myceliumPlugin = {
  id: "mycelium",
  name: "Mycelium",
  description: "Session routing for multi-agent OpenClaw systems.",
  async activate(api: any) {
    api.logger.info("Mycelium plugin activating");

    // TODO: initialize SQLite, seed agents, register hooks/tools/services
    // api.registerTool(createMyceliumSendTool(...))
    // api.on("session_start", ...)
    // api.on("session_end", ...)
    // api.on("subagent_spawned", ...)
    // api.registerService(...)
  },
};

export default myceliumPlugin;
