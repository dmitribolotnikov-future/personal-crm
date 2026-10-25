import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatDays,
  formatOverdue,
  frequencyPhrase,
  frequencyValues,
  getKeepInTouchState,
  isContactFrequency,
  nextContactDate,
} from "./keep-in-touch";

// Dates are counted in the timezone of the process, so fix it here: a variable in the
// pnpm script would not work on Windows. A zone with daylight saving time on purpose.
process.env.TZ = "Europe/Berlin";

// Local time of the process; the month is 1-12 like in the app
function at(year: number, month: number, day: number, hour = 12, minute = 0) {
  return new Date(year, month - 1, day, hour, minute);
}

function date(year: number, month: number, day: number) {
  return { year, month, day };
}

describe("nextContactDate", () => {
  it("adds 7 days for a week", () => {
    assert.deepEqual(nextContactDate(at(2026, 10, 1), "week"), date(2026, 10, 8));
  });

  it("carries a week over the end of the month and the year", () => {
    assert.deepEqual(nextContactDate(at(2026, 12, 28), "week"), date(2027, 1, 4));
  });

  it("keeps the same day number for a month", () => {
    assert.deepEqual(nextContactDate(at(2026, 10, 12), "month"), date(2026, 11, 12));
  });

  it("uses the last day of a shorter month", () => {
    assert.deepEqual(nextContactDate(at(2026, 1, 31), "month"), date(2026, 2, 28));
    assert.deepEqual(nextContactDate(at(2026, 3, 31), "month"), date(2026, 4, 30));
  });

  it("carries a month over the end of the year", () => {
    assert.deepEqual(nextContactDate(at(2026, 12, 31), "month"), date(2027, 1, 31));
  });

  it("adds 3 months for a quarter", () => {
    assert.deepEqual(nextContactDate(at(2026, 11, 15), "quarter"), date(2027, 2, 15));
  });

  it("uses the last day of a shorter month for a quarter", () => {
    assert.deepEqual(nextContactDate(at(2026, 11, 30), "quarter"), date(2027, 2, 28));
  });

  it("adds a year", () => {
    assert.deepEqual(nextContactDate(at(2026, 10, 24), "year"), date(2027, 10, 24));
  });

  it("moves 29 February to 28 February of a common year", () => {
    assert.deepEqual(nextContactDate(at(2028, 2, 29), "year"), date(2029, 2, 28));
  });

  it("keeps 29 February when the next year is a leap year too", () => {
    assert.deepEqual(nextContactDate(at(2028, 2, 29), "month"), date(2028, 3, 29));
  });

  it("goes by the local calendar day, not the time of day", () => {
    assert.deepEqual(nextContactDate(at(2026, 10, 1, 0, 30), "week"), date(2026, 10, 8));
    assert.deepEqual(nextContactDate(at(2026, 10, 1, 23, 30), "week"), date(2026, 10, 8));
  });

  it("is not thrown off by the clocks changing", () => {
    // Clocks went forward on 29 March 2026
    assert.deepEqual(nextContactDate(at(2026, 3, 25), "week"), date(2026, 4, 1));
  });
});

