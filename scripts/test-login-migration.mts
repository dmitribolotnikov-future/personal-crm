import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";
import { isolatedPool } from "../e2e/helpers/database.ts";
import { getConnectionConfig } from "../src/db/connection.ts";
import { applyMigrations } from "../src/db/migrate.ts";

const exec = promisify(execFile);
const pool = isolatedPool();
const ownerEmail = process.env.LEGACY_OWNER_EMAIL!;

async function snapshot() {
  const result: Record<string, unknown[]> = {};
  for (const table of [
    "contacts",
    "notes",
    "contact_groups",
    "contact_group_memberships",
  ]) {
    result[table] = (
      await pool.query(`select * from ${table} order by 1, 2`)
    ).rows;
  }
  return result;
}

try {
  const contact = (
    await pool.query(
      "insert into contacts (name, about, how_we_met, phone, email, workplace, contact_frequency, contact_frequency_set_at, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,'month','2024-02-29T12:00:00Z','2020-03-01T12:00:00Z','2024-02-29T12:00:00Z') returning id",
      [
        "Старый контакт",
        "Контекст",
        "Знакомство",
        "+79001112233",
        "contact@example.test",
        "Работа",
      ],
    )
  ).rows[0];
  await pool.query(
    "insert into notes (contact_id, body, created_at, updated_at) values ($1,$2,'2023-01-02T12:00:00Z','2023-01-03T12:00:00Z')",
    [contact.id, "Старая заметка"],
  );
  const group = (
    await pool.query(
      "insert into contact_groups (name, normalized_name, created_at, updated_at) values ('Друзья', 'друзья','2021-01-01T12:00:00Z','2022-01-01T12:00:00Z') returning id",
    )
  ).rows[0];
  await pool.query(
    "insert into contact_group_memberships (contact_id, group_id) values ($1,$2)",
    [contact.id, group.id],
  );
  const before = await snapshot();

  for (const invalid of ["", "invalid"]) {
    await assert.rejects(
      exec(
        process.execPath,
        ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.mts"],
        {
          env: { ...process.env, LEGACY_OWNER_EMAIL: invalid },
        },
      ),
      (error: unknown) =>
        /LEGACY_OWNER_EMAIL/.test(String((error as { stderr: string }).stderr)),
    );
    assert.deepEqual(await snapshot(), before);
    assert.equal(
      (await pool.query("select to_regclass('auth_user') as name")).rows[0]
        .name,
      null,
    );
  }
  console.log("PASS missing and invalid owner input fail before changes");

  await pool.query(
    "create function e2e_reject_backfill() returns trigger language plpgsql as $$ begin raise exception 'Intentional fixture failure'; end $$",
  );
  await pool.query(
    "create trigger e2e_reject_backfill before update on contacts for each row execute function e2e_reject_backfill()",
  );
  await assert.rejects(
    exec(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.mts"],
      { env: { ...process.env, LEGACY_OWNER_EMAIL: ownerEmail } },
    ),
  );
  assert.deepEqual(await snapshot(), before);
  assert.equal(
    (await pool.query("select to_regclass('auth_user') as name")).rows[0].name,
    null,
  );
  await pool.query("drop trigger e2e_reject_backfill on contacts");
  await pool.query("drop function e2e_reject_backfill()");
  console.log("PASS failed backfill rolls back every data and schema change");

  await exec(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.mts"],
    {
      env: {
        ...process.env,
        LEGACY_OWNER_EMAIL: ` ${ownerEmail.toUpperCase()} `,
      },
    },
  );
  const after = await snapshot();
  const owner = (
    await pool.query(
      "select id, email, email_verified from auth_user where email = $1",
      [ownerEmail],
    )
  ).rows[0];
  assert.ok(owner, "Legacy owner must be created");
  assert.equal(owner.email_verified, false);
  for (const [table, rows] of Object.entries(after)) {
    const preserved = rows.map((row) => {
      const { owner_id, ...fields } = row as Record<string, unknown>;
      if (table !== "notes") assert.equal(owner_id, owner.id, `${table} owner`);
      return fields;
    });
    assert.deepEqual(
      preserved,
      before[table],
      `${table}: counts, IDs, every field and relationship preserved`,
    );
  }
  console.log(
    "PASS legacy ownership backfill preserves all records and fields:",
    Object.fromEntries(
      Object.entries(after).map(([table, rows]) => [table, rows.length]),
    ),
  );

  await exec(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.mts"],
    { env: { ...process.env, LEGACY_OWNER_EMAIL: "" } },
  );
  assert.deepEqual(
    await snapshot(),
    after,
    "Repeat migration without owner input must not reassign data",
  );
  console.log(
    "PASS completed ownership migration needs no owner input and changes no data",
  );

  const otherId = randomUUID();
  await pool.query(
    "insert into auth_user (id, name, email) values ($1,'',$2)",
    [otherId, `other-${ownerEmail}`],
  );
  const otherGroup = (
    await pool.query(
      "insert into contact_groups (owner_id, name, normalized_name) values ($1,'Друзья','друзья') returning id",
      [otherId],
    )
  ).rows[0];
  await assert.rejects(
    pool.query(
      "insert into contact_group_memberships (owner_id, contact_id, group_id) values ($1,$2,$3)",
      [owner.id, contact.id, otherGroup.id],
    ),
    (error: unknown) => (error as { code: string }).code === "23503",
  );
  console.log(
    "PASS PostgreSQL rejects cross-owner memberships and permits identical group names across owners",
  );

  const databaseName = `crm_login_test_${randomUUID().replaceAll("-", "")}`;
  await pool.query(`create database "${databaseName}"`);
  const fresh = new Pool({ ...getConnectionConfig(), database: databaseName });
  try {
    await assert.rejects(
      applyMigrations(fresh, { LEGACY_OWNER_EMAIL: "" }),
      /LEGACY_OWNER_EMAIL/,
    );
    assert.equal(
      (await fresh.query("select to_regclass('contacts') as name")).rows[0]
        .name,
      null,
    );
    await applyMigrations(fresh, { LEGACY_OWNER_EMAIL: ownerEmail });
    assert.equal(
      (await fresh.query("select count(*)::int as n from contacts")).rows[0].n,
      0,
    );
    await applyMigrations(fresh, {
      LEGACY_OWNER_EMAIL: "changed@example.test",
    });
    assert.deepEqual((await fresh.query("select email from auth_user")).rows, [
      { email: ownerEmail },
    ]);
    console.log(
      "PASS fresh database migration and repeated migration preserve intended owner",
    );
  } finally {
    await fresh.end();
    await pool.query(`drop database "${databaseName}"`);
  }
} finally {
  await pool.end();
}
