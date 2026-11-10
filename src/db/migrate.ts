import { drizzle } from "drizzle-orm/node-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";
import { getLegacyOwnerEmail } from "../lib/email.ts";

export async function applyMigrations(
  pool: Pool,
  env: Record<string, string | undefined> = process.env,
) {
  const client = await pool.connect();
  let locked = false;
  let discard = false;
  try {
    await client.query(
      "select pg_advisory_lock(hashtextextended('personal-crm:migrations', 0))",
    );
    locked = true;
    const exists = (
      await client.query(
        "select to_regclass('drizzle.__drizzle_migrations') is not null as found",
      )
    ).rows[0].found;
    const applied = exists
      ? (
          await client.query(
            "select count(*)::int as count, max(created_at) as latest from drizzle.__drizzle_migrations",
          )
        ).rows[0]
      : { count: 0, latest: 0 };
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    const ownership = migrations.find((migration) =>
      migration.sql.some((statement) =>
        statement.includes("crm.legacy_owner_email"),
      ),
    );
    if (ownership && Number(applied.latest) < ownership.folderMillis) {
      const email = getLegacyOwnerEmail(env);
      await client.query(
        "select set_config('crm.legacy_owner_email', $1, false)",
        [email],
      );
    }
    // A checked-out client keeps the validated input and backfill on one connection.
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    const total = (
      await client.query(
        "select count(*)::int as count from drizzle.__drizzle_migrations",
      )
    ).rows[0].count as number;
    return { added: total - applied.count, total };
  } finally {
    try {
      await client.query(
        "select set_config('crm.legacy_owner_email', '', false)",
      );
      if (locked)
        await client.query(
          "select pg_advisory_unlock(hashtextextended('personal-crm:migrations', 0))",
        );
    } catch {
      discard = true;
    }
    client.release(discard);
  }
}
