import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function addContact(page: Page, name: string) {
  await page
    .getByRole("link", { name: "Добавить контакт", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Имя", exact: true }).fill(name);
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Все контакты", exact: true }).click();
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
}

test("main scenario persists contacts and a conversation note across browser sessions", async ({
  page,
  browser,
}) => {
  const suffix = randomUUID();
  const contactName = `Анна ${suffix}`;
  const otherContactName = `Борис ${suffix}`;
  const note = `После разговора договорились встретиться в пятницу. ${suffix}`;

  await test.step("open the contact list and add a contact", async () => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Контакты", exact: true }),
    ).toBeVisible();
    await addContact(page, otherContactName);
    await addContact(page, contactName);
    await expect(
      page.getByRole("link", { name: otherContactName, exact: true }),
    ).toBeVisible();
  });

  await test.step("find the contact by name and open its card", async () => {
    await page
      .getByRole("searchbox", { name: "Найти по имени", exact: true })
      .fill(contactName);
    await expect(
      page.getByRole("link", { name: contactName, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: otherContactName, exact: true }),
    ).toBeHidden();
    await page.getByRole("link", { name: contactName, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: contactName, exact: true }),
    ).toBeVisible();
  });

  const contactUrl = page.url();
  await test.step("save a conversation note and verify it after reloading", async () => {
    await page
      .getByRole("textbox", { name: "Новая заметка", exact: true })
      .fill(note);
    await page
      .getByRole("button", { name: "Добавить заметку", exact: true })
      .click();
    await expect(
      page
        .getByRole("listitem")
        .filter({ has: page.getByText(note, { exact: true }) }),
    ).toHaveCount(1);
    await page.reload();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
  });

  await test.step("open the same address in an independent browser session", async () => {
    const otherContext = await browser.newContext();
    try {
      const otherPage = await otherContext.newPage();
      await otherPage.goto(new URL("/", contactUrl).href);
      await expect(
        otherPage.getByRole("link", { name: contactName, exact: true }),
      ).toBeVisible();
      await expect(
        otherPage.getByRole("link", { name: otherContactName, exact: true }),
      ).toBeVisible();
      await otherPage
        .getByRole("link", { name: contactName, exact: true })
        .click();
      await expect(otherPage).toHaveURL(contactUrl);
      await expect(
        otherPage.getByRole("heading", { name: contactName, exact: true }),
      ).toBeVisible();
      await expect(otherPage.getByText(note, { exact: true })).toBeVisible();
    } finally {
      await otherContext.close();
    }
  });
});
