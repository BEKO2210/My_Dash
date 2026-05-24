import { test, expect, type Page } from "@playwright/test";

// The activity heatmap reads /api/activity (hourly buckets). We stub it per page
// with a varied week — including outliers that exercise the p95 colour clamp — so
// the punchcard, colour steps and per-cell tooltips render deterministically and
// the screenshots are reproducible. The fold/level/p95 maths is unit-tested in
// src/lib/heatmap.test.ts.
function activityPayload() {
  const buckets: { bucket: string; event_type: string; count: number }[] = [];
  const base = new Date("2026-05-18T00:00:00Z"); // a Monday
  for (let day = 0; day < 7; day++) {
    for (let h = 0; h < 24; h++) {
      let c = 0;
      if (h >= 8 && h <= 20) c = Math.max(0, Math.round(Math.sin((h - 6) / 3) * 6 + (day % 3) * 2));
      if (day === 2 && h === 14) c = 60; // outlier → p95 clamp
      if (day === 4 && h === 10) c = 45; // spike
      if (c > 0) {
        const d = new Date(base);
        d.setUTCDate(base.getUTCDate() + day);
        d.setUTCHours(h);
        buckets.push({ bucket: d.toISOString().slice(0, 13).replace("T", " "), event_type: "PostToolUse", count: c });
      }
    }
  }
  return { buckets };
}

async function stubActivity(page: Page, body: object) {
  await page.route("**/api/activity*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(body) }),
  );
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

const widgetOf = (page: Page) => page.locator("#mc-widget-heatmap");
const cellsOf = (page: Page) => widgetOf(page).locator("div.aspect-square");

test("punchcard: 7×24 cells, a tooltip on every cell, multiple colour steps", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubActivity(page, activityPayload());
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  const cells = cellsOf(page);
  await expect(cells).toHaveCount(7 * 24);

  // Tooltip on every cell (title carries weekday, hour and event count).
  const titles = await cells.evaluateAll((els) => els.map((e) => e.getAttribute("title") ?? ""));
  expect(titles.every((t) => /\d{2}:00 — \d+/.test(t))).toBe(true);

  // Colour steps: several distinct background levels are painted, and no cell is
  // left transparent (the empty/level-0 tint must be visible).
  const bgs = await cells.evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
  const distinct = new Set(bgs);
  expect(distinct.size).toBeGreaterThanOrEqual(3);
  expect(bgs.some((b) => b === "rgba(0, 0, 0, 0)" || b === "transparent")).toBe(false);

  // Legend shows the full 5-step ramp.
  await expect(w.getByText("weniger")).toBeVisible();
  await expect(w.getByText("mehr")).toBeVisible();

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("light theme: empty cells stay visible (level-0 tint)", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubActivity(page, activityPayload());
  await prime(page, "light", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(cellsOf(page).first()).toBeVisible();

  // An empty cell ("… — 0 Events") must use the dark level-0 tint on white, not an
  // invisible white-on-white fill. The tint is rgba(15, 23, 42, 0.06).
  const emptyBg = await cellsOf(page).evaluateAll((els) => {
    const cell = els.find((e) => /— 0 /.test(e.getAttribute("title") ?? ""));
    return cell ? getComputedStyle(cell).backgroundColor : null;
  });
  expect(emptyBg).toContain("15, 23, 42");

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("empty activity shows the empty state, no cells", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubActivity(page, { buckets: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  await expect(w.getByText("Noch keine Aktivität.")).toBeVisible();
  await expect(cellsOf(page)).toHaveCount(0);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

// Visual matrix: every theme × breakpoint (+ an English desktop pass), as CI artifacts.
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "qhd", width: 2560, height: 1440 },
  { name: "uhd", width: 3840, height: 2160 },
] as const;
const MODES = ["dark", "light"] as const;

for (const vp of VIEWPORTS) {
  for (const mode of MODES) {
    const langs: ("de" | "en")[] = vp.name === "desktop" ? ["de", "en"] : ["de"];
    for (const lang of langs) {
      const label = `${vp.name}-${mode}-${lang}`;
      test(`heatmap visual — ${label}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);

        await stubActivity(page, activityPayload());
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prime(page, mode, lang);
        await gotoDashboard(page);
        const w = widgetOf(page);
        await w.scrollIntoViewIfNeeded();
        await expect(cellsOf(page).first()).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(400);

        const shot = await w.screenshot({ path: `test-results/heatmap-shots/${label}.png` });
        await testInfo.attach(label, { body: shot, contentType: "image/png" });

        expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
      });
    }
  }
}
