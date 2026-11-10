import { expect, test } from "vitest";
import { mailConfiguration, signInMessage } from "./mail-message";

const env = {
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
  SMTP_SECURE: "false",
  MAIL_FROM: "noreply@mail.crm.example.test",
  BETTER_AUTH_URL: "http://127.0.0.1:3100",
};

test("sign-in email matches content and trusted URL", () => {
  const link = `${env.BETTER_AUTH_URL}/api/auth/magic-link/verify?token=abc&callbackURL=%2F`;
  const message = signInMessage("owner@example.test", link, env);
  expect(message.from).toEqual({ name: "Личная CRM", address: env.MAIL_FROM });
  expect(message.subject).toBe("Вход в Личную CRM");
  expect(message.to).toBe("owner@example.test");
  expect(message.text).toContain("15 минут");
  expect(message.text).toContain(
    "Если вы не запрашивали вход - просто проигнорируйте письмо",
  );
  expect(message.text).toContain(link);
  expect(message.html).toContain(">Войти</a>");
  expect(message.html).toContain("token=abc&amp;callbackURL=%2F");
  expect(() =>
    signInMessage(
      "owner@example.test",
      "https://foreign.example.test/api/auth/magic-link/verify?token=abc",
      env,
    ),
  ).toThrow(/trusted/i);
});

test("SMTP transport is selected entirely by runtime configuration", () => {
  expect(mailConfiguration(env)).toMatchObject({
    host: "127.0.0.1",
    port: 1025,
    secure: false,
  });
  expect(
    mailConfiguration({
      ...env,
      SMTP_HOST: "smtp.resend.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "resend",
      SMTP_PASSWORD: "test-only-value",
    }),
  ).toMatchObject({
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    auth: { user: "resend", pass: "test-only-value" },
  });
  for (const bad of [
    { SMTP_PORT: "0" },
    { SMTP_PORT: "abc" },
    { SMTP_SECURE: "yes" },
    { SMTP_USER: "resend" },
  ]) {
    expect(() => mailConfiguration({ ...env, ...bad })).toThrow();
  }
});
