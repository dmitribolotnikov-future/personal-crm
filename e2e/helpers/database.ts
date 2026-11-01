import { test as base } from "@playwright/test";
import { Pool } from "pg";

import { getConnectionConfig } from "../../src/db/connection";
import type { ContactFrequency } from "../../src/db/schema";

export function isolatedPool() {
  const config = getConnectionConfig();
  if (
    process.env.E2E_DATABASE_ISOLATED !== "1" ||
    config.host !== "127.0.0.1" ||
    config.database !== "crm_e2e" ||
    config.user !== "crm_e2e"
  ) {
    throw new Error("Test fixtures require the isolated Docker database.");
  }
  return new Pool(config);
}

export const legacyContactName = "Контакт до миграции keep-in-touch";

export const test = base.extend<{ database: TestDatabase }>({
  database: async ({}, runTest) => {
    const pool = isolatedPool();
    const database = new TestDatabase(pool);
    try {
      await runTest(database);
    } finally {
      try {
        // Only remove contacts owned by this test, never truncate shared tables.
        await pool.query("delete from contacts where id = any($1::int[])", [
          database.contactIds,
        ]);
      } finally {
        await pool.end();
      }
    }
  },
});

export class TestDatabase {
  readonly contactIds: number[] = [];
  constructor(readonly pool: Pool) {}

  track(id: number) {
    this.contactIds.push(id);
    return id;
  }

  async contact(
    name: string,
    frequency: ContactFrequency | null,
    startedAt: Date,
  ) {
    const { rows } = await this.pool.query<{ id: number }>(
      "insert into contacts (name, contact_frequency, contact_frequency_set_at) values ($1, $2, $3) returning id",
      [name, frequency, frequency ? startedAt : null],
    );
    return this.track(rows[0].id);
  }

  async note(contactId: number, body: string, createdAt: Date) {
    const { rows } = await this.pool.query<{ id: number }>(
      "insert into notes (contact_id, body, created_at, updated_at) values ($1, $2, $3, $3) returning id",
      [contactId, body, createdAt],
    );
    return rows[0].id;
  }

  async contactState(id: number) {
    const { rows } = await this.pool.query<{
      contact_frequency: ContactFrequency | null;
      contact_frequency_set_at: Date | null;
    }>(
      "select contact_frequency, contact_frequency_set_at from contacts where id = $1",
      [id],
    );
    return rows[0];
  }

  async notes(id: number) {
    const { rows } = await this.pool.query<{
      id: number;
      body: string;
      created_at: Date;
      updated_at: Date;
    }>(
      "select id, body, created_at, updated_at from notes where contact_id = $1 order by created_at desc, id desc",
      [id],
    );
    return rows;
  }
}

// The runner sets TZ=UTC for PostgreSQL fixtures, the app and Playwright.
export function daysAgo(days: number) {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - days,
      12,
    ),
  );
}

export function dateLabel(date: Date) {
  const month = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `${month} ${date.getUTCFullYear()}`;
}

// Independent expected dates; do not reuse the calculation being tested.
export function monthsAfter(date: Date, count: number) {
  const first = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1, 12),
  );
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return first;
}
