import "server-only";

import { asc, desc, eq, isNotNull, max } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { contacts, notes } from "@/db/schema";
import { getKeepInTouchState } from "@/lib/keep-in-touch";

// Each read calls connection() so it runs per request and never at build time

export async function listContacts() {
  await connection();
  return getDb()
    .select({ id: contacts.id, name: contacts.name, about: contacts.about })
    .from(contacts)
    .orderBy(asc(contacts.name), asc(contacts.id));
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
