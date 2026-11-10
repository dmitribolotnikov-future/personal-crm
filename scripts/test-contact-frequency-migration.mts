import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { isolatedPool, legacyContactName } from "../e2e/helpers/database.ts";

const pool = isolatedPool();
const temporaryRoot = await realpath(tmpdir());
const folder = await mkdtemp(path.join(temporaryRoot, "crm-migration-test-"));

try {
  // Exercise the real migration chain starting with contacts and notes from the old schema.
  assert.equal(
    (await pool.query("select to_regclass('public.contacts') as table_name"))
      .rows[0].table_name,
    null,
  );
  const journal = JSON.parse(
    await readFile("drizzle/meta/_journal.json", "utf8"),
  );
  const oldEntries = journal.entries.filter(
    (entry: { idx: number }) => entry.idx < 2,
  );
  assert.equal(oldEntries.length, 2);
  await mkdir(path.join(folder, "meta"));
  await writeFile(
    path.join(folder, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries: oldEntries }),
  );
  for (const entry of oldEntries)
    await cp(`drizzle/${entry.tag}.sql`, path.join(folder, `${entry.tag}.sql`));
  await migrate(drizzle(pool), { migrationsFolder: folder });

  const { rows: oldContacts } = await pool.query(
    "insert into contacts (name, about, phone, email, workplace) values ($1, $2, $3, $4, $5), ($6, null, null, null, null) returning *",
    [
      legacyContactName,
      "Знакомый до обновления",
      "+79000000000",
      "legacy@example.com",
      "Старая компания",
      "Ещё один старый контакт",
    ],
  );
  const { rows: oldNotes } = await pool.query(
    "insert into notes (contact_id, body, created_at, updated_at) values ($1, $2, $3, $3) returning *",
    [oldContacts[0].id, "Заметка до обновления", "2020-01-01T12:00:00Z"],
  );

  // Keep this regression focused on the pre-login schema; login has its own fixture.
  const frequencyEntries = journal.entries.filter(
    (entry: { idx: number }) => entry.idx < 4,
  );
  await writeFile(
    path.join(folder, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries: frequencyEntries }),
  );
  for (const entry of frequencyEntries)
    await cp(`drizzle/${entry.tag}.sql`, path.join(folder, `${entry.tag}.sql`));
  await migrate(drizzle(pool), { migrationsFolder: folder });
  const { rows: newContacts } = await pool.query(
    "select * from contacts order by id",
  );
  assert.deepEqual(
    newContacts.map(
      ({ contact_frequency, contact_frequency_set_at, ...contact }) => {
        assert.equal(contact_frequency, null);
        assert.equal(contact_frequency_set_at, null);
        return contact;
      },
    ),
    oldContacts,
  );
  assert.deepEqual(
    (await pool.query("select * from notes order by id")).rows,
    oldNotes,
  );
  // A repeated deploy must leave both old data and settings intact.
  await migrate(drizzle(pool), { migrationsFolder: folder });
  assert.deepEqual(
    (await pool.query("select * from contacts order by id")).rows,
    newContacts,
  );
  console.log(
    "Contact frequency migration: passed (legacy contacts, notes, null defaults and repeat migration).",
  );
} finally {
  await pool.end();
  const resolvedFolder = await realpath(folder);
  if (
    path.dirname(resolvedFolder) !== temporaryRoot ||
    !path.basename(resolvedFolder).startsWith("crm-migration-test-")
  ) {
    throw new Error(
      "Refusing to remove a directory outside the migration test workspace.",
    );
  }
  await rm(resolvedFolder, { recursive: true });
}
