import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Reviewed against getAuthTables() from Better Auth 1.7.18.
const dates = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const user = pgTable(
  "auth_user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().default(""),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    ...dates,
  },
  (table) => [
    check(
      "auth_user_normalized_email_check",
      sql`${table.email} = lower(btrim(${table.email}))`,
    ),
  ],
);

export const session = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...dates,
  },
  (table) => [index("auth_session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...dates,
  },
  (table) => [index("auth_account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "auth_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...dates,
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)],
);

export const magicLinkRequests = pgTable("magic_link_requests", {
  email: text("email").primaryKey(),
  currentTokenDigest: text("current_token_digest"),
  recentSendTimes: jsonb("recent_send_times")
    .$type<string[]>()
    .notNull()
    .default([]),
});

export const magicLinkTokens = pgTable(
  "magic_link_tokens",
  {
    digest: text("digest").primaryKey(),
    email: text("email")
      .notNull()
      .references(() => magicLinkRequests.email, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("magic_link_tokens_expiry_idx").on(table.expiresAt)],
);
