import assert from "node:assert/strict";
import { test } from "vitest";

import type { getDb } from "../db";
import { contactGroupMemberships, contactGroups, contacts } from "../db/schema";
import { createGroupForContact } from "./group-mutations";

function database({
  missingContact = false,
  duplicate = false,
  failLink = false,
} = {}) {
  let state = {
    groups: [] as unknown[],
    links: [{ contactId: 5, groupId: 3 }],
  };
  const events: string[] = [];
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === contacts)
            return {
              for: async () => {
                events.push("lock contact");
                return missingContact ? [] : [{ id: 5 }];
              },
            };
          assert.equal(table, contactGroups);
          return Promise.resolve(duplicate ? [{ id: 3 }] : []);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        if (table === contactGroups)
          return {
            returning: async () => {
              state.groups.push(values);
              return [{ id: 10 }];
            },
          };
        assert.equal(table, contactGroupMemberships);
        if (failLink) throw new Error("Membership insert failed");
        state.links.push(values as { contactId: number; groupId: number });
        return Promise.resolve();
      },
    }),
  };
  const db = {
    transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      const before = structuredClone(state);
      events.push("transaction");
      try {
        return await work(tx);
      } catch (error) {
        state = before;
        events.push("rollback");
        throw error;
      }
    },
  } as unknown as ReturnType<typeof getDb>;
  return { db, state: () => state, events };
}

test("inline group creation creates and assigns the group, preserving existing memberships", async () => {
  const { db, state, events } = database();
  const result = await createGroupForContact(db, 5, " Теннис ");
  assert.equal(result.ok, true);
  assert.deepEqual(state().groups, [
    { name: "Теннис", normalizedName: "теннис" },
  ]);
  assert.deepEqual(state().links, [
    { contactId: 5, groupId: 3 },
    { contactId: 5, groupId: 10 },
  ]);
  assert.deepEqual(events, ["transaction", "lock contact"]);
});

test("inline name errors preserve input and do not create a group or membership", async () => {
  for (const name of ["   ", " Друзья "]) {
    const { db, state } = database({ duplicate: name.trim().length > 0 });
    const result = await createGroupForContact(db, 5, name);
    assert.equal(result.name, name);
    assert.ok(result.errors?.length);
    assert.equal(state().groups.length, 0);
    assert.equal(state().links.length, 1);
  }
});

test("a deleted contact cannot leave a newly created empty group", async () => {
  const { db, state } = database({ missingContact: true });
  const result = await createGroupForContact(db, 5, "Теннис");
  assert.equal(result.name, "Теннис");
  assert.deepEqual(result.errors, [
    "Контакт не найден: возможно, его уже удалили",
  ]);
  assert.equal(state().groups.length, 0);
});

test("membership failures roll back creation without touching previous memberships", async () => {
  const { db, state, events } = database({ failLink: true });
  await assert.rejects(
    createGroupForContact(db, 5, "Теннис"),
    /Membership insert failed/,
  );
  assert.deepEqual(state(), {
    groups: [],
    links: [{ contactId: 5, groupId: 3 }],
  });
  assert.ok(events.includes("rollback"));
});

test("invalid contact ids cannot reach the transaction", async () => {
  for (const id of [0, -1, 1.5, 2147483648]) {
    const { db, events } = database();
    await assert.rejects(createGroupForContact(db, id, "Теннис"));
    assert.deepEqual(events, []);
  }
});
