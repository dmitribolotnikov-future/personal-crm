"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { createUserData } from "@/lib/user-data";
import { createGroupForContact, saveGroup } from "@/lib/group-mutations";
import { saveContact } from "@/lib/contact-mutations";
import {
  readContactValues,
  type ContactFormState,
  type GroupFormState,
  type NoteFormState,
} from "@/lib/form-state";

function revalidateAll() {
  revalidatePath("/", "layout");
}
async function currentData() {
  const user = await requireUser();
  return createUserData(getDb(), user.id);
}

export async function createGroup(
  _prevState: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireUser();
  const state = await saveGroup(
    getDb(),
    user.id,
    String(formData.get("name") ?? ""),
  );
  if (state.ok) revalidateAll();
  return state;
}
export async function renameGroup(
  groupId: number,
  _prevState: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireUser();
  const state = await saveGroup(
    getDb(),
    user.id,
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
  const user = await requireUser();
  const state = await createGroupForContact(
    getDb(),
    user.id,
    contactId,
    String(formData.get("name") ?? ""),
  );
  if (state.ok) revalidateAll();
  return state;
}
export async function deleteGroup(groupId: number) {
  await (await currentData()).deleteGroup(groupId);
  revalidateAll();
  redirect("/groups");
}
export async function createContact(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const user = await requireUser();
  const result = await saveContact(
    getDb(),
    user.id,
    readContactValues(formData),
  );
  if (!("id" in result)) return result;
  revalidateAll();
  redirect(`/contacts/${result.id}`);
}
export async function updateContact(
  contactId: number,
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const user = await requireUser();
  const result = await saveContact(
    getDb(),
    user.id,
    readContactValues(formData),
    contactId,
  );
  if (!("id" in result)) return result;
  revalidateAll();
  redirect(`/contacts/${result.id}`);
}
export async function deleteContact(contactId: number) {
  await (await currentData()).deleteContact(contactId);
  revalidateAll();
  redirect("/");
}
export async function addNote(
  contactId: number,
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const result = await (
    await currentData()
  ).addNote(contactId, String(formData.get("body") ?? ""));
  if (result.ok) revalidateAll();
  return result;
}
export async function markContacted(contactId: number) {
  await (await currentData()).markContacted(contactId);
  revalidateAll();
}
export async function updateNote(
  noteId: number,
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const result = await (
    await currentData()
  ).updateNote(noteId, String(formData.get("body") ?? ""));
  if (result.ok) revalidateAll();
  return result;
}
export async function deleteNote(noteId: number) {
  await (await currentData()).deleteNote(noteId);
  revalidateAll();
}
