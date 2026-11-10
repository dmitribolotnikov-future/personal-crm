import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema.ts";

// Both values come from the database clock: equal on insert, later after any update
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
};

// How often the owner wants to talk to a contact; null means "not set"
export const contactFrequencies = ["week", "month", "quarter", "year"] as const;
export type ContactFrequency = (typeof contactFrequencies)[number];

export const contacts = pgTable(
  "contacts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    // "Who is this": role, relation, short description
    about: text("about"),
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    workplace: text("workplace"),
    contactFrequency: text("contact_frequency", { enum: contactFrequencies }),
    // When the frequency was set or last changed; the countdown start for a contact without notes
    contactFrequencySetAt: timestamp("contact_frequency_set_at", {
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    unique("contacts_owner_id_id_unique").on(table.ownerId, table.id),
    index("contacts_owner_id_idx").on(table.ownerId),
    check(
      "contacts_contact_frequency_check",
      sql`${table.contactFrequency} in (${sql.raw(
        contactFrequencies.map((value) => `'${value}'`).join(", "),
      )})`,
    ),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (table) => [index("notes_contact_id_idx").on(table.contactId)],
);

export type Contact = typeof contacts.$inferSelect;
export type Note = typeof notes.$inferSelect;

export const contactGroups = pgTable(
  "contact_groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("contact_groups_owner_name_unique").on(
      table.ownerId,
      table.normalizedName,
    ),
    unique("contact_groups_owner_id_id_unique").on(table.ownerId, table.id),
    check("contact_groups_name_check", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const contactGroupMemberships = pgTable(
  "contact_group_memberships",
  {
    ownerId: text("owner_id").notNull(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => contactGroups.id, { onDelete: "cascade" }),
  },
  (table) => [
    foreignKey({
      name: "memberships_owner_contact_fk",
      columns: [table.ownerId, table.contactId],
      foreignColumns: [contacts.ownerId, contacts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "memberships_owner_group_fk",
      columns: [table.ownerId, table.groupId],
      foreignColumns: [contactGroups.ownerId, contactGroups.id],
    }).onDelete("cascade"),
    index("memberships_owner_group_idx").on(table.ownerId, table.groupId),
    primaryKey({ columns: [table.contactId, table.groupId] }),
    index("contact_group_memberships_group_id_idx").on(table.groupId),
  ],
);

export type ContactGroup = typeof contactGroups.$inferSelect;
