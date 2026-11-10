import { describe, expect, test } from "vitest";
import { emailSchema, getLegacyOwnerEmail } from "./email";

describe("email validation", () => {
  test("email variants share account and policy state", () => {
    expect(emailSchema.parse("  OWNER@Example.Test  ")).toBe(
      "owner@example.test",
    );
  });
  test("invalid direct sign-in request sends no mail", () => {
    for (const email of [
      "",
      " ",
      "owner",
      "owner@",
      "@example.test",
      "a\nb@example.test",
      null,
      123,
    ]) {
      expect(emailSchema.safeParse(email).success).toBe(false);
    }
  });
  test("missing or invalid legacy owner input has no fallback", () => {
    for (const value of [undefined, "", " ", "invalid"]) {
      expect(() => getLegacyOwnerEmail({ LEGACY_OWNER_EMAIL: value })).toThrow(
        /LEGACY_OWNER_EMAIL/,
      );
    }
    expect(
      getLegacyOwnerEmail({ LEGACY_OWNER_EMAIL: " OWNER@Example.Test " }),
    ).toBe("owner@example.test");
  });
});
