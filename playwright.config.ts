import { defineConfig, devices } from "@playwright/test";

if (process.env.E2E_DATABASE_ISOLATED !== "1") {
  throw new Error("Run pnpm test:e2e to use an isolated Docker database.");
}

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node .next/standalone/server.js",
    env: { HOSTNAME: "127.0.0.1", PORT: "3100" },
    url: "http://127.0.0.1:3100/health",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
