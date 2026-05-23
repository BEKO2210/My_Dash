import { defineConfig, devices } from "@playwright/test";

// Smoke E2E: boots the real production server (its own port + data dir) and checks
// the dashboard renders, SSE connects and seeded data flows through. Kept minimal
// and deterministic so it can gate CI without flaking.
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PORT: String(PORT), MC_DATA_DIR: ".playwright/data" },
  },
});
