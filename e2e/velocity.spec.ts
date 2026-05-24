import { test, expect, type Page } from "@playwright/test";

// Run 118b — velocity (tools/min + events/session trends with a 7-day average) and
// session-duration (session-length histogram + median/p95/max). velocity reads
// /api/velocity, session-duration /api/session-duration; both stubbed per page so
// the trends, bars, stats and translated tooltips are deterministic and the
// screenshots reproducible. The maths is unit-tested in
// src/lib/{velocity,session-duration}.test.ts.
const VELOCITY = {
  days: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-05-${String(i + 1).padStart(2, "0")}`,
    toolCalls: 20 + Math.round(Math.abs(Math.sin(i / 4)) * 40),
    events: 40 + Math.round(Math.abs(Math.cos(i / 5)) * 60),
    sessions: 1 + (i % 4),
    activeMinutes: 30 + i,
  })),
};
const DURATION = {
  count: 84,
  median: 12 * 60_000,
  p95: 95 * 60_000,
  max: 240 * 60_000,
  buckets: [
    { label: "1m", count: 6 }, { label: "5m", count: 18 }, { label: "15m", count: 28 },
    { label: "30m", count: 16 }, { label: "1h", count: 9 }, { label: "2h", count: 5 },
    { label: "4h", count: 2 }, { label: "4h+", count: 0 },
  ],
};

async function stub(page: Page, velocity: object = VELOCITY, duration: object = DURATION) {
  await page.route("**/api/velocity*", (route) => route.fulfill({ json: velocity }));
  await page.route("**/api/session-duration*", (route) => route.fulfill({ json: duration }));
}

function prime(page: Page, mode: "dark" | "light", lang: "de" | "en") {
  return page.addInitScript(
    ([m, l]) => {
      try {
        localStorage.setItem("mc-onboarded", "1");
        localStorage.setItem("mc-theme", JSON.stringify({ mode: m, accent: "#4f8cff" }));
        localStorage.setItem("mc-lang", l);
      } catch {
        /* ignore */
      }
    },
    [mode, lang] as const,
  );
}

// The full dashboard renders here, so tolerate noise from other widgets: 3D-graph
// WebGL info, the React DevTools nudge, and recharts' transient "reading 'tick'"
// while a chart's ResponsiveContainer settles on first paint (as layout.spec does).
const IGNORE = [/WebGL/i, /THREE\.WebGLRenderer/i, /Download the React DevTools/i, /reading 'tick'/];

function watchConsole(page: Page, errors: string[]) {
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) errors.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (!IGNORE.some((re) => re.test(e.message))) errors.push(e.message);
  });
}

async function gotoDashboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Claude Mission Control" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });
}

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "qhd", width: 2560, height: 1440 },
  { name: "uhd", width: 3840, height: 2160 },
] as const;
const MODES = ["dark", "light"] as const;

function visualMatrix(widgetId: string, dir: string) {
  for (const vp of VIEWPORTS) {
    for (const mode of MODES) {
      const langs: ("de" | "en")[] = vp.name === "desktop" ? ["de", "en"] : ["de"];
      for (const lang of langs) {
        const label = `${vp.name}-${mode}-${lang}`;
        test(`${dir} visual — ${label}`, async ({ page }, testInfo) => {
          const errors: string[] = [];
          watchConsole(page, errors);
          await stub(page);
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await prime(page, mode, lang);
          await gotoDashboard(page);
          const w = page.locator(`#mc-widget-${widgetId}`);
          await w.scrollIntoViewIfNeeded();
          await expect(w).toBeVisible();
          await page.waitForTimeout(700);
          const shot = await w.screenshot({ path: `test-results/${dir}-shots/${label}.png` });
          await testInfo.attach(label, { body: shot, contentType: "image/png" });
          expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
        });
      }
    }
  }
}

// ── velocity ─────────────────────────────────────────────────────────────────
const veOf = (page: Page) => page.locator("#mc-widget-velocity");

test("velocity: two trends (raw + 7-day avg), delta badges, translated tooltip", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = veOf(page);
  await w.scrollIntoViewIfNeeded();

  // Two trend rows, each with a raw + average line (4 lines total).
  await expect(w.getByText("Tools / Minute")).toBeVisible();
  await expect(w.getByText("Events / Session")).toBeVisible();
  await expect(w.locator(".recharts-line")).toHaveCount(4);
  // A delta badge with a percentage.
  await expect(w.getByText(/%$/).first()).toBeVisible();

  // Hover the first trend → tooltip names are translated ("Ø 7 Tage", not "avg").
  const box = await w.locator(".recharts-surface").first().boundingBox();
  expect(box).not.toBeNull();
  // Two trend charts → two tooltip wrappers; scope to the first (the one we hover).
  const tip = w.locator(".recharts-tooltip-wrapper").first();
  if (box) {
    for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      await page.mouse.move(box.x + box.width * fx, box.y + box.height / 2);
      await page.waitForTimeout(120);
      if ((await tip.count()) > 0 && (await tip.isVisible()) && /Tage|Tag/.test(await tip.innerText())) break;
    }
  }
  await expect(tip).toContainText("Ø 7 Tage", { timeout: 5_000 });

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("velocity: empty state when there is no data", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, { days: Array.from({ length: 5 }, (_, i) => ({ date: `2026-05-0${i + 1}`, toolCalls: 0, events: 0, sessions: 0, activeMinutes: 0 })) });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = veOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Daten.")).toBeVisible();
  await expect(w.locator(".recharts-line")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("velocity", "velocity");

// ── session-duration ─────────────────────────────────────────────────────────
const sdOf = (page: Page) => page.locator("#mc-widget-session-duration");

test("session-duration: stats, histogram buckets, translated tooltip", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = sdOf(page);
  await w.scrollIntoViewIfNeeded();

  // Stats row: median, p95, max, n.
  const statVals = w.locator(".flex-wrap span.font-mono");
  await expect(statVals).toHaveText(["12m 00s", "1h 35m", "4h 00m", "84"]);

  // Histogram bars (the 0-count last bucket renders no rect).
  const bars = w.locator(".recharts-bar-rectangle");
  expect(await bars.count()).toBeGreaterThanOrEqual(7);

  // Tooltip on a bar → translated metric ("Sessions", not raw "count").
  await bars.nth(2).hover();
  await expect(w.locator(".recharts-tooltip-wrapper")).toContainText("Sessions", { timeout: 5_000 });

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("session-duration: empty state when there are no sessions", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, VELOCITY, { count: 0, median: 0, p95: 0, max: 0, buckets: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = sdOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine abgeschlossenen Sessions.")).toBeVisible();
  await expect(w.locator(".recharts-bar-rectangle")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("session-duration", "session-duration");
