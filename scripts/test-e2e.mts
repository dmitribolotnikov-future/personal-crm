import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { cp } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);
const containerName = `personal-crm-e2e-${randomUUID()}`;
let databaseStarted = false;

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

    const env = {
      ...process.env,
      POSTGRES_HOST: "127.0.0.1",
      POSTGRES_PORT: port,
      POSTGRES_USER: "crm_e2e",
      POSTGRES_DB: "crm_e2e",
      // The app requires a nonempty value; trust authentication ignores it.
      POSTGRES_PASSWORD: "unused",
      E2E_DATABASE_ISOLATED: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    };

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
    await runNode(
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        ...process.argv.slice(2),
      ],
      env,
    );
  } finally {
    if (databaseStarted) {
      await exec("docker", ["stop", "--time", "5", containerName]);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
