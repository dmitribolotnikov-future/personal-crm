import { z } from "zod";
import { emailSchema } from "./email.ts";

export function mailConfiguration(
  env: Record<string, string | undefined> = process.env,
) {
  const host = z.string().min(1).parse(env.SMTP_HOST);
  const port = z.coerce.number().int().min(1).max(65535).parse(env.SMTP_PORT);
  const secure = z.enum(["true", "false"]).parse(env.SMTP_SECURE) === "true";
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD))
    throw new Error(
      "Both SMTP_USER and SMTP_PASSWORD are required for SMTP authentication.",
    );
  return {
    host,
    port,
    secure,
    requireTLS: !secure && !["localhost", "127.0.0.1", "::1"].includes(host),
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD! }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&#39;");
}

export function signInMessage(
  email: string,
  link: string,
  env: Record<string, string | undefined> = process.env,
) {
  const baseURL = new URL(z.url().parse(env.BETTER_AUTH_URL));
  const url = new URL(link);
  if (
    url.origin !== baseURL.origin ||
    url.pathname !== "/api/auth/magic-link/verify" ||
    !url.searchParams.get("token")
  )
    throw new Error(
      "Sign-in URL must use the trusted application origin and verification path.",
    );
  const ignore = "Если вы не запрашивали вход - просто проигнорируйте письмо";
  return {
    from: { name: "Личная CRM", address: emailSchema.parse(env.MAIL_FROM) },
    to: emailSchema.parse(email),
    subject: "Вход в Личную CRM",
    text: `Войти: ${url.href}\n\nСсылка работает 15 минут.\n\n${ignore}`,
    html: `<html lang="ru"><body><h1>Вход в Личную CRM</h1><p><a href="${escapeHtml(url.href)}">Войти</a></p><p>Ссылка работает 15 минут.</p><p>${ignore}</p></body></html>`,
  };
}
