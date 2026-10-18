import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";

// Smoke check for deploys and the container healthcheck:
// 200 when the app is up and the database answers, 503 otherwise
export async function GET() {
  await connection();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed: database is unreachable", error);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
