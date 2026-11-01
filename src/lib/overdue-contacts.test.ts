import { describe, expect, it } from "vitest";

import { selectOverdueContacts } from "./keep-in-touch";

const now = new Date(2026, 9, 9, 12);
const row = (id: number, name: string, day: number) => ({
  id,
  name,
  contactFrequency: "week" as const,
  contactFrequencySetAt: null,
  lastNoteAt: new Date(2026, 9, day, 12),
});

describe("selectOverdueContacts", () => {
  it("excludes unset frequencies, future dates and the due day itself", () => {
    expect(
      selectOverdueContacts(
        [
          { ...row(1, "Без частоты", 1), contactFrequency: null },
          row(2, "Будущий срок", 3),
          row(3, "Срок сегодня", 2),
          row(4, "Просрочен", 1),
        ],
        now,
      ),
    ).toEqual([{ id: 4, name: "Просрочен", overdueDays: 1 }]);
  });

  it("sorts the most overdue first without changing its input", () => {
    const rows = [
      row(1, "Анна", -1),
      row(2, "Борис", -38),
      row(3, "Вера", -10),
    ];
    const before = structuredClone(rows);
    expect(selectOverdueContacts(rows, now)).toEqual([
      { id: 2, name: "Борис", overdueDays: 40 },
      { id: 3, name: "Вера", overdueDays: 12 },
      { id: 1, name: "Анна", overdueDays: 3 },
    ]);
    expect(rows).toEqual(before);
  });

  it("preserves database name and id order for equal overdue days", () => {
    expect(
      selectOverdueContacts(
        [row(1, "Анна", -5), row(2, "Анна", -5), row(3, "Вера", -5)],
        now,
      ).map((contact) => contact.id),
    ).toEqual([1, 2, 3]);
  });

  it("uses the frequency start when there are no notes and hides an empty block", () => {
    expect(
      selectOverdueContacts(
        [
          {
            ...row(1, "Анна", 1),
            lastNoteAt: null,
            contactFrequencySetAt: new Date(2026, 9, 1),
          },
        ],
        now,
      ),
    ).toEqual([{ id: 1, name: "Анна", overdueDays: 1 }]);
    expect(selectOverdueContacts([], now)).toEqual([]);
  });
});
