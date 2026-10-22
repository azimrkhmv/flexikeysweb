import { defineConfig, devices } from "@playwright/test";

// E2E runs against the production build and standalone server (same as the Docker image).
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  // Text snapshots are platform-independent: one file for macOS dev machines and Linux CI.
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Tashkent time everywhere: GitHub runs in UTC, which moved demo dates near midnight by a day.
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", timezoneId: "Asia/Tashkent" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true } },
  ],
  webServer: {
    command: `npm run build && PORT=${PORT} npm start`, // the standalone server the Docker image runs
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // The real site address, so canonical links are the same on every machine (a local .env.local may differ).
    // Most tests answer P1–P41; e2e/questionnaire.e2e.ts opens the CEO's questionnaire with ?q=2026-10-16.
    env: { NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SITE_URL: "https://flexikeys.uz", NEXT_PUBLIC_QUESTIONNAIRE: "p41" },
  },
});
