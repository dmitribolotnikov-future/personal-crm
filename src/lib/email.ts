import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export function getLegacyOwnerEmail(
  env: Record<string, string | undefined> = process.env,
): string {
  const result = emailSchema.safeParse(env.LEGACY_OWNER_EMAIL);
  if (!result.success)
    throw new Error(
      "Set LEGACY_OWNER_EMAIL to a valid owner email before migration or seeding.",
    );
  return result.data;
}
