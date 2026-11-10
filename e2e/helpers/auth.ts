import { expect, type Page } from "@playwright/test";
import { capturedMessages, mailLink, waitForMail } from "./mailpit";

export async function signIn(page: Page, email: string) {
  const normalized = email.trim().toLowerCase();
  const previous = (await capturedMessages(normalized)).map(
    (message) => message.ID,
  );
  await page.goto(new URL("/login", process.env.BETTER_AUTH_URL!).href);
  await page.getByRole("textbox", { name: "Почта", exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Получить ссылку", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    `Ссылка для входа отправлена на ${normalized}`,
  );
  const message = await waitForMail(normalized, previous);
  await page.goto(mailLink(message));
  await expect(page).toHaveURL(new URL("/", process.env.BETTER_AUTH_URL!).href);
  await expect(
    page.getByRole("heading", { name: "Контакты", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(normalized, { exact: true })).toBeVisible();
}
