import { afterEach, describe, expect, it } from "vitest";
import type { MyceliumDb } from "../src/db/connection.js";
import { createTestDb } from "./helpers.js";

describe("schema", () => {
  const dbs: MyceliumDb[] = [];

  afterEach(() => {
    while (dbs.length) dbs.pop()?.close();
  });

  it("creates the core tables and indexes", () => {
    const db = createTestDb();
    dbs.push(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row: any) => row.name);

    expect(tables).toEqual(expect.arrayContaining([
      "agents",
      "conversation_bindings",
      "dead_letters",
      "deliveries",
      "delivery_attempts",
      "endpoints",
      "schema_migrations",
      "transport_adapters",
    ]));

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")
      .all()
      .map((row: any) => row.name);

    expect(indexes).toEqual(expect.arrayContaining([
      "idx_bindings_expires_at",
      "idx_dead_letters_delivery",
      "idx_deliveries_dedupe",
      "idx_endpoints_agent_state_seen",
    ]));
  });
});
