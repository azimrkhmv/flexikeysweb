import { defineConfig, devices } from "@playwright/test";

// Live-mode E2E: the app built with NEXT_PUBLIC_API_MODE=live against a running FastAPI backend
// (flexikeys/infra: `docker compose up -d`, API on :8000). Run: npm run e2e:live
const PORT = 3200;

export default defineConfig({
  testDir: "e2e-live",
  testMatch: "**/*.e2e.ts",
  workers: 1, // one account flow at a time (the API rate-limits auth per IP)
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // My Voice: the parent records their own voice — a fake microphone, permission granted.
    permissions: ["microphone"],
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  webServer: {
    command: `npm run build && PORT=${PORT} npm start`,
    url: `http://localhost:${PORT}/uz`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { NEXT_PUBLIC_API_MODE: "live", FK_API_ORIGIN: process.env.FK_API_ORIGIN ?? "http://localhost:8000", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
