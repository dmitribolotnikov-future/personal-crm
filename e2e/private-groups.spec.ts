import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";

test("same-account groups persist across browsers", async ({
  page,
  browser,
}) => {
  const email = `groups-${randomUUID()}@example.test`;
  await signIn(page, email);
  await page.goto("/groups");
  await page
    .getByRole("textbox", { name: "Название новой группы", exact: true })
    .fill("Семья");
  await page
    .getByRole("button", { name: "Создать группу", exact: true })
    .click();
  const link = page.getByRole("link", { name: "Семья", exact: true });
  await expect(link).toBeVisible();
  const path = (await link.getAttribute("href"))!;
  await page.goto(path);
  await expect(
    page.getByText("В этой группе пока нет участников.", { exact: true }),
  ).toBeVisible();
  await page.goto("/contacts/new");
  await page
    .getByRole("textbox", { name: "Имя", exact: true })
    .fill("Контакт семьи");
  await page.getByText("Семья", { exact: true }).click();
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Контакт семьи", exact: true }),
  ).toBeVisible();
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await signIn(other, email);
    await other.goto(new URL("/groups", process.env.BETTER_AUTH_URL!).href);
    await expect(
      other.getByRole("link", { name: "Семья", exact: true }),
    ).toBeVisible();
    await other.goto(new URL(path, process.env.BETTER_AUTH_URL!).href);
    await expect(
      other.getByRole("heading", { name: "Семья", exact: true }),
    ).toBeVisible();
    await expect(
      other.getByRole("link", { name: "Контакт семьи", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("acceptance signs in through real Mailpit delivery", async ({ page }) => {
  await signIn(page, `delivery-${randomUUID()}@example.test`);
  await expect(
    page.getByRole("button", { name: "Выйти", exact: true }),
  ).toBeVisible();
});
