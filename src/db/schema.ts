import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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

export const contacts = pgTable("contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  // "Who is this": role, relation, short description
  about: text("about"),
  howWeMet: text("how_we_met"),
  phone: text("phone"),
  email: text("email"),
  ...timestamps,
});

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
