import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import * as schema from "../db/auth-schema.ts";
import { emailSchema } from "./email.ts";
import { createMailSender } from "./mail.ts";

const SESSION_SECONDS = 30 * 24 * 60 * 60;
const tokenDigest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function createAuthBoundary(
  pool: Pool,
  env: Record<string, string | undefined> = process.env,
) {
  const baseURL = new URL(z.url().parse(env.BETTER_AUTH_URL));
  if (
    baseURL.pathname !== "/" ||
    baseURL.search ||
    baseURL.hash ||
    baseURL.username ||
    baseURL.password
  )
    throw new Error("BETTER_AUTH_URL must be an application origin.");
  const origin = baseURL.origin;
  const secret = z.string().min(32).parse(env.BETTER_AUTH_SECRET);
  const sendMail = createMailSender(env);
  const stale = () => Response.redirect(`${origin}/login/stale`, 302);

  function auth(
    connection: Pool | PoolClient,
    sendMagicLink?: (data: {
      email: string;
      url: string;
      token: string;
    }) => Promise<void>,
  ) {
    return betterAuth({
      baseURL: origin,
      basePath: "/api/auth",
      secret,
      trustedOrigins: [origin],
      database: drizzleAdapter(drizzle(connection, { schema }), {
        provider: "pg",
        schema,
      }),
      emailAndPassword: { enabled: false },
      session: {
        expiresIn: SESSION_SECONDS,
        updateAge: 0,
        cookieCache: { enabled: false },
      },
      // The durable per-recipient quota below covers all public issuance routes.
      rateLimit: { enabled: false },
      advanced: {
        useSecureCookies: baseURL.protocol === "https:",
        database: { generateId: () => randomUUID() },
      },
      onAPIError: {
        onError: () => {
          console.error("Authentication library operation failed.");
        },
      },
      logger: { disabled: true },
      telemetry: { enabled: false },
      plugins: [
        magicLink({
          expiresIn: 900,
          storeToken: {
            type: "custom-hasher",
            hash: async (token) => tokenDigest(token),
          },
          sendMagicLink:
            sendMagicLink ??
            (async () => {
              throw new Error(
                "Magic link issuance requires the guarded boundary.",
              );
            }),
        }),
      ],
    });
  }

  async function withEmailLock<T>(
    email: string,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    let locked = false;
    let discard = false;
    try {
      await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [
        `magic-link:${email}`,
      ]);
      locked = true;
      // Better Auth uses this same client: waiting recipients cannot exhaust a second pool.
      return await work(client);
    } finally {
      try {
        if (locked)
          await client.query(
            "select pg_advisory_unlock(hashtextextended($1, 0))",
            [`magic-link:${email}`],
          );
      } catch {
        discard = true;
      }
      client.release(discard);
    }
  }

  async function issue(request: Request) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ code: "INVALID_EMAIL" }, { status: 400 });
    }
    const parsed = emailSchema.safeParse(
      body && typeof body === "object" && "email" in body
        ? body.email
        : undefined,
    );
    if (!parsed.success)
      return Response.json({ code: "INVALID_EMAIL" }, { status: 400 });
    const email = parsed.data;
    return withEmailLock(email, async (client) => {
      await client.query(
        "insert into magic_link_requests (email) values ($1) on conflict do nothing",
        [email],
      );
      const state = (
        await client.query<{ recent_send_times: string[]; current_time: Date }>(
          "select recent_send_times, clock_timestamp() as current_time from magic_link_requests where email=$1",
          [email],
        )
      ).rows[0];
      const now = state.current_time.getTime();
      const times = state.recent_send_times.filter(
        (time) => new Date(time).getTime() > now - 600_000,
      );
      if (times.length >= 3)
        return Response.json({ code: "EMAIL_RATE_LIMIT" }, { status: 429 });
      times.push(new Date(now).toISOString());
      await client.query(
        "update magic_link_requests set recent_send_times=$2::jsonb where email=$1",
        [email, JSON.stringify(times)],
      );
      const guarded = auth(client, async (data) => {
        const digest = tokenDigest(data.token);
        await client.query(
          "insert into magic_link_tokens (digest, email, expires_at) values ($1,$2,clock_timestamp()+interval '900 seconds')",
          [digest, email],
        );
        await client.query(
          "update magic_link_requests set current_token_digest=$2 where email=$1",
          [email, digest],
        );
        await client.query(
          "delete from magic_link_tokens where expires_at <= clock_timestamp()",
        );
        try {
          await sendMail(email, data.url);
        } catch (error) {
          const code =
            error &&
            typeof error === "object" &&
            "code" in error &&
            [
              "ECONNECTION",
              "ETIMEDOUT",
              "EAUTH",
              "ESOCKET",
              "ETLS",
              "EENVELOPE",
            ].includes(String(error.code))
              ? String(error.code)
              : "DELIVERY_FAILED";
          console.error(
            `Sign-in email delivery failed (${code}); reserved quota retained.`,
          );
        }
      });
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      headers.set("content-type", "application/json");
      const response = await guarded.handler(
        new Request(`${origin}/api/auth/sign-in/magic-link`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            email,
            callbackURL: "/",
            newUserCallbackURL: "/",
            errorCallbackURL: "/login/stale",
          }),
        }),
      );
      if (!response.ok) return response;
      return Response.json(
        { status: true, email },
        { headers: { "cache-control": "no-store" } },
      );
    });
  }

  async function verify(request: Request) {
    const token = new URL(request.url).searchParams.get("token");
    if (!token || token.length > 1024) return stale();
    const digest = tokenDigest(token);
    const lookup = (
      await pool.query<{ email: string }>(
        "select email from magic_link_tokens where digest=$1",
        [digest],
      )
    ).rows[0];
    if (!lookup) return stale();
    return withEmailLock(lookup.email, async (client) => {
      const state = (
        await client.query(
          "select t.digest from magic_link_tokens t join magic_link_requests r on r.email=t.email where t.digest=$1 and r.current_token_digest=t.digest and t.expires_at > clock_timestamp()",
          [digest],
        )
      ).rows[0];
      if (!state) return stale();
      const url = new URL(`${origin}/api/auth/magic-link/verify`);
      url.searchParams.set("token", token);
      url.searchParams.set("callbackURL", "/");
      url.searchParams.set("newUserCallbackURL", "/");
      url.searchParams.set("errorCallbackURL", "/login/stale");
      const response = await auth(client).handler(
        new Request(url, { headers: request.headers }),
      );
      if (
        response.status !== 302 ||
        response.headers.get("location") !== `${origin}/` ||
        !response.headers.get("set-cookie")
      )
        return stale();
      await client.query(
        "update magic_link_requests set current_token_digest=null where email=$1 and current_token_digest=$2",
        [lookup.email, digest],
      );
      response.headers.set("cache-control", "no-store");
      return response;
    });
  }

  const sessionAuth = auth(pool);
  return {
    getSession: (headers: Headers) =>
      sessionAuth.api.getSession({
        headers,
        query: { disableRefresh: true, disableCookieCache: true },
      }),
    async handler(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname;
      const requestOrigin = request.headers.get("origin");
      if (requestOrigin && requestOrigin !== origin)
        return Response.json({ code: "INVALID_ORIGIN" }, { status: 403 });
      try {
        if (
          path === "/api/auth/sign-in/magic-link" &&
          request.method === "POST"
        )
          return await issue(request);
        if (path === "/api/auth/magic-link/verify" && request.method === "GET")
          return await verify(request);
        if (
          (path === "/api/auth/get-session" && request.method === "GET") ||
          (path === "/api/auth/sign-out" && request.method === "POST")
        )
          return await sessionAuth.handler(request);
        return Response.json({ code: "NOT_FOUND" }, { status: 404 });
      } catch {
        console.error("Authentication operation failed.");
        return Response.json(
          { code: "AUTHENTICATION_FAILED" },
          { status: 503 },
        );
      }
    },
  };
}
