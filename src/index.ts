import { join } from "node:path";
import { createStatusCommand } from "./commands/status.js";
import { openMyceliumDb } from "./db/connection.js";
import { seedDefaults } from "./db/seed.js";
import { createSessionHooks } from "./hooks/session.js";
import { createSubagentHooks } from "./hooks/subagent.js";
import { createMaintenanceService } from "./services/maintenance.js";
import { createMyceliumSendTool } from "./tools/mycelium-send.js";

export const myceliumPlugin = {
  id: "mycelium",
  name: "Mycelium",
  description: "Session routing for multi-agent OpenClaw systems.",
  async activate(api: any) {
    api.logger.info("Mycelium plugin activating");

    const dbPath = join(api.resolvePath("~/.openclaw/state"), "mycelium.db");
    const db = openMyceliumDb(dbPath);
    seedDefaults(db);

    const sessionHooks = createSessionHooks(db);
    const subagentHooks = createSubagentHooks(db);

    api.registerTool((ctx: any) => {
      const tool = createMyceliumSendTool(db);
      return {
        ...tool,
        execute: (input: any) => tool.execute(input, { runtime: api.runtime, agentId: ctx?.agentId }),
      };
    });

    api.on("session_start", sessionHooks.onSessionStart);
    api.on("session_end", sessionHooks.onSessionEnd);
    api.on("message_sent", sessionHooks.onMessageSent);
    api.on("subagent_spawned", subagentHooks.onSubagentSpawned);
    api.on("subagent_ended", subagentHooks.onSubagentEnded);
    api.on("subagent_delivery_target", subagentHooks.onDeliveryTarget);

    if (typeof api.registerCommand === "function") {
      api.registerCommand(createStatusCommand(db));
    }

    api.registerService(createMaintenanceService(db));
  },
};

export default myceliumPlugin;
