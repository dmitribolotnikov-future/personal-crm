import { z } from "zod";

// Error messages are shown to the user, so they are in Russian

const MAX_DB_INT = 2147483647;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .transform((value) => value || null);

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(200, "Не длиннее 200 символов"),
  about: optionalText(500),
  howWeMet: optionalText(1000),
  phone: optionalText(50),
  email: z
    .string()
    .trim()
    .max(254, "Не длиннее 254 символов")
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Похоже, в адресе почты ошибка",
    )
    .transform((value) => value || null),
});

export const noteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Заметка пустая")
    .max(10000, "Не длиннее 10 000 символов"),
});

// Ids bound to server actions arrive from the browser, so they are re-checked
export const idSchema = z.number().int().min(1).max(MAX_DB_INT);

// Parses an id from the URL; returns null for anything that is not a valid id
export function parseId(value: string): number | null {
  if (!/^\d{1,10}$/.test(value)) return null;
  const id = Number(value);
  return id >= 1 && id <= MAX_DB_INT ? id : null;
}
