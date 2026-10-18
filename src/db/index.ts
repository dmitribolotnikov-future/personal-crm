import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getConnectionConfig } from "./connection";
import * as schema from "./schema";

function createDb() {
  return drizzle(new Pool(getConnectionConfig()), { schema });
}

// Kept on globalThis so dev hot reloads reuse one pool instead of opening a new one each time
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createDb> };

// Created on first use, not on import: `next build` imports this module
// in CI, where there are no database settings
export function getDb() {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}
