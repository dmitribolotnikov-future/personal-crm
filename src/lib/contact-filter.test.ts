import assert from "node:assert/strict";
import { test } from "node:test";

import { filterContacts, getContactFilterGroups, resolveGroupFilters } from "./contact-filter";

const contacts = [
  { id: 1, name: "Анна", groupIds: [1, 2] },
  { id: 2, name: "Борис", groupIds: [1] },
  { id: 3, name: "Семён", groupIds: [] },
];

test("all contacts includes ungrouped contacts and preserves order", () => {
  assert.deepEqual(filterContacts(contacts, "", []), contacts);
});

test("one group shows each member once and intersects name search", () => {
  assert.deepEqual(filterContacts(contacts, "", [2]), [contacts[0]]);
  assert.deepEqual(filterContacts(contacts, " анНА ", [1]), [contacts[0]]);
  assert.deepEqual(filterContacts(contacts, "Борис", [2]), []);
});

test("search retains case-insensitive and ё/е rules with no group", () => {
  assert.deepEqual(filterContacts(contacts, " СЕМЕН ", []), [contacts[2]]);
  assert.deepEqual(filterContacts(contacts, "аНнА", []), [contacts[0]]);
});

test("empty groups and unmatched names return no rows", () => {
  assert.deepEqual(filterContacts(contacts, "", [3]), []);
  assert.deepEqual(filterContacts(contacts, "Никто", []), []);
  assert.deepEqual(filterContacts([], "", []), []);
});

test("removed groups are dropped while remaining selections and name search stay active", () => {
  assert.deepEqual(resolveGroupFilters([1, 2], [{ id: 1 }]), [1]);
  assert.deepEqual(resolveGroupFilters([1, 1, 2], [{ id: 1 }, { id: 2 }]), [1, 2]);
  assert.deepEqual(resolveGroupFilters([], [{ id: 1 }]), []);
  assert.deepEqual(resolveGroupFilters([2], []), []);
  assert.deepEqual(filterContacts(contacts, "Борис", resolveGroupFilters([2], [])), [contacts[1]]);
});

test("multiple selected groups include people in any group exactly once and preserve order", () => {
  const rows = [...contacts, { id: 4, name: "Дарья", groupIds: [2] }];
  assert.deepEqual(filterContacts(rows, "", [1, 2]), [contacts[0], contacts[1], rows[3]]);
  assert.deepEqual(filterContacts(rows, " АННА ", [1, 2]), [contacts[0]]);
  assert.deepEqual(filterContacts(rows, "Борис", [1, 2]), [contacts[1]]);
  assert.deepEqual(filterContacts(rows, "Дарья", [1, 2]), [rows[3]]);
  assert.deepEqual(filterContacts(rows, "", [1, 3]), [contacts[0], contacts[1]]);
  assert.deepEqual(filterContacts(rows, "", [1, 1]), [contacts[0], contacts[1]]);
});

test("contact labels stay hidden without group filters", () => {
  assert.deepEqual(getContactFilterGroups([1, 2], []), []);
});

test("contact labels include only selected groups the contact belongs to", () => {
  const selected = [{ id: 2, name: "Теннис" }, { id: 4, name: "Работа" }];
  assert.deepEqual(getContactFilterGroups([1, 2, 3], selected), [selected[0]]);
  assert.deepEqual(getContactFilterGroups([], selected), []);
});

test("contact labels preserve selected group order without repeating memberships", () => {
  const selected = [{ id: 2, name: "Теннис" }, { id: 1, name: "Друзья" }];
  assert.deepEqual(getContactFilterGroups([1, 1, 2, 3], selected), selected);
  assert.deepEqual(getContactFilterGroups([1, 2], [selected[1]]), [selected[1]]);
});
