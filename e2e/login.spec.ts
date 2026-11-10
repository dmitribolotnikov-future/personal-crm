import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { isolatedPool } from "./helpers/database";
import { capturedMessages } from "./helpers/mailpit";

const origin = () => process.env.BETTER_AUTH_URL!;
const url = (path: string) => new URL(path, origin()).href;

async function createRecords(page: Page, label: string) {
  const name = `Контакт ${label}`;
  const note = `Заметка ${label}`;
  const group = `Группа ${label}`;
  await page.goto(url("/groups"));
  await page
    .getByRole("textbox", { name: "Название новой группы", exact: true })
    .fill(group);
  await page
    .getByRole("button", { name: "Создать группу", exact: true })
    .click();
  const groupLink = page.getByRole("link", { name: group, exact: true });
  await expect(groupLink).toBeVisible();
  const groupPath = (await groupLink.getAttribute("href"))!;
  await page.goto(url("/contacts/new"));
  await page.getByRole("textbox", { name: "Имя", exact: true }).fill(name);
  await page.getByText(group, { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: group, exact: true }),
  ).toBeChecked();
  await page.getByText("Раз в неделю", { exact: true }).click();
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const contactPath = new URL(page.url()).pathname;
  await page
    .getByRole("textbox", { name: "Новая заметка", exact: true })
    .fill(note);
  await page
    .getByRole("button", { name: "Добавить заметку", exact: true })
    .click();
  await expect(page.getByText(note, { exact: true })).toBeVisible();
  return { name, note, group, groupPath, contactPath };
}

test("anonymous CRM access requires sign-in", async ({ page, request }) => {
  for (const path of [
    "/",
    "/contacts/new",
    "/contacts/1",
    "/contacts/1/edit",
    "/groups",
    "/groups/1",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("button", { name: "Получить ссылку", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "Найти по имени" }),
    ).toHaveCount(0);
  }
  const response = await request.post("/", {
    maxRedirects: 0,
    headers: { "next-action": "invalid-action" },
    data: "[]",
  });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
});

