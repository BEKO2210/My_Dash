import { test, expect, type Page } from "@playwright/test";

// #67 — Cold start: a fresh install with NO data must render the whole dashboard
// cleanly (empty states everywhere, no uncaught exceptions). Per-widget empty
// states are covered individually elsewhere; this is the integration guard that
// the *whole* grid survives an empty backend.
//
// The e2e server shares one DB across specs, so instead of wiping it we intercept
// every REST endpoint and return an empty payload. `[]` is the safe universal
// empty: array-consuming widgets map over nothing, object-field access yields
// undefined (guarded by `?? default`). The SSE stream is left real so the live
// connection still establishes.

// Noise tolerated app-wide: the 3D-graph WebGL banner, the React DevTools nudge,
// and recharts' transient "reading 'tick'" while a chart first lays out.
const IGNORE = [/WebGL/i, /THREE\.WebGLRenderer/i, /Download the React DevTools/i, /reading 'tick'/];

function prime(page: Page) {
  return page.addInitScript(() => {
    try {
      localStorage.setItem("mc-onboarded", "1");
      localStorage.setItem("mc-theme", JSON.stringify({ mode: "dark", accent: "#4f8cff" }));
      localStorage.setItem("mc-lang", "de");
    } catch {
      /* ignore */
    }
  });
}

test("cold start: empty backend renders the full dashboard without crashing", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => {
    if (!IGNORE.some((re) => re.test(e.message))) pageErrors.push(e.message);
  });

  // Empty every REST endpoint except the SSE stream (keep the live connection).
  await page.route("**/api/**", (route) => {
    if (route.request().url().includes("/api/stream")) return route.continue();
    return route.fulfill({ json: [] });
  });

  await prime(page);
  await page.goto("/");

  // Shell renders and the live connection still establishes on empty data.
  await expect(page.getByRole("heading", { name: "Claude Mission Control" })).toBeAttached({ timeout: 15_000 });
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });

  // The widget grid mounts (don't pin an exact count: with empty payloads some
  // widgets collapse their body to just an empty-state line).
  await expect
    .poll(() => page.locator("section").count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(15);

  // The cold-start guarantee: many widgets show their "no data yet" empty state
  // (DE: "Noch keine …") instead of crashing or rendering blank.
  await expect
    .poll(() => page.getByText(/Noch keine/i).count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(5);

  // The whole thing came up with no uncaught exceptions.
  expect(pageErrors, `uncaught errors on cold start:\n${pageErrors.join("\n")}`).toEqual([]);
});
