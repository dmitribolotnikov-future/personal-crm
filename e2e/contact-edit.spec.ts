import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";

import { daysAgo, test } from "./helpers/database";

test("reopening contact editing shows saved values without reloading and discards cancelled changes", async ({
  page,
  database,
}) => {
  const suffix = randomUUID();
  const id = await database.contact(`Контакт ${suffix}`, "week", daysAgo(0));
  const groupNames = [`Друзья ${suffix}`, `Теннис ${suffix}`];
  const { rows: groups } = await database.pool.query<{ id: number }>(
    "insert into contact_groups (name, normalized_name, owner_id) values ($1, lower($1),$3), ($2, lower($2),$3) returning id",
    [...groupNames, database.ownerId],
  );
  await database.pool.query(
    "insert into contact_group_memberships (contact_id, group_id, owner_id) values ($1, $2, $3)",
    [id, groups[0].id, database.ownerId],
  );
  const phone = () =>
    page.getByRole("textbox", { name: "Телефон", exact: true });
  const frequency = (name: string) =>
    page.getByRole("radio", { name, exact: true });
  const group = (name: string) =>
    page.getByRole("checkbox", { name, exact: true });
  const openEdit = () =>
    page.getByRole("link", { name: "Изменить", exact: true }).click();
  const save = async () => {
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/contacts/${id}$`));
  };
  const cancel = async () => {
    await page.getByRole("link", { name: "Отмена", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/contacts/${id}$`));
  };

  try {
    await page.goto(`/contacts/${id}`);
    await test.step("save phone, frequency and a replacement group, then reopen via the edit link", async () => {
      await openEdit();
      await expect(frequency("Раз в неделю")).toBeChecked();
      await expect(group(groupNames[0])).toBeChecked();
      await phone().fill("+79000000001");
      await page.getByText("Раз в месяц", { exact: true }).click();
      await page
        .getByText(groupNames[0], { exact: true })
        .filter({ visible: true })
        .click();
      await page
        .getByText(groupNames[1], { exact: true })
        .filter({ visible: true })
        .click();
      await save();
      await openEdit();
      await expect(phone()).toHaveValue("+79000000001");
      await expect(frequency("Раз в месяц")).toBeChecked();
      await expect(group(groupNames[0])).not.toBeChecked();
      await expect(group(groupNames[1])).toBeChecked();
    });

    await test.step("inline group creation preserves the current draft and remains assigned after cancelling", async () => {
      await phone().fill("+79000000002");
      await page.getByText("Раз в год", { exact: true }).click();
      await page
        .getByText(groupNames[1], { exact: true })
        .filter({ visible: true })
        .click();
      await page
        .getByRole("button", { name: "Создать новую группу", exact: true })
        .click();
      const groupName = `Коллеги ${suffix}`;
      await page
        .getByRole("textbox", { name: "Название новой группы", exact: true })
        .fill(groupName);
      await page.getByRole("button", { name: "Создать", exact: true }).click();
      await expect(group(groupName)).toBeChecked();
      await expect(phone()).toHaveValue("+79000000002");
      await expect(frequency("Раз в год")).toBeChecked();
      await expect(group(groupNames[1])).not.toBeChecked();
      await cancel();
      await openEdit();
      await expect(phone()).toHaveValue("+79000000001");
      await expect(frequency("Раз в месяц")).toBeChecked();
      await expect(group(groupNames[1])).toBeChecked();
      await expect(group(groupName)).toBeChecked();
    });

    await test.step("clearing phone, frequency and all groups is reflected on the next edit", async () => {
      await phone().fill("");
      await page.getByText("Не задано", { exact: true }).click();
      await page
        .getByText(groupNames[1], { exact: true })
        .filter({ visible: true })
        .click();
      await page
        .getByText(`Коллеги ${suffix}`, { exact: true })
        .filter({ visible: true })
        .click();
      await save();
      await openEdit();
      await expect(phone()).toHaveValue("");
      await expect(frequency("Не задано")).toBeChecked();
      await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(
        0,
      );
      await save();
      expect((await database.contactState(id)).contact_frequency).toBeNull();
      const { rows } = await database.pool.query(
        "select group_id from contact_group_memberships where contact_id = $1",
        [id],
      );
      expect(rows).toEqual([]);
    });
  } finally {
    await database.pool.query(
      "delete from contact_groups where name = any($1::text[])",
      [[...groupNames, `Коллеги ${suffix}`]],
    );
  }
});
