import { headers } from "next/headers";
import { connection } from "next/server";
import { getAuth } from "@/lib/auth";
import { AccountMenu } from "@/components/account-menu";

export async function AccountHeader() {
  await connection();
  const session = await getAuth().getSession(await headers());
  return session ? <AccountMenu email={session.user.email} /> : null;
}
