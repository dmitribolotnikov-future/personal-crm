import assert from "node:assert/strict";
import { test } from "vitest";

import { saveGroup } from "./group-mutations";
import type { getDb } from "../db";

function database({
  existingId,
  failure,
}: { existingId?: number; failure?: unknown } = {}) {
  const writes: unknown[] = [];
  const result = async (value: unknown) => {
    if (failure) throw failure;
    writes.push(value);
    return [{ id: 1 }];
  };
  const db = {
    select: () => ({
      from: () => ({
        where: async () => (existingId ? [{ id: existingId }] : []),
      }),
    }),
    insert: () => ({
      values: (value: unknown) => ({ returning: () => result(value) }),
    }),
    update: () => ({
      set: (value: unknown) => ({
        where: () => ({ returning: () => result(value) }),
      }),
    }),
  } as unknown as ReturnType<typeof getDb>;
  return { db, writes };
}

test("creating and renaming reject another group's normalized name and keep input", async () => {
  for (const id of [undefined, 2]) {
    const { db, writes } = database({ existingId: 1 });
    const state = await saveGroup(db, " друзья ", id);
    assert.equal(state.name, " друзья ");
    assert.deepEqual(state.errors, ["Группа с таким названием уже есть"]);
    assert.equal(writes.length, 0);
  }
});

test("renaming permits its own name and saves trimmed text", async () => {
  const { db, writes } = database({ existingId: 1 });
  assert.equal((await saveGroup(db, " ДРУЗЬЯ ", 1)).ok, true);
  assert.deepEqual(writes, [{ name: "ДРУЗЬЯ", normalizedName: "друзья" }]);
});

test("empty input is returned without a database write", async () => {
  const { db, writes } = database();
  const state = await saveGroup(db, "  ");
  assert.equal(state.name, "  ");
  assert.deepEqual(state.errors, ["Укажите название"]);
  assert.equal(writes.length, 0);
});

test("only the group name unique constraint becomes a form error, including wrapped pg errors", async () => {
  for (const wrapped of [false, true]) {
    const unique = {
      code: "23505",
      constraint: "contact_groups_normalized_name_unique",
    };
    const { db } = database({
      failure: wrapped ? new Error("Query failed", { cause: unique }) : unique,
    });
    const state = await saveGroup(db, "Друзья");
    assert.equal(state.name, "Друзья");
    assert.deepEqual(state.errors, ["Группа с таким названием уже есть"]);
  }
  for (const failure of [
    new Error("Offline"),
    { code: "23505", constraint: "other_unique" },
  ]) {
    const { db } = database({ failure });
    await assert.rejects(saveGroup(db, "Друзья"), (error) => error === failure);
  }
});

test("invalid group ids cannot reach a write", async () => {
  for (const id of [0, -1, 1.2, 2147483648]) {
    const { db, writes } = database();
    await assert.rejects(saveGroup(db, "Друзья", id));
    assert.equal(writes.length, 0);
  }
});