describe("getKeepInTouchState", () => {
  const weekly = {
    frequency: "week" as const,
    lastNoteAt: at(2026, 10, 1),
    frequencySetAt: null,
  };

  it("is not overdue on the due day", () => {
    assert.deepEqual(getKeepInTouchState(weekly, at(2026, 10, 8, 23, 59)), {
      dueOn: date(2026, 10, 8),
      overdue: false,
      overdueDays: 0,
    });
  });

  it("is not overdue before the due day", () => {
    const state = getKeepInTouchState(weekly, at(2026, 10, 5));
    assert.equal(state?.overdue, false);
    assert.equal(state?.overdueDays, 0);
  });

  it("is overdue by 1 day on the day after", () => {
    assert.deepEqual(getKeepInTouchState(weekly, at(2026, 10, 9, 0, 1)), {
      dueOn: date(2026, 10, 8),
      overdue: true,
      overdueDays: 1,
    });
  });

  it("counts calendar days across the clocks changing", () => {
    const state = getKeepInTouchState(
      { ...weekly, lastNoteAt: at(2026, 3, 1) },
      at(2026, 4, 5),
    );
    assert.equal(state?.overdueDays, 28);
  });

  it("shows the due date of a contact that is not overdue yet", () => {
    const state = getKeepInTouchState(
      { frequency: "month", lastNoteAt: at(2026, 10, 12), frequencySetAt: null },
      at(2026, 10, 24),
    );
    assert.deepEqual(state, {
      dueOn: date(2026, 11, 12),
      overdue: false,
      overdueDays: 0,
    });
  });

  it("counts from the newest note, not from when the frequency was set", () => {
    // Last note 5 months ago, frequency set today: overdue right away
    const state = getKeepInTouchState(
      {
        frequency: "month",
        lastNoteAt: at(2026, 5, 24),
        frequencySetAt: at(2026, 10, 24),
      },
      at(2026, 10, 24),
    );
    assert.equal(state?.overdue, true);
    // Due 24 June
    assert.equal(state?.overdueDays, 122);
  });

  it("counts from when the frequency was set if there are no notes", () => {
    const state = getKeepInTouchState(
      { frequency: "month", lastNoteAt: null, frequencySetAt: at(2026, 10, 24) },
      at(2026, 10, 24),
    );
    assert.deepEqual(state, {
      dueOn: date(2026, 11, 24),
      overdue: false,
      overdueDays: 0,
    });
  });

  it("has no state without a frequency", () => {
    const state = getKeepInTouchState(
      { frequency: null, lastNoteAt: at(2020, 1, 1), frequencySetAt: null },
      at(2026, 10, 24),
    );
    assert.equal(state, null);
  });

  it("has no state without a frequency even when a moment is left over", () => {
    const state = getKeepInTouchState(
      { frequency: null, lastNoteAt: null, frequencySetAt: at(2020, 1, 1) },
      at(2026, 10, 24),
    );
    assert.equal(state, null);
  });

  it("has no state when there is nothing to count from", () => {
    const state = getKeepInTouchState(
      { frequency: "week", lastNoteAt: null, frequencySetAt: null },
      at(2026, 10, 24),
    );
    assert.equal(state, null);
  });
});

describe("formatDays", () => {
  const cases: [number, string][] = [
    [1, "1 день"],
    [2, "2 дня"],
    [4, "4 дня"],
    [5, "5 дней"],
    [11, "11 дней"],
    [12, "12 дней"],
    [14, "14 дней"],
    [21, "21 день"],
    [22, "22 дня"],
    [25, "25 дней"],
    [100, "100 дней"],
    [101, "101 день"],
    [111, "111 дней"],
    [400, "400 дней"],
  ];

  for (const [count, expected] of cases) {
    it(`writes ${count} as "${expected}"`, () => {
      assert.equal(formatDays(count), expected);
    });
  }
});

describe("labels", () => {
  it("writes how much is overdue", () => {
    assert.equal(formatOverdue(5), "просрочено на 5 дней");
    assert.equal(formatOverdue(21), "просрочено на 21 день");
  });

  it("accepts only the four frequencies", () => {
    for (const value of ["week", "month", "quarter", "year"]) {
      assert.equal(isContactFrequency(value), true);
    }
    for (const value of ["", "day", "Week", "toString", "constructor"]) {
      assert.equal(isContactFrequency(value), false);
    }
  });

  it("names every frequency", () => {
    assert.deepEqual(frequencyValues, ["week", "month", "quarter", "year"]);
    assert.deepEqual(frequencyValues.map(frequencyPhrase), [
      "раз в неделю",
      "раз в месяц",
      "раз в квартал",
      "раз в год",
    ]);
  });
});
