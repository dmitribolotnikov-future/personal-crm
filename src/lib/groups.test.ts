import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeGroupName } from "./groups";
import { groupSchema } from "./validation";

test("group names reject empty or whitespace-only input", () => {
  for (const name of ["", " ", "\t\n"]) {
    assert.equal(groupSchema.safeParse({ name }).success, false);
  }
});

test("group names trim display text and normalize Cyrillic case", () => {
  assert.deepEqual(groupSchema.parse({ name: "  Друзья  " }), {
    name: "Друзья",
    normalizedName: "друзья",
  });
  assert.equal(normalizeGroupName("Друзья"), normalizeGroupName(" друзья "));
  assert.equal(normalizeGroupName(" ЁЖ "), "ёж");
});

test("group normalization preserves inner spaces and distinguishes е and ё", () => {
  assert.equal(normalizeGroupName(" A  B "), "a  b");
  assert.notEqual(normalizeGroupName("Все"), normalizeGroupName("Всё"));
});
