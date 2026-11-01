import "server-only";

import { asc, desc, eq, isNotNull, max } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { contactGroupMemberships, contactGroups, contacts, notes } from "@/db/schema";
import { getKeepInTouchState } from "@/lib/keep-in-touch";

// Each read calls connection() so it runs per request and never at build time

export async function listGroups() {
  await connection();
  return getDb().select({ id: contactGroups.id, name: contactGroups.name })
    .from(contactGroups).orderBy(asc(contactGroups.name), asc(contactGroups.id));
}

export type GroupSummary = Awaited<ReturnType<typeof listGroups>>[number];

export async function getGroup(id: number) {
  await connection();
  const [group] = await getDb()
    .select({ id: contactGroups.id, name: contactGroups.name })
    .from(contactGroups)
    .where(eq(contactGroups.id, id));
  return group ?? null;
}

export async function listGroupContacts(groupId: number) {
  await connection();
  return getDb()
    .select({ id: contacts.id, name: contacts.name, about: contacts.about })
    .from(contacts)
    .innerJoin(contactGroupMemberships, eq(contacts.id, contactGroupMemberships.contactId))
    .where(eq(contactGroupMemberships.groupId, groupId))
    .orderBy(asc(contacts.name), asc(contacts.id));
}

export async function listContacts() {
  await connection();
  const [rows, memberships] = await Promise.all([getDb()
    .select({ id: contacts.id, name: contacts.name, about: contacts.about })
    .from(contacts)
    .orderBy(asc(contacts.name), asc(contacts.id)),
    getDb().select().from(contactGroupMemberships),
  ]);
  const groupIds = new Map<number, number[]>();
  for (const membership of memberships) {
    const ids = groupIds.get(membership.contactId) ?? [];
    ids.push(membership.groupId);
    groupIds.set(membership.contactId, ids);
  }
  return rows.map((contact) => ({ ...contact, groupIds: groupIds.get(contact.id) ?? [] }));
}

export async function listContactGroups(contactId: number) {
  await connection();
  return getDb().select({ id: contactGroups.id, name: contactGroups.name })
    .from(contactGroups)
    .innerJoin(contactGroupMemberships, eq(contactGroups.id, contactGroupMemberships.groupId))
    .where(eq(contactGroupMemberships.contactId, contactId))
    .orderBy(asc(contactGroups.name), asc(contactGroups.id));
}

export type ContactSummary = Awaited<ReturnType<typeof listContacts>>[number];

// Contacts whose time to talk has passed, the most overdue first
export async function listOverdueContacts() {
  await connection();
  const rows = await getDb()
    .select({
      id: contacts.id,
      name: contacts.name,
      contactFrequency: contacts.contactFrequency,
      contactFrequencySetAt: contacts.contactFrequencySetAt,
      lastNoteAt: max(notes.createdAt),
    })
    .from(contacts)
    .leftJoin(notes, eq(notes.contactId, contacts.id))
    .where(isNotNull(contacts.contactFrequency))
    .groupBy(contacts.id)
    // Same order as listContacts; the sort below is stable, so equal overdue keeps it
    .orderBy(asc(contacts.name), asc(contacts.id));

  const now = new Date();
  return rows
    .flatMap((row) => {
      const state = getKeepInTouchState(
        {
          frequency: row.contactFrequency,
          lastNoteAt: row.lastNoteAt,
          frequencySetAt: row.contactFrequencySetAt,
        },
        now,
      );
      return state?.overdue
        ? [{ id: row.id, name: row.name, overdueDays: state.overdueDays }]
        : [];
    })
    .sort((a, b) => b.overdueDays - a.overdueDays);
}

export async function getContact(id: number) {
  await connection();
  const [contact] = await getDb().select().from(contacts).where(eq(contacts.id, id));
  return contact ?? null;
}

export async function listNotes(contactId: number) {
  await connection();
  return getDb()
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}
