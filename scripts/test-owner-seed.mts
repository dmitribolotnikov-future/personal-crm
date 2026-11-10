import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { isolatedPool } from "../e2e/helpers/database.ts";

const exec = promisify(execFile);
const pool = isolatedPool();
const ownerEmail = `seed-owner-${randomUUID()}@example.test`;
const otherEmail = `seed-other-${randomUUID()}@example.test`;
async function seed(email: string) {
  try {
    await exec(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/seed.mts"],
      { env: { ...process.env, LEGACY_OWNER_EMAIL: email } },
    );
  } catch {
    throw new Error("Demo seeding failed in the isolated fixture.");
  }
}
async function snapshot(email: string) {
  const contacts = (
    await pool.query(
      "select c.* from contacts c join auth_user u on u.id=c.owner_id where u.email=$1 order by c.id",
      [email],
    )
  ).rows;
  const notes = (
    await pool.query(
      "select n.* from notes n join contacts c on c.id=n.contact_id join auth_user u on u.id=c.owner_id where u.email=$1 order by n.id",
      [email],
    )
  ).rows;
  return { contacts, notes };
}
try {
  await assert.rejects(seed(""));
  await seed(otherEmail);
  const other = await snapshot(otherEmail);
  assert.equal(
    other.contacts.length,
    1000,
    "Other account has its own similar demo records",
  );
  assert.ok(other.notes.length > 0);
  await seed(ownerEmail);
  const owner = await snapshot(ownerEmail);
  assert.equal(owner.contacts.length, 1000);
  assert.ok(owner.notes.length > 0);
  assert.deepEqual(await snapshot(otherEmail), other);
  await seed(ownerEmail);
  assert.deepEqual(await snapshot(ownerEmail), owner);
  assert.deepEqual(await snapshot(otherEmail), other);
  console.log(
    "PASS demo seed belongs to owner and is safe to repeat; other account preserved",
  );
} finally {
  await pool.end();
}
