import { test, expect, type Page } from "@playwright/test";

// The budget gauge is fed by ccusage, which has no data in CI. So we stub
// /api/budget per page to drive every threshold/overage state deterministically —
// which also makes the audit screenshots reproducible. The real read path
// (ccusage → /api/budget) is covered by src/lib/budget.test.ts.

type Tier = { pct: number; over: boolean } | null;

function gaugePayload(daily: Tier, monthly: Tier) {
  const dailyUsd = 15;
  const monthlyUsd = 300;
  const status = (budget: number, t: Tier) =>
    t == null
      ? { budgetUsd: null, spentUsd: 0, pct: null }
      : { budgetUsd: budget, spentUsd: +(budget * t.pct).toFixed(2), pct: t.pct };
  const proj = (budget: number, t: Tier) =>
    t == null
      ? { projectedUsd: 0, budgetUsd: null, projectedPct: null, overBudget: false }
      : { projectedUsd: +(budget * t.pct * 1.3).toFixed(2), budgetUsd: budget, projectedPct: t.pct * 1.3, overBudget: t.over };
  return {
    budgets: { dailyUsd: daily ? dailyUsd : null, monthlyUsd: monthly ? monthlyUsd : null },
    status: { daily: status(dailyUsd, daily), monthly: status(monthlyUsd, monthly) },
    projection: { daily: proj(dailyUsd, daily), monthly: proj(monthlyUsd, monthly) },
  };
}

async function stubBudget(page: Page, body: object) {
  await page.route("**/api/budget", (route) =>
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
  await expect(page.getByRole("heading", { name: "Claude Mission Control" })).toBeAttached({ timeout: 15_000 });
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });
}

const widgetOf = (page: Page) => page.locator("#mc-widget-budget-gauge");

test("threshold colours, overage cap + alarm, ARIA progressbar values", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  // Daily under budget (green); monthly over budget (red) with an over-budget
  // projection → the alarm banner shows.
  await stubBudget(page, gaugePayload({ pct: 0.4, over: false }, { pct: 1.1, over: true }));
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  const daily = w.getByRole("progressbar", { name: "Heute" });
  const monthly = w.getByRole("progressbar", { name: "Dieser Monat" });

  // Display + ARIA: the gauges expose their fraction to assistive tech, and the
  // amounts/percent are shown.
  await expect(daily).toBeVisible();
  await expect(daily).toHaveAttribute("aria-valuenow", "40");
  await expect(daily).toHaveAttribute("aria-valuemax", "100");
  // Whitespace-tolerant: the de-DE Intl currency format uses a narrow no-break
  // space (U+202F) before the symbol, which an exact attribute match would miss.
  await expect(daily).toHaveAttribute("aria-valuetext", /^6,00\s\$\s\/\s15,00\s\$\s·\s40%$/);
  await expect(w.getByText("6,00 $ / 15,00 $ · 40%")).toBeVisible();

  // Threshold colours: green under 75%, red once at/over budget.
  await expect(daily.locator("div").first()).toHaveClass(/bg-emerald-500/);
  await expect(monthly.locator("div").first()).toHaveClass(/bg-red-500/);

  // Overage: the bar value clamps to 100 even though spend projects past it…
  await expect(monthly).toHaveAttribute("aria-valuenow", "100");
  // …while the visible label still reports the true 110%.
  await expect(w.getByText(/· 110%$/)).toBeVisible();

  // Alarm banner for the over-budget projection.
  await expect(w.getByText(/über Budget/i)).toBeVisible();

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("amber warning tier between 75% and budget", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubBudget(page, gaugePayload({ pct: 0.82, over: false }, { pct: 0.5, over: false }));
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  const daily = w.getByRole("progressbar", { name: "Heute" });
  await expect(daily).toHaveAttribute("aria-valuenow", "82");
  await expect(daily.locator("div").first()).toHaveClass(/bg-amber-500/);
  // Under-budget projection → no alarm banner.
  await expect(w.getByText(/über Budget/i)).toHaveCount(0);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("no budget set shows the configuration hint, no gauges", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubBudget(page, gaugePayload(null, null));
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  await expect(w.getByText("Kein Budget gesetzt.")).toBeVisible();
  await expect(w.getByText("MC_BUDGET_DAILY")).toBeVisible();
  await expect(w.getByRole("progressbar")).toHaveCount(0);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

// Visual matrix: every theme × breakpoint (+ an English desktop pass), collected as
// CI artifacts. A representative payload exercises green, red and the alarm banner.
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
      test(`budget-gauge visual — ${label}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);

        await stubBudget(page, gaugePayload({ pct: 0.45, over: false }, { pct: 1.08, over: true }));
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prime(page, mode, lang);
        await gotoDashboard(page);
        const w = widgetOf(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w.getByRole("progressbar").first()).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(700); // let the bar width/colour transition settle

        const shot = await w.screenshot({ path: `test-results/budget-gauge-shots/${label}.png` });
        await testInfo.attach(label, { body: shot, contentType: "image/png" });

        expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
      });
    }
  }
}
