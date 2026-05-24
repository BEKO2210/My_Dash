import { test, expect, type Page } from "@playwright/test";

// Run 119b — anomaly (recent vs baseline latency/error-rate) and calendar-heatmap
// (year-view punchcard). anomaly reads /api/anomaly, calendar-heatmap /api/calendar;
// both stubbed per page so the comparison rows, severity, year grid, levels and
// empty-cell tint are deterministic and the screenshots reproducible. The maths is
// unit-tested in src/lib/{anomaly,calendar}.test.ts.
const ANOMALY = {
  latencyMs: { recent: 820, baseline: 300, deltaPct: 1.73, anomalous: true },
  errorRate: { recent: 0.04, baseline: 0.05, deltaPct: -0.2, anomalous: false },
  recentSamples: 120,
  baselineSamples: 840,
};
function calendarYear() {
  const days: { date: string; count: number }[] = [];
  const start = new Date("2025-06-01T00:00:00Z");
  for (let i = 0; i < 371; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    days.push({ date: d.toISOString().slice(0, 10), count: Math.max(0, Math.round(Math.sin(i / 9) * 6 + (i % 7 === 0 ? 8 : 0))) });
  }
  return { days };
}

async function stub(page: Page, anomaly: object = ANOMALY, calendar: object = calendarYear()) {
  await page.route("**/api/anomaly*", (route) => route.fulfill({ json: anomaly }));
  await page.route("**/api/calendar*", (route) => route.fulfill({ json: calendar }));
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

// ── anomaly ──────────────────────────────────────────────────────────────────
const anOf = (page: Page) => page.locator("#mc-widget-anomaly");

test("anomaly: recent vs baseline rows, severity colours, flag", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = anOf(page);
  await w.scrollIntoViewIfNeeded();

  // Latency: recent vs baseline, large rise → red delta + anomaly flag.
  await expect(w.getByText("Latenz p95")).toBeVisible();
  await expect(w.getByText("820ms")).toBeVisible();
  await expect(w.getByText(/vs\. 300ms/)).toBeVisible();
  await expect(w.getByText("+173%")).toHaveClass(/text-red-400/);
  await expect(w.getByText("Auffällig über Basislinie")).toBeVisible();

  // Error rate: down vs baseline → emerald delta, no flag.
  await expect(w.getByText("-20%")).toHaveClass(/text-emerald-400/);

  // Sample-size footer.
  await expect(w.getByText(/n=120\/840/)).toBeVisible();

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("anomaly: empty state when there is not enough data", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, { latencyMs: { recent: 0, baseline: 0, deltaPct: 0, anomalous: false }, errorRate: { recent: 0, baseline: 0, deltaPct: 0, anomalous: false }, recentSamples: 0, baselineSamples: 0 });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = anOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch nicht genug Daten.")).toBeVisible();
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("anomaly", "anomaly");

// ── calendar-heatmap ─────────────────────────────────────────────────────────
const calOf = (page: Page) => page.locator("#mc-widget-calendar-heatmap");

test("calendar-heatmap: year grid, levels, visible empty cells on light theme", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "light", "de");
  await gotoDashboard(page);
  const w = calOf(page);
  await w.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // A dense year grid (one titled cell per day) + the events total + legend start.
  // (The info-hint copy also contains "Events"/"mehr", so match the total/legend
  // precisely: the total ends with "Events", the legend label is "weniger".)
  expect(await w.locator("div[title]").count()).toBeGreaterThan(300);
  await expect(w.getByText(/Events$/)).toBeVisible();
  await expect(w.getByText("weniger")).toBeVisible();

  // Empty (count-0) cells must use the dark level-0 tint on white (Run-109 token),
  // not an invisible white-on-white fill.
  const emptyBg = await w.locator("div[title]").evaluateAll((els) => {
    const c = els.find((e) => /: 0$/.test(e.getAttribute("title") ?? ""));
    return c ? getComputedStyle(c).backgroundColor : null;
  });
  expect(emptyBg).toContain("15, 23, 42");

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("calendar-heatmap: empty state when there is no activity", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, ANOMALY, { days: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = calOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Aktivität.")).toBeVisible();
  await expect(w.locator("div[title]")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("calendar-heatmap", "calendar-heatmap");
