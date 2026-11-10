import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { cp } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { createInterface } from "node:readline";

const exec = promisify(execFile);
const containerName = `personal-crm-e2e-${randomUUID()}`;
const mailpitName = `personal-crm-mailpit-e2e-${randomUUID()}`;
let databaseStarted = false;
let mailpitStarted = false;

function runNode(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${args[0]} exited with ${signal ?? code}`));
    });
  });
}

function preview(env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = spawn(process.execPath, [".next/standalone/server.js"], {
      env: { ...env, HOSTNAME: "127.0.0.1", PORT: "3100" },
      stdio: ["ignore", "inherit", "inherit"],
    });
    const input = createInterface({ input: process.stdin });
    let stopping = false;
    const stop = () => {
      stopping = true;
      server.kill();
    };
    input.on("line", (line) => {
      if (line.trim() === "stop") stop();
    });
    process.once("SIGINT", stop);
    console.log(
      `Preview application: http://127.0.0.1:3100; Mailpit inbox: ${env.MAILPIT_URL}`,
    );
    console.log(
      "Type stop and press Enter to remove this preview's disposable containers.",
    );
    server.once("error", reject);
    server.once("exit", (code) => {
      input.close();
      process.removeListener("SIGINT", stop);
      if (stopping || code === 0) resolve();
      else reject(new Error("The preview server exited unexpectedly."));
    });
  });
}

async function main() {
  try {
    // Trust authentication is restricted to a disposable database on localhost.
    // No local .env file or persistent Docker volume is used by this runner.
    await exec("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      containerName,
      "--publish",
      "127.0.0.1::5432",
      "--mount",
      "type=tmpfs,destination=/var/lib/postgresql",
      "--env",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "--env",
      "POSTGRES_USER=crm_e2e",
      "--env",
      "POSTGRES_DB=crm_e2e",
      "postgres:18",
    ]);
    databaseStarted = true;

    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await exec("docker", [
          "exec",
          containerName,
          "pg_isready",
          "-h",
          "127.0.0.1",
          "-U",
          "crm_e2e",
          "-d",
          "crm_e2e",
        ]);
        ready = true;
        break;
      } catch {
        await setTimeout(1_000);
      }
    }
    if (!ready)
      throw new Error("The isolated PostgreSQL database did not become ready.");

    const { stdout } = await exec("docker", [
      "port",
      containerName,
      "5432/tcp",
    ]);
    const port = stdout.trim().match(/^127\.0\.0\.1:(\d+)$/)?.[1];
    if (!port)
      throw new Error("Cannot determine the isolated PostgreSQL port.");

    await exec("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      mailpitName,
      "--publish",
      "127.0.0.1::1025",
      "--publish",
      "127.0.0.1::8025",
      "--env",
      "MP_DISABLE_VERSION_CHECK=true",
      "--env",
      "MP_MAX_MESSAGES=1000",
      "axllent/mailpit:v1.33.1",
      "--smtp-disable-rdns",
    ]);
    mailpitStarted = true;
    const smtpPort = (
      await exec("docker", ["port", mailpitName, "1025/tcp"])
    ).stdout
      .trim()
      .match(/^127\.0\.0\.1:(\d+)$/)?.[1];
    const inboxPort = (
      await exec("docker", ["port", mailpitName, "8025/tcp"])
    ).stdout
      .trim()
      .match(/^127\.0\.0\.1:(\d+)$/)?.[1];
    if (!smtpPort || !inboxPort)
      throw new Error("Cannot determine isolated Mailpit ports.");
    const env = {
      ...process.env,
      POSTGRES_HOST: "127.0.0.1",
      POSTGRES_PORT: port,
      POSTGRES_USER: "crm_e2e",
      POSTGRES_DB: "crm_e2e",
      // The app requires a nonempty value; trust authentication ignores it.
      POSTGRES_PASSWORD: "unused",
      E2E_DATABASE_ISOLATED: "1",
      TZ: "UTC",
      NEXT_TELEMETRY_DISABLED: "1",
      LEGACY_OWNER_EMAIL: "legacy-owner@example.test",
      BETTER_AUTH_URL: "http://127.0.0.1:3100",
      // Ephemeral signing material is confined to this disposable test run.
      BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: smtpPort,
      SMTP_SECURE: "false",
      SMTP_USER: "",
      SMTP_PASSWORD: "",
      MAIL_FROM: "noreply@mail.crm.example.test",
      MAILPIT_URL: `http://127.0.0.1:${inboxPort}`,
    };

    if (process.argv.includes("--auth-only")) {
      await runNode(
        ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.mts"],
        env,
      );
      await runNode(
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/test-auth.mts",
        ],
        env,
      );
      return;
    }

    if (!process.argv.includes("--preview")) {
      await runNode(
        [
          "node_modules/tsx/dist/cli.mjs",
          "scripts/test-contact-frequency-migration.mts",
        ],
        env,
      );
      await runNode(
        ["node_modules/tsx/dist/cli.mjs", "scripts/test-login-migration.mts"],
        env,
      );
      if (process.argv.includes("--migrations-only")) return;
      await runNode(
        ["node_modules/tsx/dist/cli.mjs", "scripts/test-owner-seed.mts"],
        env,
      );
      await runNode(
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/test-user-data.mts",
        ],
        env,
      );
      if (process.argv.includes("--data-only")) return;
      await runNode(
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/test-auth.mts",
        ],
        env,
      );
    }
    await runNode(
      ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.mts"],
      env,
    );
    await runNode(["node_modules/next/dist/bin/next", "build"], env);
    await cp(".next/static", ".next/standalone/.next/static", {
      recursive: true,
    });
    if (existsSync("public")) {
      await cp("public", ".next/standalone/public", { recursive: true });
    }
    if (process.argv.includes("--preview")) {
      await preview(env);
      return;
    }
    await runNode(
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        ...process.argv.slice(2),
      ],
      env,
    );
  } finally {
    try {
      if (mailpitStarted)
        await exec("docker", ["stop", "--time", "5", mailpitName]);
    } finally {
      if (databaseStarted) {
        await exec("docker", ["stop", "--time", "5", containerName]);
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
