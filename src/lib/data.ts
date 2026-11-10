import "server-only";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { createUserData } from "@/lib/user-data";

async function currentData() {
  const user = await requireUser();
  return createUserData(getDb(), user.id);
}

export async function listGroups() {
  return (await currentData()).listGroups();
}
export async function getGroup(id: number) {
  return (await currentData()).getGroup(id);
}
export async function listGroupContacts(id: number) {
  return (await currentData()).listGroupContacts(id);
}
export async function listContacts() {
  return (await currentData()).listContacts();
}
export async function listContactGroups(id: number) {
  return (await currentData()).listContactGroups(id);
}
export async function listOverdueContacts() {
  return (await currentData()).listOverdueContacts();
}
export async function getContact(id: number) {
  return (await currentData()).getContact(id);
}
export async function listNotes(id: number) {
  return (await currentData()).listNotes(id);
}
export type GroupSummary = Awaited<ReturnType<typeof listGroups>>[number];
export type ContactSummary = Awaited<ReturnType<typeof listContacts>>[number];
