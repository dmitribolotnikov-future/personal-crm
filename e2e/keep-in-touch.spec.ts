import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";

import {
  dateLabel,
  daysAgo,
  legacyContactName,
  monthsAfter,
  test,
  type TestDatabase,
} from "./helpers/database";

const overdueBlock = (page: Page) =>
  page.getByRole("region", { name: "Пора связаться", exact: true });
const noteItem = (page: Page, body: string) =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByText(body, { exact: true }) });
const dueText = (date: Date) => `Связаться до ${dateLabel(date)}`;

async function chooseFrequency(page: Page, label: string) {
  await page.getByText(label, { exact: true }).click();
  await expect(
    page.getByRole("radio", { name: label, exact: true }),
  ).toBeChecked();
}

async function saveEdit(page: Page) {
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page).toHaveURL(/\/contacts\/\d+$/);
}

async function createContact(
  page: Page,
  database: TestDatabase,
  name: string,
  frequency?: string,
) {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя", exact: true }).fill(name);
  if (frequency) await chooseFrequency(page, frequency);
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  return database.track(Number(new URL(page.url()).pathname.split("/").at(-1)));
}

async function removeNote(page: Page, item: Locator) {
  await item.getByRole("button", { name: "Удалить", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Удалить заметку?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(item).toHaveCount(0);
}

async function editNote(page: Page, oldBody: string, body: string) {
  const item = noteItem(page, oldBody);
  await item.getByRole("button", { name: "Изменить", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Текст заметки", exact: true })
    .fill(body);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(noteItem(page, body)).toHaveCount(1);
}

test("create contacts with unset and monthly frequency and preserve the choice on validation errors", async ({
  page,
  database,
}) => {
  const suffix = randomUUID();
  await test.step("unset frequency hides reminders even with a very old note", async () => {
    await page.goto("/contacts/new");
    await expect(
      page.getByRole("radio", { name: "Не задано", exact: true }),
    ).toBeChecked();
    const id = await createContact(page, database, `Без частоты ${suffix}`);
    expect(await database.contactState(id)).toEqual({
      contact_frequency: null,
      contact_frequency_set_at: null,
    });
    await database.note(
      id,
      "Давняя заметка без частоты",
      new Date("2020-01-01T12:00:00Z"),
    );
    await page.reload();
    await expect(page.getByText("Общаться", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Срок", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Связались", exact: true }),
    ).toHaveCount(0);
    await page.goto("/");
    await expect(overdueBlock(page)).toHaveCount(0);
  });

  await test.step("server validation keeps the selected monthly frequency", async () => {
    await page.goto("/contacts/new");
    await page
      .getByRole("textbox", { name: "Имя", exact: true })
      .fill(`Раз в месяц ${suffix}`);
    await chooseFrequency(page, "Раз в месяц");
    // HTML accepts this address; server validation requires a complete domain.
    await page
      .getByRole("textbox", { name: "Почта", exact: true })
      .fill("invalid@example");
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(
      page.getByText("Похоже, в адресе почты ошибка", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Раз в месяц", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("textbox", { name: "Почта", exact: true })
      .fill("valid@example.com");
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(page).toHaveURL(/\/contacts\/\d+$/);
    const id = database.track(
      Number(new URL(page.url()).pathname.split("/").at(-1)),
    );
    const saved = await database.contactState(id);
    expect(saved.contact_frequency).toBe("month");
    expect(saved.contact_frequency_set_at).toBeInstanceOf(Date);
    await expect(page.getByText("раз в месяц", { exact: true })).toBeVisible();
    await expect(
      page.getByText(dueText(monthsAfter(saved.contact_frequency_set_at!, 1)), {
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText("раз в месяц", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Изменить", exact: true }).click();
    await expect(
      page.getByRole("radio", { name: "Раз в месяц", exact: true }),
    ).toBeChecked();
    await page.goto("/");
    await expect(overdueBlock(page)).toHaveCount(0);
  });

  await test.step("a migrated contact retains its old card without reminders", async () => {
    await signIn(page, process.env.LEGACY_OWNER_EMAIL!);
    await page
      .getByRole("link")
      .filter({ has: page.getByText(legacyContactName, { exact: true }) })
      .click();
    await expect(
      page.getByRole("heading", { name: legacyContactName, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Заметка до обновления", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Старая компания", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Общаться", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Срок", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Связались", exact: true }),
    ).toHaveCount(0);
  });
});

test("edit a contact without notes, preserve its start for other fields, change and reset frequency", async ({
  page,
  database,
}) => {
  const startedAt = daysAgo(7);
  const id = await database.contact(
    `Без заметок ${randomUUID()}`,
    "year",
    startedAt,
  );
  await page.goto(`/contacts/${id}`);
  await expect(
    page.getByText(dueText(monthsAfter(startedAt, 12)), { exact: true }),
  ).toBeVisible();

  await test.step("changing only the phone preserves the original countdown in PostgreSQL", async () => {
    await page.getByRole("link", { name: "Изменить", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Телефон", exact: true })
      .fill("+79000000001");
    await saveEdit(page);
    expect((await database.contactState(id)).contact_frequency_set_at).toEqual(
      startedAt,
    );
    await expect(
      page.getByText(dueText(monthsAfter(startedAt, 12)), { exact: true }),
    ).toBeVisible();
  });

  await test.step("changing year to month resets the start to today", async () => {
    await page.getByRole("link", { name: "Изменить", exact: true }).click();
    await chooseFrequency(page, "Раз в месяц");
    const before = Date.now();
    await saveEdit(page);
    const saved = await database.contactState(id);
    expect(saved.contact_frequency_set_at!.getTime()).toBeGreaterThanOrEqual(
      before,
    );
    expect(saved.contact_frequency_set_at!.getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
    await expect(
      page.getByText(dueText(monthsAfter(saved.contact_frequency_set_at!, 1)), {
        exact: true,
      }),
    ).toBeVisible();
  });

  await test.step("changing month to week shows the new frequency and date", async () => {
    await page.getByRole("link", { name: "Изменить", exact: true }).click();
    await chooseFrequency(page, "Раз в неделю");
    await saveEdit(page);
    await expect(page.getByText("раз в неделю", { exact: true })).toBeVisible();
    await expect(
      page.getByText(dueText(daysAgo(-7)), { exact: true }),
    ).toBeVisible();
  });

  await test.step("resetting an overdue contact removes both its date and its home row", async () => {
    const overdueId = await database.contact(
      `Сбросить частоту ${randomUUID()}`,
      "week",
      daysAgo(20),
    );
    await page.goto("/");
    await expect(
      overdueBlock(page).getByRole("link", { name: /Сбросить частоту/ }),
    ).toBeVisible();
    await page.goto(`/contacts/${overdueId}/edit`);
    await chooseFrequency(page, "Не задано");
    await saveEdit(page);
    expect(await database.contactState(overdueId)).toEqual({
      contact_frequency: null,
      contact_frequency_set_at: null,
    });
    await expect(page.getByText("Общаться", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Срок", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Связались", exact: true }),
    ).toHaveCount(0);
    await page.goto("/");
    await expect(overdueBlock(page)).toHaveCount(0);
  });
});

test("home reminders select overdue contacts, sort ties, ignore search and persist across sessions", async ({
  page,
  browser,
  database,
}) => {
  const suffix = randomUUID();
  const anna = await database.contact(`Анна ${suffix}`, "week", daysAgo(10));
  const boris = await database.contact(`Борис ${suffix}`, "week", daysAgo(47));
  const vera = await database.contact(`Вера ${suffix}`, "week", daysAgo(19));
  const annaTie = await database.contact(
    `Анна равная ${suffix}`,
    "week",
    daysAgo(14),
  );
  const veraTie = await database.contact(
    `Вера равная ${suffix}`,
    "week",
    daysAgo(14),
  );
  await database.contact(`Без частоты ${suffix}`, null, daysAgo(300));
  const dueToday = await database.contact(
    `Срок сегодня ${suffix}`,
    "week",
    daysAgo(7),
  );
  await database.contact(`Будущий срок ${suffix}`, "week", daysAgo(1));

  await test.step("show only overdue contacts, in the required order with day labels and buttons", async () => {
    await page.goto("/");
    const rows = overdueBlock(page).getByRole("listitem");
    await expect(rows).toHaveCount(5);
    await expect(rows).toHaveText([
      new RegExp(`Борис ${suffix}.*просрочено на 40 дней.*Связались`),
      new RegExp(`Вера ${suffix}.*просрочено на 12 дней.*Связались`),
      new RegExp(`Анна равная ${suffix}.*просрочено на 7 дней.*Связались`),
      new RegExp(`Вера равная ${suffix}.*просрочено на 7 дней.*Связались`),
      new RegExp(`Анна ${suffix}.*просрочено на 3 дня.*Связались`),
    ]);
    expect(
      await overdueBlock(page)
        .getByRole("link")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ).toEqual(
      [boris, vera, annaTie, veraTie, anna].map((id) => `/contacts/${id}`),
    );
    await expect(
      overdueBlock(page).getByRole("button", {
        name: "Связались",
        exact: true,
      }),
    ).toHaveCount(5);
  });

  await test.step("name search only filters the general list and a separate session has the same reminders", async () => {
    const before = (await overdueBlock(page).textContent())!;
    await page
      .getByRole("searchbox", { name: "Найти по имени", exact: true })
      .fill(`Без частоты ${suffix}`);
    await expect(
      page.getByRole("link", { name: `Борис ${suffix}`, exact: true }),
    ).toHaveCount(0);
    await expect(overdueBlock(page)).toHaveText(before);
    const context = await browser.newContext();
    try {
      const otherPage = await context.newPage();
      await signIn(otherPage, database.ownerEmail);
      await otherPage.goto(new URL("/", page.url()).href);
      await expect(overdueBlock(otherPage)).toHaveText(before);
    } finally {
      await context.close();
    }
  });

  await test.step("a reminder link opens the matching card and a due-today card is not overdue", async () => {
    await overdueBlock(page)
      .getByRole("link")
      .filter({ hasText: `Борис ${suffix}` })
      .click();
    await expect(page).toHaveURL(new RegExp(`/contacts/${boris}$`));
    await expect(
      page.getByRole("heading", { name: `Борис ${suffix}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Пора связаться · просрочено на 40 дней", { exact: true }),
    ).toBeVisible();
    await page.goto(`/contacts/${dueToday}`);
    await expect(
      page.getByText(dueText(daysAgo(0)), { exact: true }),
    ).toBeVisible();
  });
  await test.step("a five-day overdue card shows the exact reminder label", async () => {
    const fiveDays = await database.contact(
      `Пять дней ${suffix}`,
      "week",
      daysAgo(12),
    );
    await page.goto(`/contacts/${fiveDays}`);
    await expect(
      page.getByText("Пора связаться · просрочено на 5 дней", { exact: true }),
    ).toBeVisible();
  });
  await test.step("setting monthly frequency today still counts from a five-month-old note", async () => {
    const ancient = await database.contact(
      `Давняя заметка ${suffix}`,
      null,
      daysAgo(0),
    );
    const writtenAt = monthsAfter(daysAgo(0), -5);
    await database.note(ancient, "Давняя беседа", writtenAt);
    await page.goto(`/contacts/${ancient}/edit`);
    await chooseFrequency(page, "Раз в месяц");
    await saveEdit(page);
    const deadline = monthsAfter(writtenAt, 1);
    const days = Math.round(
      (daysAgo(0).getTime() - deadline.getTime()) / 86_400_000,
    );
    await expect(
      page.getByText(new RegExp(`Пора связаться · просрочено на ${days} `)),
    ).toBeVisible();
    await page.goto("/");
    await expect(
      overdueBlock(page)
        .getByRole("link")
        .filter({ hasText: `Давняя заметка ${suffix}` }),
    ).toBeVisible();
  });
});

test("mark contacted from home and cards, edit the note and undo by deleting it", async ({
  page,
  database,
}) => {
  const suffix = randomUUID();
  const homeId = await database.contact(`Борис ${suffix}`, "week", daysAgo(30));
  await database.note(homeId, "Предыдущая беседа Бориса", daysAgo(20));
  const quarterly = await database.contact(
    `Квартальный ${suffix}`,
    "quarter",
    daysAgo(200),
  );
  await database.note(quarterly, "Предыдущая квартальная беседа", daysAgo(150));

  await test.step("home action adds today's note and removes only that row without navigation or confirmation", async () => {
    await page.goto("/");
    const row = overdueBlock(page)
      .getByRole("listitem")
      .filter({ hasText: `Борис ${suffix}` });
    await row.getByRole("button", { name: "Связались", exact: true }).click();
    await expect(row).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(overdueBlock(page).getByRole("listitem")).toHaveCount(1);
    const saved = await database.notes(homeId);
    expect(saved[0].body).toBe("Связались");
    expect(saved[0].created_at.toISOString().slice(0, 10)).toBe(
      daysAgo(0).toISOString().slice(0, 10),
    );
    await page.goto(`/contacts/${homeId}`);
    await expect(noteItem(page, "Связались")).toContainText(
      dateLabel(daysAgo(0)),
    );
    await expect(
      page.getByText(dueText(daysAgo(-7)), { exact: true }),
    ).toBeVisible();
  });

  await test.step("an overdue quarterly card creates its newest note and a deadline three months away", async () => {
    await page.goto(`/contacts/${quarterly}`);
    await expect(page.getByText(/Пора связаться · просрочено/)).toBeVisible();
    await page.getByRole("button", { name: "Связались", exact: true }).click();
    await expect(noteItem(page, "Связались")).toHaveCount(1);
    await expect(page.getByRole("listitem").first()).toContainText("Связались");
    await expect(noteItem(page, "Связались")).toContainText(
      dateLabel(daysAgo(0)),
    );
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(
      page.getByText(dueText(monthsAfter(daysAgo(0), 3)), { exact: true }),
    ).toBeVisible();
  });

  await test.step("editing and deleting the generated note follow the normal note rules", async () => {
    const original = (await database.notes(quarterly))[0];
    const text = "Связались и договорились о встрече";
    await editNote(page, "Связались", text);
    expect((await database.notes(quarterly))[0].created_at).toEqual(
      original.created_at,
    );
    await expect(
      page.getByText(dueText(monthsAfter(original.created_at, 3)), {
        exact: true,
      }),
    ).toBeVisible();
    await removeNote(page, noteItem(page, text));
    await expect(page.getByText(/Пора связаться · просрочено/)).toBeVisible();
    expect((await database.notes(quarterly)).map((note) => note.body)).toEqual([
      "Предыдущая квартальная беседа",
    ]);
    await page.goto("/");
    await expect(
      overdueBlock(page)
        .getByRole("link")
        .filter({ hasText: `Квартальный ${suffix}` }),
    ).toBeVisible();
  });

  await test.step("the same button works before the deadline and advances it from today", async () => {
    const future = await database.contact(
      `Ещё не пора ${suffix}`,
      "quarter",
      daysAgo(10),
    );
    await database.note(future, "Недавняя беседа", daysAgo(2));
    await page.goto(`/contacts/${future}`);
    await expect(
      page.getByText(dueText(monthsAfter(daysAgo(2), 3)), { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Связались", exact: true }).click();
    await expect(noteItem(page, "Связались")).toHaveCount(1);
    await expect(
      page.getByText(dueText(monthsAfter(daysAgo(0), 3)), { exact: true }),
    ).toBeVisible();
    expect((await database.notes(future))[0].body).toBe("Связались");
  });
});

test("ordinary notes reset the deadline, editing preserves it and deleting all notes restores the frequency start", async ({
  page,
  database,
}) => {
  const id = await database.contact(
    `Обычные заметки ${randomUUID()}`,
    "week",
    daysAgo(3),
  );
  await database.note(id, "Более старая заметка", daysAgo(30));
  await database.note(id, "Последняя старая заметка", daysAgo(15));
  await page.goto(`/contacts/${id}`);
  await expect(
    page.getByText("Пора связаться · просрочено на 8 дней", { exact: true }),
  ).toBeVisible();

  await test.step("editing an old latest note keeps its original timestamp and overdue days", async () => {
    const before = (await database.notes(id))[0];
    await editNote(
      page,
      "Последняя старая заметка",
      "Исправленная старая заметка",
    );
    expect((await database.notes(id))[0].created_at).toEqual(before.created_at);
    await expect(
      page.getByText("Пора связаться · просрочено на 8 дней", { exact: true }),
    ).toBeVisible();
  });

  await test.step("adding a conversation note clears the card and home overdue state", async () => {
    await page
      .getByRole("textbox", { name: "Новая заметка", exact: true })
      .fill("Поговорили сегодня");
    await page
      .getByRole("button", { name: "Добавить заметку", exact: true })
      .click();
    await expect(noteItem(page, "Поговорили сегодня")).toHaveCount(1);
    await expect(
      page.getByText(dueText(daysAgo(-7)), { exact: true }),
    ).toBeVisible();
    await page.goto("/");
    await expect(overdueBlock(page)).toHaveCount(0);
  });

  await test.step("deleting each newest note restores the previous date, then the original frequency start", async () => {
    await page.goto(`/contacts/${id}`);
    await removeNote(page, noteItem(page, "Поговорили сегодня"));
    await expect(
      page.getByText("Пора связаться · просрочено на 8 дней", { exact: true }),
    ).toBeVisible();
    await page.goto("/");
    await expect(overdueBlock(page).getByRole("listitem")).toHaveCount(1);
    await page.goto(`/contacts/${id}`);
    await removeNote(page, noteItem(page, "Исправленная старая заметка"));
    await expect(
      page.getByText("Пора связаться · просрочено на 23 дня", { exact: true }),
    ).toBeVisible();
    await removeNote(page, noteItem(page, "Более старая заметка"));
    await expect(
      page.getByText("Заметок пока нет.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(dueText(daysAgo(-4)), { exact: true }),
    ).toBeVisible();
    expect((await database.contactState(id)).contact_frequency_set_at).toEqual(
      daysAgo(3),
    );
    await page.goto("/");
    await expect(overdueBlock(page)).toHaveCount(0);
  });
});
