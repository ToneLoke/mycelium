import type { MyceliumDb } from "./connection.js";

export type TransportAdapterRecord = {
  transport_id: string;
  ack_level: string;
  supports_resume: number;
  supports_spawn: number;
  config: string | null;
};

export function getTransportAdapter(db: MyceliumDb, transportId: string): TransportAdapterRecord | undefined {
  return db
    .prepare(`SELECT * FROM transport_adapters WHERE transport_id = ?`)
    .get(transportId) as TransportAdapterRecord | undefined;
}

export function transportSupportsSpawn(db: MyceliumDb, transportId: string): boolean {
  return getTransportAdapter(db, transportId)?.supports_spawn === 1;
}
