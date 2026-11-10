import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { test, daysAgo, type TestDatabase } from "./helpers/database";
import { signIn } from "./helpers/auth";

const block = (page: Page) =>
  page.getByRole("region", { name: "Пора связаться", exact: true });
async function foreignContact(database: TestDatabase) {
  const owner = randomUUID();
  const name = `Чужой ${owner}`;
  await database.pool.query("insert into auth_user (id,email) values ($1,$2)", [
    owner,
    `${owner}@example.test`,
  ]);
  await database.pool.query(
    "insert into contacts (name,owner_id,contact_frequency,contact_frequency_set_at) values ($1,$2,'week','2020-01-01T12:00:00Z')",
    [name, owner],
  );
  return name;
}

test("owned overdue entries show days and contacted button", async ({
  page,
  database,
}) => {
  await database.contact("Анна", "week", daysAgo(10));
  await database.contact("Борис", "week", daysAgo(12));
  await page.goto("/");
  await expect(
    block(page).getByRole("link").filter({ hasText: "Анна" }),
  ).toBeVisible();
  await expect(
    block(page).getByRole("link").filter({ hasText: "Борис" }),
  ).toBeVisible();
  await expect(
    block(page).getByText("просрочено на 3 дня", { exact: true }),
  ).toBeVisible();
  await expect(
    block(page).getByText("просрочено на 5 дней", { exact: true }),
  ).toBeVisible();
  await expect(
    block(page).getByRole("button", { name: "Связались", exact: true }),
  ).toHaveCount(2);
});

test("foreign overdue contacts do not create an empty owners block", async ({
  page,
  database,
}) => {
  await foreignContact(database);
  await page.goto("/");
  await expect(block(page)).toHaveCount(0);
  await expect(
    page.getByText("Добавь первый контакт", { exact: true }),
  ).toBeVisible();
});

test("owned overdue entry opens its contact", async ({ page, database }) => {
  const id = await database.contact("Своя карточка", "week", daysAgo(10));
  await page.goto("/");
  await block(page)
    .getByRole("link")
    .filter({ hasText: "Своя карточка" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${id}$`));
  await expect(
    page.getByRole("heading", { name: "Своя карточка", exact: true }),
  ).toBeVisible();
});

test("search and group filters do not change owned overdue entries", async ({
  page,
  database,
}) => {
  const contact = await database.contact("Просроченный", "week", daysAgo(12));
  const group = (
    await database.pool.query(
      "insert into contact_groups (owner_id,name,normalized_name) values ($1,'Теннис','теннис') returning id",
      [database.ownerId],
    )
  ).rows[0];
  await database.pool.query(
    "insert into contact_group_memberships (owner_id,contact_id,group_id) values ($1,$2,$3)",
    [database.ownerId, contact, group.id],
  );
  await page.goto("/");
  await expect(block(page)).toBeVisible();
  const before = (await block(page).textContent())!;
  await page
    .getByRole("searchbox", { name: "Найти по имени", exact: true })
    .fill("Не существует");
  await page.getByRole("button", { name: /Фильтр по группам/ }).click();
  await page.getByRole("checkbox", { name: "Теннис", exact: true }).check();
  await expect(block(page)).toHaveText(before);
});

test("same-account overdue results persist across browsers", async ({
  page,
  browser,
  database,
}) => {
  await database.contact("Свой просроченный", "week", daysAgo(10));
  await page.goto("/");
  await expect(block(page)).toBeVisible();
  const before = (await block(page).textContent())!;
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await signIn(other, database.ownerEmail);
    await expect(block(other)).toHaveText(before);
  } finally {
    await context.close();
  }
});

test("overdue results exclude every other owner", async ({
  page,
  database,
}) => {
  const foreign = await foreignContact(database);
  await database.contact("Свой просроченный", "week", daysAgo(10));
  await page.goto("/");
  await expect(
    block(page).getByRole("link").filter({ hasText: "Свой просроченный" }),
  ).toBeVisible();
  await expect(page.getByText(foreign, { exact: true })).toHaveCount(0);
});
