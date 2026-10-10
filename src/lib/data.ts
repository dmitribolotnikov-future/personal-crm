import "server-only";

import { asc, desc, eq } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";

// Each read calls connection() so it runs per request and never at build time

export async function listContacts() {
  await connection();
  return db
    .select({ id: contacts.id, name: contacts.name, about: contacts.about })
    .from(contacts)
    .orderBy(asc(contacts.name), asc(contacts.id));
}

export type ContactSummary = Awaited<ReturnType<typeof listContacts>>[number];

export async function getContact(id: number) {
  await connection();
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
  return contact ?? null;
}

export async function listNotes(contactId: number) {
  await connection();
  return db
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}