test("health remains public", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("invalid email shows field error without mail", async ({ page }) => {
  await page.goto("/login");
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/sign-in/magic-link")) requests++;
  });
  await page
    .getByRole("textbox", { name: "Почта", exact: true })
    .fill("invalid");
  await page
    .getByRole("button", { name: "Получить ссылку", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Проверь адрес почты" }),
  ).toHaveText("Проверь адрес почты");
  expect(requests).toBe(0);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("new account starts empty with first-contact prompt", async ({ page }) => {
  const email = `empty-${randomUUID()}@example.test`;
  await signIn(page, ` ${email.toUpperCase()} `);
  await expect(
    page.getByText("Добавь первый контакт", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Контакт до миграции/ }),
  ).toHaveCount(0);
  expect((await capturedMessages(email)).length).toBe(1);
});

test("stale links show the recovery page", async ({ page }) => {
  await page.goto("/api/auth/magic-link/verify?token=invalid");
  await expect(
    page.getByRole("heading", {
      name: "Ссылка устарела, запроси новую",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Получить новую ссылку", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});

test("signed-in users cannot see each others contacts notes or groups", async ({
  browser,
}) => {
  const suffix = randomUUID();
  const pool = isolatedPool();
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await signIn(pageA, `a-${suffix}@example.test`);
    await signIn(pageB, `b-${suffix}@example.test`);
    const a = await createRecords(pageA, `A ${suffix}`);
    const b = await createRecords(pageB, `B ${suffix}`);
    const ids = [a, b].map((record) =>
      Number(record.contactPath.split("/").at(-1)),
    );
    await pool.query(
      "update contacts set contact_frequency_set_at='2020-01-01T12:00:00Z' where id=any($1::int[])",
      [ids],
    );
    await pool.query(
      "update notes set created_at='2020-01-01T12:00:00Z',updated_at='2020-01-01T12:00:00Z' where contact_id=any($1::int[])",
      [ids],
    );
    for (const [page, own, foreign] of [
      [pageA, a, b],
      [pageB, b, a],
    ] as const) {
      await page.goto(url("/"));
      await expect(
        page.getByRole("link").filter({ hasText: own.name }),
      ).toHaveCount(2);
      await expect(
        page.getByRole("link", { name: foreign.name, exact: true }),
      ).toHaveCount(0);
      const overdue = page.getByRole("region", {
        name: "Пора связаться",
        exact: true,
      });
      await expect(
        overdue.getByRole("link").filter({ hasText: own.name }),
      ).toBeVisible();
      await expect(
        overdue.getByText(foreign.name, { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("searchbox", { name: "Найти по имени", exact: true })
        .fill(foreign.name);
      await expect(
        page.getByRole("link", { name: foreign.name, exact: true }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: /Фильтр по группам/ }).click();
      await expect(
        page.getByRole("checkbox", { name: own.group, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("checkbox", { name: foreign.group, exact: true }),
      ).toHaveCount(0);
      await page.goto(url(foreign.contactPath));
      await expect(
        page.getByRole("heading", { name: "Контакт не найден", exact: true }),
      ).toBeVisible();
      await expect(page.getByText(foreign.note, { exact: true })).toHaveCount(
        0,
      );
      const foreignResponse = await page.request.get(url(foreign.contactPath));
      const body = await foreignResponse.text();
      expect(body).not.toContain(foreign.name);
      expect(body).not.toContain(foreign.note);
      expect(body).not.toContain(foreign.group);
      await page.goto(url(`${foreign.contactPath}/edit`));
      await expect(
        page.getByRole("heading", { name: "Контакт не найден", exact: true }),
      ).toBeVisible();
      await page.goto(url(foreign.groupPath));
      await expect(
        page.getByRole("heading", { name: foreign.group, exact: true }),
      ).toHaveCount(0);
      await expect(page.getByText(foreign.name, { exact: true })).toHaveCount(
        0,
      );
      await page.goto(url("/groups"));
      await expect(
        page.getByRole("link", { name: own.group, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: foreign.group, exact: true }),
      ).toHaveCount(0);
      await page.goto(url(own.groupPath));
      await expect(
        page.getByRole("link").filter({ hasText: own.name }),
      ).toBeVisible();
      await page.goto(url(own.contactPath));
      await expect(page.getByText(own.note, { exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Изменить", exact: true }).click();
      await expect(
        page.getByRole("checkbox", { name: own.group, exact: true }),
      ).toBeChecked();
      await expect(
        page.getByRole("checkbox", { name: foreign.group, exact: true }),
      ).toHaveCount(0);
    }
  } finally {
    const cleanup = await Promise.allSettled([
      contextA.close(),
      contextB.close(),
      pool.end(),
    ]);
    const failure = cleanup.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
});

test("each visit renews a thirty-day device session", async ({ browser }) => {
  const email = `session-${randomUUID()}@example.test`;
  const pool = isolatedPool();
  const context = await browser.newContext();
  let reopened: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    const page = await context.newPage();
    await signIn(page, email);
    await pool.query(
      "update auth_session set expires_at=now()+interval '1 day',updated_at=now()-interval '29 days' where user_id=(select id from auth_user where email=$1)",
      [email],
    );
    await page.goto(url("/"));
    await expect(
      page.getByRole("heading", { name: "Контакты", exact: true }),
    ).toBeVisible();
    const row = (
      await pool.query(
        "select expires_at from auth_session where user_id=(select id from auth_user where email=$1)",
        [email],
      )
    ).rows[0];
    expect(
      Math.abs(row.expires_at.getTime() - Date.now() - 30 * 86400000),
    ).toBeLessThan(10000);
    const cookie = (await context.cookies()).find((cookie) =>
      cookie.name.endsWith("session_token"),
    )!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.expires * 1000 - Date.now()).toBeGreaterThan(29 * 86400000);
    const saved = await context.storageState();
    await context.close();
    reopened = await browser.newContext({ storageState: saved });
    const again = await reopened.newPage();
    await again.goto(url("/"));
    await expect(again.getByText(email, { exact: true })).toBeVisible();
    await pool.query(
      "update auth_session set expires_at=now()-interval '1 second' where user_id=(select id from auth_user where email=$1)",
      [email],
    );
    await again.goto(url("/"));
    await expect(again).toHaveURL(/\/login$/);
  } finally {
    await context.close();
    await reopened?.close();
    await pool.end();
  }
});

test("sign-out revokes only the current device", async ({ browser }) => {
  const email = `devices-${randomUUID()}@example.test`;
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    await signIn(pageA, email);
    await signIn(pageB, email);
    await pageA.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(pageA).toHaveURL(/\/login$/);
    await pageA.goto(url("/"));
    await expect(pageA).toHaveURL(/\/login$/);
    await pageB.goto(url("/"));
    await expect(pageB.getByText(email, { exact: true })).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("cross-browser persistence and account switching retain only current data", async ({
  page,
  browser,
}) => {
  const suffix = randomUUID();
  const emailA = `switch-a-${suffix}@example.test`;
  await signIn(page, emailA);
  const own = await createRecords(page, `Switch ${suffix}`);
  const secondContext = await browser.newContext();
  try {
    const second = await secondContext.newPage();
    await signIn(second, emailA);
    await expect(
      second.getByRole("link", { name: own.name, exact: true }),
    ).toBeVisible();
    await second.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(second).toHaveURL(/\/login$/);
    await signIn(second, `switch-b-${suffix}@example.test`);
    await expect(
      second.getByText("Добавь первый контакт", { exact: true }),
    ).toBeVisible();
    await expect(second.getByText(own.name, { exact: true })).toHaveCount(0);
    await second.goto(url(own.contactPath));
    await expect(
      second.getByRole("heading", { name: "Контакт не найден", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText(own.note, { exact: true })).toBeVisible();
  } finally {
    await secondContext.close();
  }
});
