import Database from "better-sqlite3";
import type { MyceliumDb } from "../src/db/connection.js";
import { SCHEMA_SQL } from "../src/db/schema.js";
import { seedDefaults } from "../src/db/seed.js";

export function createTestDb(): MyceliumDb {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  seedDefaults(db);
  return db;
}
