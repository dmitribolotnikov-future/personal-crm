import assert from "node:assert/strict";
import { test } from "node:test";

import type { getDb } from "../db";
import { contacts, contactGroupMemberships } from "../db/schema";
import { saveContact } from "./contact-mutations";
import { readContactValues } from "./form-state";
import { contactSchema } from "./validation";

function form(ids: (string | Blob)[] = []) {
  const data = new FormData();
  data.set("name", "Анна");
  for (const id of ids) data.append("groupIds", id);
  return data;
}

test("contact group ids parse zero, one, several and repeated selections", () => {
  for (const [input, expected] of [
    [[], []], [["1"], [1]], [["1", "2"], [1, 2]],
    [["1", "1", "2"], [1, 2]], [["2147483647"], [2147483647]],
  ] as [string[], number[]][]) {
    assert.deepEqual(contactSchema.parse(readContactValues(form(input))).groupIds, expected);
  }
});

test("contact group ids reject invalid values and database integer overflows", () => {
  for (const id of ["", "0", "-1", "1.1", "1e2", " 1", "1x", "2147483648", "999999999999999999", new Blob(["1"])]) {
    assert.equal(contactSchema.safeParse(readContactValues(form([id]))).success, false);
  }
});

function database({ missingGroup = false, failLinks = false, missingContact = false } = {}) {
  let state = { name: "Before", memberships: [3], writes: 0 };
  const events: string[] = [];
  const tx = {
    select: () => ({ from: (table: unknown) => ({ where: () => ({
      orderBy: () => ({ for: async () => { events.push("lock groups"); return missingGroup ? [{ id: 1 }] : [{ id: 1 }, { id: 2 }]; } }),
      for: async () => { assert.equal(table, contacts); events.push("lock contact"); return missingContact ? [] : [{ id: 5 }]; },
    }) }) }),
    insert: (table: unknown) => ({ values: (values: unknown) => {
      if (table === contacts) {
        state.name = (values as { name: string }).name; state.writes++;
        return { returning: async () => [{ id: 5 }] };
      }
      assert.equal(table, contactGroupMemberships);
      if (failLinks) throw new Error("Membership write failed");
      state.memberships = (values as { groupId: number }[]).map((row) => row.groupId);
      state.writes++;
      return Promise.resolve();
    } }),
    update: () => ({ set: (values: { name: string }) => ({ where: () => ({ returning: async () => {
      state.name = values.name; state.writes++; return [{ id: 5 }];
    } }) }) }),
    delete: () => ({ where: async () => { state.memberships = []; state.writes++; } }),
  };
  const db = { transaction: async (work: (transaction: unknown) => Promise<unknown>) => {
    const before = structuredClone(state);
    events.push("transaction");
    try { return await work(tx); } catch (error) { state = before; events.push("rollback"); throw error; }
  } } as unknown as ReturnType<typeof getDb>;
  return { db, state: () => state, events };
}

test("other field errors preserve selected groups and all input without writes", async () => {
  const { db, state } = database();
  const data = form(["1", "2"]);
  data.set("email", "invalid");
  const values = readContactValues(data);
  const result = await saveContact(db, values);
  assert.deepEqual("values" in result && result.values, values);
  assert.ok("errors" in result && result.errors?.email);
  assert.equal(state().writes, 0);
});

test("missing groups cannot partially create or update a contact", async () => {
  for (const id of [undefined, 5]) {
    const { db, state } = database({ missingGroup: true });
    const result = await saveContact(db, readContactValues(form(["1", "2"])), id);
    assert.ok("errors" in result && result.errors?.groupIds);
    assert.equal(state().writes, 0);
  }
});

test("membership failures roll back both contact changes and membership replacement", async () => {
  for (const id of [undefined, 5]) {
    const { db, state, events } = database({ failLinks: true });
    await assert.rejects(saveContact(db, readContactValues(form(["1", "2"])), id), /Membership write failed/);
    assert.deepEqual(state(), { name: "Before", memberships: [3], writes: 0 });
    assert.ok(events.includes("rollback"));
  }
});

test("saving a contact replaces the entire set and takes the required locks", async () => {
  const { db, state, events } = database();
  assert.deepEqual(await saveContact(db, readContactValues(form(["1", "2", "1"])), 5), { id: 5 });
  assert.deepEqual(state().memberships, [1, 2]);
  assert.equal(state().name, "Анна");
  assert.ok(events.includes("lock contact"));
  assert.ok(events.includes("lock groups"));
});

test("empty selection clears every membership", async () => {
  const { db, state } = database();
  await saveContact(db, readContactValues(form()), 5);
  assert.deepEqual(state().memberships, []);
});

test("a removed contact returns input without any write", async () => {
  const { db, state } = database({ missingContact: true });
  const values = readContactValues(form(["1", "2"]));
  const result = await saveContact(db, values, 5);
  assert.deepEqual("values" in result && result.values, values);
  assert.ok("message" in result && result.message);
  assert.equal(state().writes, 0);
});
