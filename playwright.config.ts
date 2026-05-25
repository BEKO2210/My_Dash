import { defineConfig, devices } from "@playwright/test";

// Smoke E2E: boots the real production server (its own port + data dir) and checks
// the dashboard renders, SSE connects and seeded data flows through. Kept minimal
// and deterministic so it can gate CI without flaking.
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Per-PR runs the critical-path matrix (functional specs + mobile/desktop visuals);
// the heavy high-DPI qhd/uhd screenshot permutations only run in the full matrix
// (nightly / manual), set MC_E2E_FULL=1. This keeps the per-PR green gate fast
// without losing the high-DPI coverage. (Their test titles carry "qhd-"/"uhd-".)
const FULL_MATRIX = !!process.env.MC_E2E_FULL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  grepInvert: FULL_MATRIX ? undefined : /\b(qhd|uhd)-/,
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
