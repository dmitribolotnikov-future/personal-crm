import { describe, expect, it } from "vitest";

import { saveContact } from "./contact-mutations";
import { readContactValues } from "./form-state";
import { contactSchema } from "./validation";

function form(frequency?: string) {
  const data = new FormData();
  data.set("name", "Анна");
  if (frequency !== undefined) data.set("contactFrequency", frequency);
  return data;
}

describe("contact frequency form values", () => {
  it.each([undefined, ""])("treats %s as an unset frequency", (frequency) => {
    expect(
      contactSchema.parse(readContactValues(form(frequency))).contactFrequency,
    ).toBeNull();
  });

  it.each(["week", "month", "quarter", "year"])(
    "preserves the %s choice",
    (frequency) => {
      expect(
        contactSchema.parse(readContactValues(form(frequency)))
          .contactFrequency,
      ).toBe(frequency);
    },
  );

  it.each(["day", "Week", "toString", " month "])(
    "rejects the invalid choice %s",
    (frequency) => {
      const parsed = contactSchema.safeParse(
        readContactValues(form(frequency)),
      );
      expect(parsed.success).toBe(false);
      if (!parsed.success)
        expect(parsed.error.issues[0].path).toEqual(["contactFrequency"]);
    },
  );

  it("returns the selected frequency after another field fails without reaching the database", async () => {
    const data = form("month");
    data.set("email", "invalid");
    const values = readContactValues(data);
    // No dependency is supplied: any database access would fail this test.
    const result = await saveContact(undefined as never, values);
    expect(result).toMatchObject({
      values: { contactFrequency: "month" },
      errors: { email: [expect.any(String)] },
    });
    expect("values" in result && result.values).toEqual(values);
  });
});
