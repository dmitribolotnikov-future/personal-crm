"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { contactGroups, contacts, notes } from "@/db/schema";
import {
  readContactValues,
  type ContactFormState,
  type GroupFormState,
  type NoteFormState,
} from "@/lib/form-state";
import { idSchema, noteSchema } from "@/lib/validation";
import { createGroupForContact, saveGroup } from "@/lib/group-mutations";
import { saveContact } from "@/lib/contact-mutations";

// Text of the note that the "Связались" button adds
const CONTACTED_NOTE = "Связались";

// Mark every page stale so lists and cards show the change on the next visit
function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createGroup(
  _prevState: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const state = await saveGroup(getDb(), String(formData.get("name") ?? ""));
  if (state.ok) revalidateAll();
  return state;
}

export async function renameGroup(
  groupId: number,
  _prevState: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const state = await saveGroup(
    getDb(),
    String(formData.get("name") ?? ""),
    groupId,
  );
  if (state.ok) revalidateAll();
  return state;
}

export async function createContactGroup(
  contactId: number,
  _prevState: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const state = await createGroupForContact(
    getDb(),
    contactId,
    String(formData.get("name") ?? ""),
  );
  if (state.ok) revalidateAll();
  return state;
}

export async function deleteGroup(groupId: number) {
  const id = idSchema.parse(groupId);
  await getDb().delete(contactGroups).where(eq(contactGroups.id, id));
  revalidateAll();
  redirect("/groups");
}

export async function createContact(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = readContactValues(formData);
  const result = await saveContact(getDb(), values);
  if (!("id" in result)) return result;

  revalidateAll();
  redirect(`/contacts/${result.id}`);
}

export async function updateContact(
  contactId: number,
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const id = idSchema.parse(contactId);
  const values = readContactValues(formData);
  const result = await saveContact(getDb(), values, id);
  if (!("id" in result)) return result;

  revalidateAll();
  redirect(`/contacts/${id}`);
}

export async function deleteContact(contactId: number) {
  const id = idSchema.parse(contactId);
  // Notes are removed by the database (ON DELETE CASCADE)
  await getDb().delete(contacts).where(eq(contacts.id, id));

  revalidateAll();
  redirect("/");
}

export async function addNote(
  contactId: number,
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const id = idSchema.parse(contactId);
  const body = String(formData.get("body") ?? "");
  const parsed = noteSchema.safeParse({ body });
  if (!parsed.success) {
    return { body, errors: z.flattenError(parsed.error).fieldErrors.body };
  }

  await getDb().insert(notes).values({ contactId: id, body: parsed.data.body });

  revalidateAll();
  return { ok: true };
}

// A plain note, so the countdown restarts by the usual rule; stays on the same page
export async function markContacted(contactId: number) {
  const id = idSchema.parse(contactId);
  // Inserted from a select, so nothing is added if the contact was deleted meanwhile
  // (drizzle's insert().select() wants every column of the table, hence plain SQL)
  await getDb().execute(sql`
    insert into ${notes} (${sql.identifier(notes.contactId.name)}, ${sql.identifier(notes.body.name)})
    select ${contacts.id}, ${CONTACTED_NOTE}::text
    from ${contacts}
    where ${contacts.id} = ${id}
  `);

  revalidateAll();
}

export async function updateNote(
  noteId: number,
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const id = idSchema.parse(noteId);
  const body = String(formData.get("body") ?? "");
  const parsed = noteSchema.safeParse({ body });
  if (!parsed.success) {
    return { body, errors: z.flattenError(parsed.error).fieldErrors.body };
  }

  const updated = await getDb()
    .update(notes)
    .set({ body: parsed.data.body })
    .where(eq(notes.id, id))
    .returning({ id: notes.id });
  if (updated.length === 0) {
    return { body, errors: ["Заметка не найдена: возможно, её уже удалили"] };
  }

  revalidateAll();
  return { ok: true };
}

export async function deleteNote(noteId: number) {
  const id = idSchema.parse(noteId);
  await getDb().delete(notes).where(eq(notes.id, id));

  revalidateAll();
}
