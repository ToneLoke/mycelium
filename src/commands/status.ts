import type { MyceliumDb } from "../db/connection.js";

export function createStatusCommand(db: MyceliumDb) {
  return {
    id: "mycelium-status",
    name: "mycelium status",
    description: "Show endpoint and delivery health for Mycelium.",
    async execute() {
      const counts = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM endpoints WHERE state = 'healthy') AS healthy_endpoints,
          (SELECT COUNT(*) FROM endpoints WHERE state = 'suspect') AS suspect_endpoints,
          (SELECT COUNT(*) FROM endpoints WHERE state = 'stale') AS stale_endpoints,
          (SELECT COUNT(*) FROM endpoints WHERE state = 'dead') AS dead_endpoints,
          (SELECT COUNT(*) FROM deliveries WHERE state = 'queued') AS queued_deliveries,
          (SELECT COUNT(*) FROM deliveries WHERE state = 'acked') AS acked_deliveries,
          (SELECT COUNT(*) FROM deliveries WHERE state = 'dead_lettered') AS dead_lettered_deliveries
      `).get() as Record<string, number>;

      return {
        ok: true,
        summary: counts,
      };
    },
  };
}
