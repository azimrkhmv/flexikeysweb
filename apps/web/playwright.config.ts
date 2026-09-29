import { defineConfig, devices } from "@playwright/test";

// E2E runs against a production build (`next start`), the same code users get.
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  // Text snapshots are platform-independent: one file for macOS dev machines and Linux CI.
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true } },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
  },
});
