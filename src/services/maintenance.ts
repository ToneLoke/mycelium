import { pruneExpiredBindings } from "../db/bindings.js";
import type { MyceliumDb } from "../db/connection.js";
import { pruneHistoricalDeliveries } from "../db/deliveries.js";

export function createMaintenanceService(db: MyceliumDb) {
  let timer: NodeJS.Timeout | null = null;

  return {
    id: "mycelium-maintenance",
    async start() {
      const tick = () => {
        db.prepare(
          `UPDATE endpoints
           SET state = 'suspect', updated_at = datetime('now')
           WHERE state = 'healthy'
             AND last_seen_at IS NOT NULL
             AND last_seen_at < datetime('now', '-30 minutes')`,
        ).run();

        db.prepare(
          `UPDATE endpoints
           SET state = 'stale', updated_at = datetime('now')
           WHERE state = 'suspect'
             AND last_seen_at IS NOT NULL
             AND last_seen_at < datetime('now', '-2 hours')`,
        ).run();

        db.prepare(
          `UPDATE endpoints
           SET state = 'dead', updated_at = datetime('now')
           WHERE state = 'stale'
             AND last_seen_at IS NOT NULL
             AND last_seen_at < datetime('now', '-24 hours')`,
        ).run();

        pruneExpiredBindings(db);
        pruneHistoricalDeliveries(db);
      };

      tick();
      timer = setInterval(tick, 60_000);
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
