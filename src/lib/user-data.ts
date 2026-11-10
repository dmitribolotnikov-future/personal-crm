import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import type { getDb } from "../db/index.ts";
import {
  contactGroupMemberships,
  contactGroups,
  contacts,
  notes,
} from "../db/schema.ts";
import { selectOverdueContacts } from "./keep-in-touch.ts";
import { idSchema, noteSchema } from "./validation.ts";
import type { NoteFormState } from "./form-state.ts";

// Callers obtain this required owner from the verified server session.
export function createUserData(db: ReturnType<typeof getDb>, ownerId: string) {
  if (!ownerId) throw new Error("A verified owner is required.");
  const ownedContacts = db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.ownerId, ownerId));
  const ownedNote = (id: number) =>
    and(
      eq(notes.id, idSchema.parse(id)),
      inArray(notes.contactId, ownedContacts),
    );
  const ownedContact = (id: number) =>
    and(eq(contacts.id, idSchema.parse(id)), eq(contacts.ownerId, ownerId));
  const ownedGroup = (id: number) =>
    and(
      eq(contactGroups.id, idSchema.parse(id)),
      eq(contactGroups.ownerId, ownerId),
    );
  return {
    async listGroups() {
      return db
        .select({ id: contactGroups.id, name: contactGroups.name })
        .from(contactGroups)
        .where(eq(contactGroups.ownerId, ownerId))
        .orderBy(asc(contactGroups.name), asc(contactGroups.id));
    },
    async getGroup(id: number) {
      const [row] = await db
        .select({ id: contactGroups.id, name: contactGroups.name })
        .from(contactGroups)
        .where(ownedGroup(id));
      return row ?? null;
    },
    async listGroupContacts(groupId: number) {
      return db
        .select({ id: contacts.id, name: contacts.name, about: contacts.about })
        .from(contacts)
        .innerJoin(
          contactGroupMemberships,
          and(
            eq(contacts.id, contactGroupMemberships.contactId),
            eq(contactGroupMemberships.ownerId, ownerId),
          ),
        )
        .innerJoin(
          contactGroups,
          eq(contactGroups.id, contactGroupMemberships.groupId),
        )
        .where(and(eq(contacts.ownerId, ownerId), ownedGroup(groupId)))
        .orderBy(asc(contacts.name), asc(contacts.id));
    },
    async listContacts() {
      const [rows, memberships] = await Promise.all([
        db
          .select({
            id: contacts.id,
            name: contacts.name,
            about: contacts.about,
          })
          .from(contacts)
          .where(eq(contacts.ownerId, ownerId))
          .orderBy(asc(contacts.name), asc(contacts.id)),
        db
          .select({
            contactId: contactGroupMemberships.contactId,
            groupId: contactGroupMemberships.groupId,
          })
          .from(contactGroupMemberships)
          .where(eq(contactGroupMemberships.ownerId, ownerId))
          .orderBy(asc(contactGroupMemberships.groupId)),
      ]);
      const groups = new Map<number, number[]>();
      for (const row of memberships) {
        const ids = groups.get(row.contactId) ?? [];
        ids.push(row.groupId);
        groups.set(row.contactId, ids);
      }
      return rows.map((row) => ({
        ...row,
        groupIds: groups.get(row.id) ?? [],
      }));
    },
    async listContactGroups(contactId: number) {
      return db
        .select({ id: contactGroups.id, name: contactGroups.name })
        .from(contactGroups)
        .innerJoin(
          contactGroupMemberships,
          and(
            eq(contactGroups.id, contactGroupMemberships.groupId),
            eq(contactGroupMemberships.ownerId, ownerId),
          ),
        )
        .where(
          and(
            eq(contactGroupMemberships.contactId, idSchema.parse(contactId)),
            eq(contactGroups.ownerId, ownerId),
          ),
        )
        .orderBy(asc(contactGroups.name), asc(contactGroups.id));
    },
    async listOverdueContacts() {
      const rows = await db
        .select({
          id: contacts.id,
          name: contacts.name,
          contactFrequency: contacts.contactFrequency,
          contactFrequencySetAt: contacts.contactFrequencySetAt,
          lastNoteAt: max(notes.createdAt),
        })
        .from(contacts)
        .leftJoin(notes, eq(notes.contactId, contacts.id))
        .where(
          and(
            eq(contacts.ownerId, ownerId),
            isNotNull(contacts.contactFrequency),
          ),
        )
        .groupBy(contacts.id)
        .orderBy(asc(contacts.name), asc(contacts.id));
      return selectOverdueContacts(rows, new Date());
    },
    async getContact(id: number) {
      const [row] = await db.select().from(contacts).where(ownedContact(id));
      return row ?? null;
    },
    async listNotes(contactId: number) {
      return db
        .select({
          id: notes.id,
          contactId: notes.contactId,
          body: notes.body,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
        })
        .from(notes)
        .innerJoin(contacts, eq(contacts.id, notes.contactId))
        .where(ownedContact(contactId))
        .orderBy(desc(notes.createdAt), desc(notes.id));
    },
    async deleteContact(id: number) {
      await db.delete(contacts).where(ownedContact(id));
    },
    async deleteGroup(id: number) {
      await db.delete(contactGroups).where(ownedGroup(id));
    },
    async addNote(contactId: number, body: string): Promise<NoteFormState> {
      const id = idSchema.parse(contactId);
      const parsed = noteSchema.safeParse({ body });
      if (!parsed.success)
        return {
          body,
          errors: parsed.error.issues.map((issue) => issue.message),
        };
      const result = await db.execute(
        sql`insert into ${notes} (contact_id, body) select ${contacts.id}, ${parsed.data.body}::text from ${contacts} where ${contacts.id}=${id} and ${contacts.ownerId}=${ownerId} returning id`,
      );
      return result.rowCount
        ? { ok: true }
        : { body, errors: ["Контакт не найден"] };
    },
    async updateNote(noteId: number, body: string): Promise<NoteFormState> {
      const parsed = noteSchema.safeParse({ body });
      if (!parsed.success)
        return {
          body,
          errors: parsed.error.issues.map((issue) => issue.message),
        };
      const rows = await db
        .update(notes)
        .set({ body: parsed.data.body })
        .where(ownedNote(noteId))
        .returning({ id: notes.id });
      return rows.length
        ? { ok: true }
        : { body, errors: ["Заметка не найдена: возможно, её уже удалили"] };
    },
    async deleteNote(id: number) {
      await db.delete(notes).where(ownedNote(id));
    },
    async markContacted(contactId: number) {
      const id = idSchema.parse(contactId);
      await db.execute(
        sql`insert into ${notes} (contact_id, body) select ${contacts.id}, 'Связались'::text from ${contacts} where ${contacts.id}=${id} and ${contacts.ownerId}=${ownerId}`,
      );
    },
  };
}
