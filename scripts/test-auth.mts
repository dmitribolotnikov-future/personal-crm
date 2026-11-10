import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { isolatedPool } from "../e2e/helpers/database.ts";
import {
  capturedMessages,
  mailLink,
  waitForMail,
} from "../e2e/helpers/mailpit.ts";
import { createAuthBoundary } from "../src/lib/auth-runtime.ts";

const pool = isolatedPool();
const baseURL = process.env.BETTER_AUTH_URL!;
const boundary = createAuthBoundary(pool);
const address = () => `auth-${randomUUID()}@example.test`;
async function run(name: string, check: () => Promise<void>) {
  await check();
  console.log(`PASS ${name}`);
}
function issue(email: unknown, auth = boundary) {
  return auth.handler(
    new Request(`${baseURL}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseURL },
      body: JSON.stringify({
        email,
        callbackURL: "https://foreign.example.test",
      }),
    }),
  );
}
function redeem(url: string, auth = boundary) {
  return auth.handler(new Request(url));
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
function digest(url: string) {
  return createHash("sha256")
    .update(new URL(url).searchParams.get("token")!)
    .digest("hex");
}
async function link(email: string, exclude: string[] = []) {
  return mailLink(await waitForMail(email, exclude));
}
function signedIn(response: Response) {
  return (
    response.status === 302 &&
    response.headers.get("location") === `${baseURL}/` &&
    cookies(response).includes("session_token=")
  );
}

try {
  await run("invalid direct sign-in request sends no mail", async () => {
    assert.equal((await issue("invalid")).status, 400);
    assert.equal((await issue(null)).status, 400);
  });
  await run("sign-in email matches content and trusted URL", async () => {
    const email = address();
    assert.equal((await issue(email)).status, 200);
    const message = await waitForMail(email);
    assert.equal(message.From.Name, "Личная CRM");
    assert.equal(message.From.Address, process.env.MAIL_FROM);
    assert.equal(message.Subject, "Вход в Личную CRM");
    assert.ok(message.HTML.includes("Войти"));
    assert.ok(message.Text.includes("15 минут"));
    assert.ok(
      message.Text.includes(
        "Если вы не запрашивали вход - просто проигнорируйте письмо",
      ),
    );
    const url = new URL(mailLink(message));
    assert.equal(url.origin, baseURL);
    assert.equal(url.searchParams.get("callbackURL"), "/");
  });
  await run("first verification creates one passwordless account", async () => {
    const email = address();
    const firstResponse = await issue(email);
    const firstMail = await waitForMail(email);
    assert.ok(signedIn(await redeem(mailLink(firstMail))));
    const existingResponse = await issue(email);
    assert.deepEqual(await firstResponse.json(), await existingResponse.json());
    assert.ok(signedIn(await redeem(await link(email, [firstMail.ID]))));
    const users = (
      await pool.query(
        "select name, email_verified from auth_user where email=$1",
        [email],
      )
    ).rows;
    assert.deepEqual(users, [{ name: "", email_verified: true }]);
  });
  await run("new and existing email confirmations match", async () => {
    const email = address();
    const first = await issue(email);
    const message = await waitForMail(email);
    assert.ok(signedIn(await redeem(mailLink(message))));
    const existing = await issue(email);
    assert.deepEqual(await first.json(), await existing.json());
  });
  await run("email variants share account and policy state", async () => {
    const email = address();
    await issue(` ${email.toUpperCase()} `);
    assert.ok(signedIn(await redeem(await link(email))));
    await issue(email);
    await issue(` ${email.toUpperCase()} `);
    assert.equal((await issue(email)).status, 429);
    assert.equal(
      (
        await pool.query(
          "select count(*)::int n from auth_user where email=$1",
          [email],
        )
      ).rows[0].n,
      1,
    );
    assert.equal((await capturedMessages(email)).length, 3);
  });
  await run("latest unused link works before expiry", async () => {
    const email = address();
    await issue(email);
    const url = await link(email);
    await pool.query(
      "update magic_link_tokens set expires_at=now()+interval '1 minute' where digest=$1",
      [digest(url)],
    );
    assert.ok(signedIn(await redeem(url)));
  });
  await run("link expires at fifteen minutes", async () => {
    const email = address();
    await issue(email);
    const url = await link(email);
    const state = (
      await pool.query(
        "select expires_at from magic_link_tokens where digest=$1",
        [digest(url)],
      )
    ).rows[0];
    assert.ok(
      Math.abs(state.expires_at.getTime() - Date.now() - 900_000) < 10_000,
    );
    await pool.query(
      "update magic_link_tokens set expires_at=now() where digest=$1",
      [digest(url)],
    );
    assert.equal(
      (await redeem(url)).headers.get("location"),
      `${baseURL}/login/stale`,
    );
  });
  await run("link redemption succeeds only once", async () => {
    const email = address();
    await issue(email);
    const url = await link(email);
    const responses = await Promise.all([
      redeem(url),
      redeem(url),
      redeem(url),
    ]);
    assert.equal(responses.filter(signedIn).length, 1);
    assert.equal(
      responses.filter(
        (response) =>
          response.headers.get("location") === `${baseURL}/login/stale`,
      ).length,
      2,
    );
    assert.equal(
      (await redeem(url)).headers.get("location"),
      `${baseURL}/login/stale`,
    );
  });
  await run("new link invalidates earlier links", async () => {
    const email = address();
    await issue(email);
    const firstMail = await waitForMail(email);
    await issue(email);
    const newest = await link(email, [firstMail.ID]);
    assert.equal(
      (await redeem(mailLink(firstMail))).headers.get("location"),
      `${baseURL}/login/stale`,
    );
    assert.ok(signedIn(await redeem(newest)));
  });
  await run("replacement and redemption races remain serialized", async () => {
    const email = address();
    await issue(email);
    const firstMail = await waitForMail(email);
    const [replacement, redemption] = await Promise.all([
      issue(email),
      redeem(mailLink(firstMail)),
    ]);
    assert.equal(replacement.status, 200);
    assert.ok(
      signedIn(redemption) ||
        redemption.headers.get("location") === `${baseURL}/login/stale`,
    );
    assert.equal(
      (await redeem(mailLink(firstMail))).headers.get("location"),
      `${baseURL}/login/stale`,
    );
    assert.ok(signedIn(await redeem(await link(email, [firstMail.ID]))));
  });
  await run(
    "send allowance recovers as the rolling window advances",
    async () => {
      const email = address();
      for (let n = 0; n < 3; n++) await issue(email);
      const latest = await link(email);
      assert.equal((await issue(email)).status, 429);
      assert.ok(
        signedIn(await redeem(latest)),
        "Limited request must not replace the latest valid link",
      );
      await pool.query(
        "update magic_link_requests set recent_send_times=jsonb_build_array(now()-interval '601 seconds', now()-interval '590 seconds', now()-interval '580 seconds') where email=$1",
        [email],
      );
      assert.equal((await issue(email)).status, 200);
      assert.equal((await capturedMessages(email)).length, 4);
    },
  );
  await run(
    "concurrent normalized recipients share one allowance",
    async () => {
      const email = address();
      const responses = await Promise.all(
        Array.from({ length: 12 }, (_, n) =>
          issue(n % 2 ? ` ${email.toUpperCase()} ` : email),
        ),
      );
      assert.equal(
        responses.filter((response) => response.status === 200).length,
        3,
      );
      assert.equal(
        responses.filter((response) => response.status === 429).length,
        9,
      );
      assert.equal((await capturedMessages(email)).length, 3);
      assert.equal(
        (await issue(email, createAuthBoundary(pool))).status,
        429,
        "State survives factory restart",
      );
      assert.equal(
        (await issue(address())).status,
        200,
        "Another recipient has an independent allowance",
      );
    },
  );
  await run("sign-out revokes only the current device", async () => {
    const email = address();
    await issue(email);
    const firstMail = await waitForMail(email);
    const deviceA = await redeem(mailLink(firstMail));
    await issue(email);
    const deviceB = await redeem(await link(email, [firstMail.ID]));
    const a = cookies(deviceA);
    const b = cookies(deviceB);
    const signout = await boundary.handler(
      new Request(`${baseURL}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          origin: baseURL,
          cookie: a,
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    assert.equal(signout.status, 200);
    const session = (cookie: string) =>
      boundary
        .handler(
          new Request(`${baseURL}/api/auth/get-session`, {
            headers: { cookie },
          }),
        )
        .then((response) => response.json());
    assert.equal(await session(a), null);
    assert.equal((await session(b)).user.email, email);
  });
  await run(
    "public auth paths cannot bypass the guarded boundary",
    async () => {
      for (const path of [
        "/sign-up/email",
        "/sign-in/email",
        "/magic-link/verify/extra",
        "/update-user",
      ]) {
        assert.equal(
          (
            await boundary.handler(
              new Request(`${baseURL}/api/auth${path}`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  origin: baseURL,
                },
                body: "{}",
              }),
            )
          ).status,
          404,
        );
      }
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from pg_locks where locktype='advisory' and pid<>pg_backend_pid() and granted",
          )
        ).rows[0].n,
        0,
      );
    },
  );
  await run(
    "SMTP failures keep generic confirmation and release locks",
    async () => {
      const email = address();
      const failing = createAuthBoundary(pool, {
        ...process.env,
        SMTP_PORT: "1",
      });
      const original = console.error;
      const logs: string[] = [];
      console.error = (message: unknown) => {
        logs.push(String(message));
      };
      try {
        for (let n = 0; n < 3; n++) {
          const response = await issue(email, failing);
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), { status: true, email });
        }
        assert.equal((await issue(email, failing)).status, 429);
        assert.equal((await capturedMessages(email)).length, 0);
        assert.equal(logs.length, 3);
        assert.ok(
          logs.every((message) =>
            /^Sign-in email delivery failed \([A-Z_]+\); reserved quota retained\.$/.test(
              message,
            ),
          ),
        );
        assert.equal(
          (
            await pool.query(
              "select count(*)::int n from pg_locks where locktype='advisory' and pid<>pg_backend_pid() and granted",
            )
          ).rows[0].n,
          0,
        );
      } finally {
        console.error = original;
      }
    },
  );
} finally {
  await pool.end();
}
