import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5180",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10000,
    launchOptions: { args: ["--no-proxy-server"] },
  },
  webServer: {
    command: "node scripts/test-server.mjs",
    url: "http://127.0.0.1:5180/health",
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
