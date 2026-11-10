import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db";
import { createAuthBoundary } from "./auth-runtime";

let boundary: ReturnType<typeof createAuthBoundary> | undefined;
export function getAuth() {
  boundary ??= createAuthBoundary(getDb().$client);
  return boundary;
}

// React cache deduplicates only inside this server request, never between accounts.
export const requireUser = cache(async () => {
  await connection();
  const session = await getAuth().getSession(await headers());
  if (!session) redirect("/login");
  return session.user;
});
