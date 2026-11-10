import { and, eq } from "drizzle-orm";

import type { getDb } from "@/db";
import { contactGroupMemberships, contactGroups, contacts } from "@/db/schema";
import type { GroupFormState } from "@/lib/form-state";
import { groupSchema, idSchema } from "@/lib/validation";

function isNameConflict(error: unknown): boolean {
  const visited = new Set<unknown>();
  while (error && typeof error === "object" && !visited.has(error)) {
    visited.add(error);
    if (
      "code" in error &&
      error.code === "23505" &&
      "constraint" in error &&
      error.constraint === "contact_groups_owner_name_unique"
    ) {
      return true;
    }
    error = "cause" in error ? error.cause : undefined;
  }
  return false;
}

export async function saveGroup(
  db: Pick<ReturnType<typeof getDb>, "select" | "insert" | "update">,
  ownerId: string,
  name: string,
  groupId?: number,
): Promise<GroupFormState> {
  if (!ownerId) throw new Error("A verified owner is required.");
  const id = groupId === undefined ? undefined : idSchema.parse(groupId);
  const parsed = groupSchema.safeParse({ name });
  if (!parsed.success) {
    return { name, errors: parsed.error.issues.map((issue) => issue.message) };
  }

  const duplicate = { name, errors: ["Группа с таким названием уже есть"] };
  const existing = await db
    .select({ id: contactGroups.id })
    .from(contactGroups)
    .where(
      and(
        eq(contactGroups.normalizedName, parsed.data.normalizedName),
        eq(contactGroups.ownerId, ownerId),
      ),
    );
  if (existing.some((group) => group.id !== id)) return duplicate;

  try {
    const rows =
      id === undefined
        ? await db
            .insert(contactGroups)
            .values({ ...parsed.data, ownerId })
            .returning({ id: contactGroups.id })
        : await db
            .update(contactGroups)
            .set(parsed.data)
            .where(
              and(eq(contactGroups.id, id), eq(contactGroups.ownerId, ownerId)),
            )
            .returning({ id: contactGroups.id });
    if (rows.length === 0) {
      return { name, errors: ["Группа не найдена: возможно, её уже удалили"] };
    }
    return { ok: true, groupId: rows[0].id };
  } catch (error) {
    if (isNameConflict(error)) return duplicate;
    throw error;
  }
}

class GroupSaveError extends Error {
  constructor(readonly state: GroupFormState) {
    super("Group cannot be created for contact");
  }
}

export async function createGroupForContact(
  db: ReturnType<typeof getDb>,
  ownerId: string,
  contactId: number,
  name: string,
): Promise<GroupFormState> {
  if (!ownerId) throw new Error("A verified owner is required.");
  const id = idSchema.parse(contactId);
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.ownerId, ownerId)))
        .for("update");
      if (existing.length === 0) {
        throw new GroupSaveError({
          name,
          errors: ["Контакт не найден: возможно, его уже удалили"],
        });
      }
      const state = await saveGroup(tx, ownerId, name);
      if (!state.ok || state.groupId === undefined) {
        throw new GroupSaveError(state);
      }
      await tx.insert(contactGroupMemberships).values({
        ownerId,
        contactId: id,
        groupId: state.groupId,
      });
      return state;
    });
  } catch (error) {
    if (error instanceof GroupSaveError) return error.state;
    throw error;
  }
}
