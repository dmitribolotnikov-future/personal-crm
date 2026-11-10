import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { getDb } from "@/db";
import { contactGroupMemberships, contactGroups, contacts } from "@/db/schema";
import type { ContactFormState, ContactValues } from "@/lib/form-state";
import { contactSchema, idSchema } from "@/lib/validation";

class ContactSaveError extends Error {
  constructor(readonly state: ContactFormState) {
    super("Contact cannot be saved");
  }
}

export async function saveContact(
  db: ReturnType<typeof getDb>,
  ownerId: string,
  values: ContactValues,
  contactId?: number,
): Promise<ContactFormState | { id: number }> {
  if (!ownerId) throw new Error("A verified owner is required.");
  const id = contactId === undefined ? undefined : idSchema.parse(contactId);
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors };
  }
  const { groupIds, ...fields } = parsed.data;

  try {
    return await db.transaction(async (tx) => {
      if (id !== undefined) {
        const existing = await tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(eq(contacts.id, id), eq(contacts.ownerId, ownerId)))
          .for("update");
        if (existing.length === 0) {
          throw new ContactSaveError({
            values,
            message: "Контакт не найден: возможно, его уже удалили",
          });
        }
      }
      if (groupIds.length > 0) {
        // Lock in a stable order; key-share prevents deletion until commit.
        const selected = await tx
          .select({ id: contactGroups.id })
          .from(contactGroups)
          .where(
            and(
              inArray(contactGroups.id, groupIds),
              eq(contactGroups.ownerId, ownerId),
            ),
          )
          .orderBy(asc(contactGroups.id))
          .for("key share");
        if (selected.length !== groupIds.length) {
          throw new ContactSaveError({
            values,
            errors: {
              groupIds: [
                "Одну из выбранных групп уже удалили. Обновите страницу и выберите группы заново",
              ],
            },
          });
        }
      }

      const newFrequency = sql`${fields.contactFrequency}::text`;
      const [saved] =
        id === undefined
          ? await tx
              .insert(contacts)
              .values({
                ...fields,
                ownerId,
                contactFrequencySetAt: fields.contactFrequency
                  ? sql`now()`
                  : null,
              })
              .returning({ id: contacts.id })
          : await tx
              .update(contacts)
              .set({
                ...fields,
                // SET compares against the old row, preserving the existing countdown.
                contactFrequencySetAt: sql`case
              when ${contacts.contactFrequency} is not distinct from ${newFrequency} then ${contacts.contactFrequencySetAt}
              when ${newFrequency} is null then null
              else now()
            end`,
              })
              .where(and(eq(contacts.id, id), eq(contacts.ownerId, ownerId)))
              .returning({ id: contacts.id });

      if (id !== undefined) {
        await tx
          .delete(contactGroupMemberships)
          .where(
            and(
              eq(contactGroupMemberships.contactId, saved.id),
              eq(contactGroupMemberships.ownerId, ownerId),
            ),
          );
      }
      if (groupIds.length > 0) {
        await tx.insert(contactGroupMemberships).values(
          groupIds.map((groupId) => ({
            ownerId,
            contactId: saved.id,
            groupId,
          })),
        );
      }
      return { id: saved.id };
    });
  } catch (error) {
    if (error instanceof ContactSaveError) return error.state;
    throw error;
  }
}
