import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { isolatedPool } from "../e2e/helpers/database.ts";
import * as schema from "../src/db/schema.ts";
import { createUserData } from "../src/lib/user-data.ts";
import { saveContact } from "../src/lib/contact-mutations.ts";
import {
  createGroupForContact,
  saveGroup,
} from "../src/lib/group-mutations.ts";
import { readContactValues } from "../src/lib/form-state.ts";

const pool = isolatedPool();
const db = drizzle(pool, { schema });
const ownerA = randomUUID();
const ownerB = randomUUID();
const dataA = createUserData(db, ownerA);
const dataB = createUserData(db, ownerB);
async function run(name: string, check: () => Promise<void>) {
  await check();
  console.log(`PASS ${name}`);
}
function values(name: string, groups: number[] = []) {
  const form = new FormData();
  form.set("name", name);
  form.set("contactFrequency", "week");
  for (const id of groups) form.append("groupIds", String(id));
  return readContactValues(form);
}
async function snapshot() {
  const result = {} as Record<string, unknown[]>;
  for (const table of [
    "contacts",
    "notes",
    "contact_groups",
    "contact_group_memberships",
  ])
    result[table] = (
      await pool.query(`select * from ${table} order by 1,2`)
    ).rows;
  return result;
}

try {
  await pool.query("insert into auth_user (id,email) values ($1,$2),($3,$4)", [
    ownerA,
    `a-${ownerA}@example.test`,
    ownerB,
    `b-${ownerB}@example.test`,
  ]);
  assert.throws(() => createUserData(db, ""), /owner/i);
  const groupA = (await saveGroup(db, ownerA, "Друзья")).groupId!;
  const groupB = (await saveGroup(db, ownerB, "Друзья")).groupId!;
  const resultA = await saveContact(
    db,
    ownerA,
    Object.assign(values(`Контакт A ${ownerA}`, [groupA]), { ownerId: ownerB }),
  );
  const resultB = await saveContact(
    db,
    ownerB,
    values(`Контакт B ${ownerB}`, [groupB]),
  );
  assert.ok("id" in resultA);
  assert.ok("id" in resultB);
  const idA = resultA.id;
  const idB = resultB.id;
  await dataA.addNote(idA, "Секретная заметка A");
  const noteA = (await dataA.listNotes(idA))[0].id;
  await pool.query(
    "update contacts set contact_frequency_set_at='2020-01-01T12:00:00Z' where id=any($1)",
    [[idA, idB]],
  );
  await pool.query(
    "update notes set created_at='2020-01-01T12:00:00Z',updated_at='2020-01-01T12:00:00Z' where id=$1",
    [noteA],
  );

  await run(
    "owner spoofing and cross-owner assignment cannot change data",
    async () => {
      assert.equal((await dataA.getContact(idA))!.ownerId, ownerA);
      const before = await snapshot();
      assert.ok(
        !(
          "id" in
          (await saveContact(
            db,
            ownerB,
            values("Forged update", [groupA]),
            idB,
          ))
        ),
      );
      assert.ok(
        !(
          "id" in
          (await saveContact(db, ownerB, values("Forged create", [groupA])))
        ),
      );
      assert.deepEqual(await snapshot(), before);
    },
  );
  await run(
    "foreign contact reads match missing contact behavior",
    async () => {
      for (const data of [dataA, dataB]) {
        const own = data === dataA ? idA : idB;
        const foreign = data === dataA ? idB : idA;
        assert.ok(await data.getContact(own));
        assert.equal(await data.getContact(foreign), null);
        assert.equal(await data.getContact(2147483647), null);
        assert.deepEqual(
          (await data.listContacts()).map((row) => row.id),
          [own],
        );
      }
    },
  );
  await run("foreign contact update and delete are refused", async () => {
    const before = await snapshot();
    assert.ok(
      !("id" in (await saveContact(db, ownerB, values("Stolen"), idA))),
    );
    await dataB.deleteContact(idA);
    assert.deepEqual(await snapshot(), before);
  });
  await run(
    "foreign note reads and writes and mark-contacted are refused",
    async () => {
      const before = await snapshot();
      assert.deepEqual(await dataB.listNotes(idA), []);
      assert.equal((await dataB.addNote(idA, "Foreign note")).ok, undefined);
      assert.equal(
        (await dataB.updateNote(noteA, "Changed note")).ok,
        undefined,
      );
      await dataB.deleteNote(noteA);
      await dataB.markContacted(idA);
      assert.deepEqual(await snapshot(), before);
      assert.equal((await dataB.addNote(idB, "Own note")).ok, true);
      const ownNote = (await dataB.listNotes(idB))[0].id;
      assert.equal(
        (await dataB.updateNote(ownNote, "Own edited note")).ok,
        true,
      );
      await dataB.deleteNote(ownNote);
      await dataB.markContacted(idB);
      assert.equal((await dataB.listNotes(idB))[0].body, "Связались");
    },
  );
  await run(
    "foreign group operations and inline creation are refused",
    async () => {
      const before = await snapshot();
      assert.equal(await dataB.getGroup(groupA), null);
      assert.deepEqual(await dataB.listGroupContacts(groupA), []);
      assert.equal(
        (await saveGroup(db, ownerB, "Stolen", groupA)).ok,
        undefined,
      );
      await dataB.deleteGroup(groupA);
      assert.equal(
        (await createGroupForContact(db, ownerB, idA, "Partial group")).ok,
        undefined,
      );
      assert.deepEqual(await snapshot(), before);
      assert.equal(
        (await createGroupForContact(db, ownerB, idB, "Своя группа")).ok,
        true,
      );
    },
  );
  await run(
    "foreign groups never enter selectors filters or serialized results",
    async () => {
      assert.deepEqual(await dataB.listContactGroups(idA), []);
      assert.ok((await dataB.listGroups()).every((row) => row.id !== groupA));
      const serialized = JSON.stringify(await dataB.listContacts());
      assert.ok(!serialized.includes(String(idA) + ","));
      assert.deepEqual((await dataB.listContacts())[0].groupIds, [
        groupB,
        (await dataB.listGroups()).find((row) => row.name === "Своя группа")!
          .id,
      ]);
    },
  );
  await run("overdue results exclude every other owner", async () => {
    assert.deepEqual(
      (await dataA.listOverdueContacts()).map((row) => row.id),
      [idA],
    );
    assert.deepEqual(
      await dataB.listOverdueContacts(),
      [],
      "Foreign overdue contact cannot produce a block for B",
    );
  });
  await run(
    "created group belongs to the current user and starts empty",
    async () => {
      const created = await saveGroup(db, ownerB, "Пустая группа");
      assert.equal(created.ok, true);
      assert.deepEqual(await dataB.listGroupContacts(created.groupId!), []);
      assert.equal(await dataA.getGroup(created.groupId!), null);
    },
  );
  await run("account without contacts can create a group", async () => {
    const owner = randomUUID();
    await pool.query("insert into auth_user (id,email) values ($1,$2)", [
      owner,
      `${owner}@example.test`,
    ]);
    assert.equal((await saveGroup(db, owner, "Семья")).ok, true);
  });
  await run(
    "different owners can create and rename identical group names",
    async () => {
      assert.notEqual(groupA, groupB);
      const group = await saveGroup(db, ownerB, "Временная");
      const before = await dataA.listGroupContacts(groupA);
      await dataB.deleteGroup(groupB);
      assert.equal(
        (await saveGroup(db, ownerB, " друзья ", group.groupId)).ok,
        true,
      );
      assert.deepEqual(await dataA.listGroupContacts(groupA), before);
    },
  );
  await run("own duplicate group creation is rejected", async () => {
    assert.ok((await saveGroup(db, ownerA, " друзья ")).errors?.length);
  });
  await run("own duplicate group rename preserves both groups", async () => {
    const group = await saveGroup(db, ownerA, "Теннис");
    const before = await snapshot();
    assert.ok(
      (await saveGroup(db, ownerA, "ДРУЗЬЯ", group.groupId)).errors?.length,
    );
    assert.deepEqual(await snapshot(), before);
  });
} finally {
  await pool.end();
}
