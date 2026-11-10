import { setTimeout } from "node:timers/promises";

export type CapturedMail = {
  ID: string;
  Subject: string;
  From: { Name: string; Address: string };
  To: { Address: string }[];
  Text: string;
  HTML: string;
};

function inboxURL() {
  const value = process.env.MAILPIT_URL;
  if (
    !value ||
    process.env.E2E_DATABASE_ISOLATED !== "1" ||
    new URL(value).hostname !== "127.0.0.1"
  )
    throw new Error(
      "Mailpit helpers require the isolated loopback-only test inbox.",
    );
  return value;
}

export async function capturedMessages(email: string): Promise<CapturedMail[]> {
  const response = await fetch(`${inboxURL()}/api/v1/messages?limit=1000`);
  if (!response.ok) throw new Error("Cannot read the isolated Mailpit inbox.");
  const result = (await response.json()) as { messages: CapturedMail[] };
  return result.messages.filter((message) =>
    message.To.some(
      (recipient) =>
        recipient.Address.toLowerCase() === email.trim().toLowerCase(),
    ),
  );
}

export async function waitForMail(
  email: string,
  excludeIds: string[] = [],
): Promise<CapturedMail> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const messages = await capturedMessages(email);
    const message = messages.find((item) => !excludeIds.includes(item.ID));
    if (message) {
      const response = await fetch(
        `${inboxURL()}/api/v1/message/${encodeURIComponent(message.ID)}`,
      );
      if (!response.ok) throw new Error("Cannot read the captured message.");
      return (await response.json()) as CapturedMail;
    }
    await setTimeout(100);
  }
  throw new Error("No sign-in email arrived for the exact test recipient.");
}

export function mailLink(message: CapturedMail) {
  const link = message.Text.match(
    /https?:\/\/[^\s]+\/api\/auth\/magic-link\/verify\?[^\s]+/,
  )?.[0];
  if (
    !link ||
    new URL(link).origin !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    throw new Error("Captured message has no trusted sign-in link.");
  return link;
}
