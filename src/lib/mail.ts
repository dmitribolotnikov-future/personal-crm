import "server-only";
import nodemailer from "nodemailer";
import { mailConfiguration, signInMessage } from "./mail-message.ts";

export function createMailSender(
  env: Record<string, string | undefined> = process.env,
) {
  const transport = nodemailer.createTransport(mailConfiguration(env));
  return async (email: string, url: string) => {
    await transport.sendMail(signInMessage(email, url, env));
  };
}
