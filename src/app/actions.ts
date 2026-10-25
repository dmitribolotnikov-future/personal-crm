"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { contacts, notes } from "@/db/schema";
import {
  contactFields,
  type ContactFormState,
  type ContactValues,
  type NoteFormState,
} from "@/lib/form-state";
import { contactSchema, idSchema, noteSchema } from "@/lib/validation";

// Text of the note that the "Связались" button adds
const CONTACTED_NOTE = "Связались";

function readContactValues(formData: FormData): ContactValues {
  return Object.fromEntries(
    contactFields.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as ContactValues;
}

// Mark every page stale so lists and cards show the change on the next visit
function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createContact(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = readContactValues(formData);
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors };
  }

  const [created] = await getDb()
    .insert(contacts)
    .values({
      ...parsed.data,
      // The countdown starts now if a frequency was chosen
      contactFrequencySetAt: parsed.data.contactFrequency ? sql`now()` : null,
    })
    .returning({ id: contacts.id });

  revalidateAll();
  redirect(`/contacts/${created.id}`);
}

export async function updateContact(
  contactId: number,
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const id = idSchema.parse(contactId);
  const values = readContactValues(formData);
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors };
  }

  // In SET the database still sees the old row, so this compares with the old frequency:
  // unchanged keeps the old moment, cleared drops it, changed starts the countdown now
  const newFrequency = sql`${parsed.data.contactFrequency}::text`;
  const updated = await getDb()
    .update(contacts)
    .set({
      ...parsed.data,
      contactFrequencySetAt: sql`case
        when ${contacts.contactFrequency} is not distinct from ${newFrequency} then ${contacts.contactFrequencySetAt}
        when ${newFrequency} is null then null
        else now()
      end`,
    })
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });
  if (updated.length === 0) {
    return { values, message: "Контакт не найден: возможно, его уже удалили" };
  }

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
