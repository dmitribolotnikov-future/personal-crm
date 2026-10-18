// Applies pending migrations from drizzle/ and exits; non-zero exit code on failure.
// The server runs it in a one-off container from the new image before that image starts
// (deploy/deploy.sh). Locally `pnpm db:migrate` (drizzle-kit) does the same job.

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Explicit .ts extension lets the app image run this file with plain node
import { getConnectionConfig } from "../src/db/connection.ts";

// Where drizzle records applied migrations (drizzle-orm default)
const MIGRATIONS_TABLE = "drizzle.__drizzle_migrations";

async function countApplied(pool: Pool): Promise<number> {
  // Before the very first migration the table does not exist yet
  const exists = await pool.query<{ found: boolean }>(
    `select to_regclass('${MIGRATIONS_TABLE}') is not null as found`,
  );
  if (!exists.rows[0].found) return 0;
  const { rows } = await pool.query<{ count: number }>(
    `select count(*)::int as count from ${MIGRATIONS_TABLE}`,
  );
  return rows[0].count;
}

async function main() {
  const pool = new Pool(getConnectionConfig());
  try {
    const before = await countApplied(pool);
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    const after = await countApplied(pool);
    console.log(`Migrations applied: ${after - before} new, ${after} in total.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migrations failed:", error);
  process.exit(1);
});
