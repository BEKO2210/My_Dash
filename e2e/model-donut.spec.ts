import { test, expect, type Page } from "@playwright/test";

// Run 115 — model-donut (per-model token/cost share) + token-burn (estimated token
// burn per tool). model-donut reads /api/usage, token-burn /api/token-burn; both
// are stubbed per page so segments, legend, center total, the mode toggle and the
// burn bars are deterministic and the screenshots reproducible. The share/burn
// maths is unit-tested in src/lib/{model-usage,token-burn}.test.ts.
const USAGE = {
  days: [],
  months: [],
  blocks: [],
  burn: null,
  available: true,
  totals: { inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, costEur: 0 },
  models: [
    { model: "claude-opus-4-7", inputTokens: 200000, outputTokens: 120000, cacheTokens: 480000, totalTokens: 800000, costUsd: 12.5, costEur: 11.5 },
    { model: "claude-sonnet-4-6", inputTokens: 400000, outputTokens: 300000, cacheTokens: 800000, totalTokens: 1500000, costUsd: 4.2, costEur: 3.86 },
    { model: "claude-haiku-4-5", inputTokens: 200000, outputTokens: 100000, cacheTokens: 300000, totalTokens: 600000, costUsd: 0.8, costEur: 0.74 },
  ],
};
const BURN = {
  tools: [
    { tool: "Bash", calls: 120, tokens: 480000, share: 0.42 },
    { tool: "Read", calls: 90, tokens: 300000, share: 0.26 },
    { tool: "Edit", calls: 60, tokens: 200000, share: 0.17 },
    { tool: "WebFetch", calls: 20, tokens: 120000, share: 0.1 },
    { tool: "Grep", calls: 40, tokens: 50000, share: 0.05 },
  ],
};

async function stub(page: Page, usage: object = USAGE, burn: object = BURN) {
  await page.route("**/api/usage", (route) => route.fulfill({ json: usage }));
  await page.route("**/api/token-burn*", (route) => route.fulfill({ json: burn }));
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
          await page.waitForTimeout(900);
          const shot = await w.screenshot({ path: `test-results/${dir}-shots/${label}.png` });
          await testInfo.attach(label, { body: shot, contentType: "image/png" });
          expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
        });
      }
    }
  }
}

// ── model-donut ──────────────────────────────────────────────────────────────
const mdOf = (page: Page) => page.locator("#mc-widget-model-donut");

test("model-donut: segments, legend, center total, mode toggle", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = mdOf(page);
  await w.scrollIntoViewIfNeeded();

  // One donut segment per model.
  await expect(w.locator("path.recharts-sector")).toHaveCount(3);

  // Legend with each model's name + percentage.
  await expect(w.getByText("opus-4-7")).toBeVisible();
  await expect(w.getByText("sonnet-4-6")).toBeVisible();
  await expect(w.getByText("71%")).toBeVisible(); // opus cost share

  // Center total: cost mode is USD (regression guard — was mislabelled €).
  await expect(w.getByText("17,50 $")).toBeVisible();

  // Mode toggle exposes its pressed state and switches the metric.
  const btnCost = w.getByRole("button", { name: "Kosten" });
  const btnTokens = w.getByRole("button", { name: "Tokens" });
  await expect(btnCost).toHaveAttribute("aria-pressed", "true");
  await btnTokens.click();
  await expect(btnTokens).toHaveAttribute("aria-pressed", "true");
  await expect(btnCost).toHaveAttribute("aria-pressed", "false");
  await expect(w.getByText("2.9M")).toBeVisible(); // total tokens
  await expect(w.getByText("17,50 $")).toHaveCount(0);

  // Note: per-segment hover shows the same name+share the legend already asserts
  // above; recharts' pie-arc hover isn't reliably reproducible via synthetic mouse
  // events headless, so we verify that data through the (deterministic) legend
  // rather than gating CI on a flaky arc hover.

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("model-donut: empty state when no model data", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, { ...USAGE, models: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = mdOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Modelldaten.")).toBeVisible();
  await expect(w.locator("path.recharts-sector")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("model-donut", "model-donut");

// ── token-burn ───────────────────────────────────────────────────────────────
const tbOf = (page: Page) => page.locator("#mc-widget-token-burn");

test("token-burn: proportional bars, shares, hover title", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = tbOf(page);
  await w.scrollIntoViewIfNeeded();

  // One bar per tool, biggest first; the inline breakdown (~tokens · share · calls).
  await expect(w.locator("li")).toHaveCount(5);
  await expect(w.getByText("Bash")).toBeVisible();
  await expect(w.getByText(/~480k · 42% · 120×/)).toBeVisible();

  // Bar widths are proportional and non-increasing; the top bar fills the track.
  const widths = await w.locator("li div.h-full").evaluateAll((els) =>
    els.map((e) => parseFloat((e as HTMLElement).style.width)),
  );
  expect(widths[0]).toBe(100);
  for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThanOrEqual(widths[i - 1]);

  // The tool name carries a hover title.
  await expect(w.locator("li").first().locator("span[title='Bash']")).toBeVisible();

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("token-burn: empty state when no tool data", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, USAGE, { tools: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = tbOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Tool-Daten.")).toBeVisible();
  await expect(w.locator("li")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("token-burn", "token-burn");
