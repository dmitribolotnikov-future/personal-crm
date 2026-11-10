// The same entry point is used locally and by the one-off production container.
import nextEnv from "@next/env";
import { Pool } from "pg";
import { getConnectionConfig } from "../src/db/connection.ts";
import { applyMigrations } from "../src/db/migrate.ts";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const pool = new Pool(getConnectionConfig());
  try {
    const result = await applyMigrations(pool);
    console.log(
      `Migrations applied: ${result.added} new, ${result.total} in total.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error(
    "Migrations failed. Check LEGACY_OWNER_EMAIL and database configuration; the application must remain stopped.",
  );
  process.exitCode = 1;
});
