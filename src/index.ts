import { join } from "node:path";
import { openMyceliumDb } from "./db/connection.js";
import { seedDefaults } from "./db/seed.js";
import { createSessionHooks } from "./hooks/session.js";
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

    api.registerTool((ctx: any) => {
      const tool = createMyceliumSendTool();
      return {
        ...tool,
        execute: (input: any) => tool.execute(input, { runtime: api.runtime, agentId: ctx?.agentId }),
      };
    });

    api.on("session_start", sessionHooks.onSessionStart);
    api.on("session_end", sessionHooks.onSessionEnd);
    api.registerService(createMaintenanceService(db));
  },
};

export default myceliumPlugin;
