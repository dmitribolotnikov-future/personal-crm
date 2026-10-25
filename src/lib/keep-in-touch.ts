// Due dates for keeping in touch. Pure functions without the database, so the contact
// card and the "Пора связаться" block count the same way and a test can check them.
// Dates are calendar dates in the timezone of the process, the same one format.ts
// uses to show note dates.

import type { ContactFrequency } from "@/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

// Insertion order is the order of the choices in the form
const frequencyPhrases: Record<ContactFrequency, string> = {
  week: "раз в неделю",
  month: "раз в месяц",
  quarter: "раз в квартал",
  year: "раз в год",
};

export const frequencyValues = Object.keys(
  frequencyPhrases,
) as ContactFrequency[];

export function isContactFrequency(value: string): value is ContactFrequency {
  return (frequencyValues as string[]).includes(value);
}

// "раз в месяц"
export function frequencyPhrase(frequency: ContactFrequency): string {
  return frequencyPhrases[frequency];
}

// A day without a time; month is 1-12
export type CalendarDate = { year: number; month: number; day: number };

function toCalendarDate(moment: Date): CalendarDate {
  return {
    year: moment.getFullYear(),
    month: moment.getMonth() + 1,
    day: moment.getDate(),
  };
}

// Days since the epoch: a whole number, so differences ignore daylight saving time
function dayNumber({ year, month, day }: CalendarDate): number {
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const moved = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  };
}

// Same day number later; if the month is too short, its last day: 31 Jan + 1 month = 28 Feb
function addMonths(date: CalendarDate, months: number): CalendarDate {
  const monthIndex = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, day: Math.min(date.day, lastDay) };
}

// The date by which to talk to the contact again, counted from startedAt
export function nextContactDate(
  startedAt: Date,
  frequency: ContactFrequency,
): CalendarDate {
  const start = toCalendarDate(startedAt);
  switch (frequency) {
    case "week":
      return addDays(start, 7);
    case "month":
      return addMonths(start, 1);
    case "quarter":
      return addMonths(start, 3);
    case "year":
      return addMonths(start, 12);
  }
}

export type KeepInTouchState = {
  dueOn: CalendarDate;
  overdue: boolean;
  // Whole calendar days since dueOn; 0 on the due day itself
  overdueDays: number;
};

export type KeepInTouchInput = {
  frequency: ContactFrequency | null;
  // Newest note of the contact, if there are any
  lastNoteAt: Date | null;
  // When the frequency was set or last changed
  frequencySetAt: Date | null;
};

// Null for a contact without a frequency: it has no due date at all
export function getKeepInTouchState(
  { frequency, lastNoteAt, frequencySetAt }: KeepInTouchInput,
  now: Date = new Date(),
): KeepInTouchState | null {
  // The newest note wins; the moment the frequency was set only matters while there are none
  const startedAt = lastNoteAt ?? frequencySetAt;
  if (!frequency || !startedAt) return null;

  const dueOn = nextContactDate(startedAt, frequency);
  const overdueDays = Math.max(
    0,
    dayNumber(toCalendarDate(now)) - dayNumber(dueOn),
  );
  return { dueOn, overdue: overdueDays > 0, overdueDays };
}

// "1 день", "2 дня", "5 дней", "21 день", "11 дней"
export function formatDays(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  let word = "дней";
  if (lastTwo < 11 || lastTwo > 14) {
    if (last === 1) word = "день";
    else if (last >= 2 && last <= 4) word = "дня";
  }
  return `${count} ${word}`;
}

// "просрочено на 5 дней"
export function formatOverdue(overdueDays: number): string {
  return `просрочено на ${formatDays(overdueDays)}`;
}
