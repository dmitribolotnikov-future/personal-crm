"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import {
  contactFields,
  type ContactFormState,
  type ContactValues,
  type NoteFormState,
} from "@/lib/form-state";
import { contactSchema, idSchema, noteSchema } from "@/lib/validation";

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

  const [created] = await db
    .insert(contacts)
    .values(parsed.data)
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

  const updated = await db
    .update(contacts)
    .set(parsed.data)
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
  await db.delete(contacts).where(eq(contacts.id, id));

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

  await db.insert(notes).values({ contactId: id, body: parsed.data.body });

  revalidateAll();
  return { ok: true };
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

  const updated = await db
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
  await db.delete(notes).where(eq(notes.id, id));

  revalidateAll();
}
