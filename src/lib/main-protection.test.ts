import { expect, test } from "vitest";

test("intentionally fails to verify that main requires passing CI", () => {
  expect(true).toBe(false);
});
