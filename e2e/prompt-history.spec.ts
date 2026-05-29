import { test, expect, type Page } from "@playwright/test";

// Run 118c — prompt-history: a chronological, searchable list of prompts with a
// token estimate and a drill-down to the originating session. /api/prompts is
// stubbed per page so the list, search, token estimate and drill-down links are
// deterministic and the screenshots reproducible. The extraction/redaction maths
// is unit-tested in src/lib/prompts.test.ts.
function dbTime(minAgo: number): string {
  const d = new Date(Date.now() - minAgo * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
const PROMPTS = {
  prompts: [
    { id: 1, session_id: "s-alpha", project: "my_dash", text: "Build the dashboard and wire the hooks", token_estimate: 1200, created_at: dbTime(5) },
    { id: 2, session_id: "s-beta", project: "shopify-bot", text: "Analyze recent orders for outliers", token_estimate: 800, created_at: dbTime(40) },
    { id: 3, session_id: "s-alpha", project: "my_dash", text: "Refactor the auth flow", token_estimate: 0, created_at: dbTime(120) },
  ],
};

async function stub(page: Page, prompts: object = PROMPTS) {
  await page.route("**/api/prompts*", (route) => route.fulfill({ json: prompts }));
  await page.route("**/api/search*", (route) => route.fulfill({ json: { hits: [] } }));
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

const w = (page: Page) => page.locator("#mc-widget-prompt-history");

test("prompt-history: chronological list, token estimate, drilldown links", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const ph = w(page);
  await ph.scrollIntoViewIfNeeded();

  // All prompts listed.
  await expect(ph.locator("li")).toHaveCount(3);
  await expect(ph.getByText("Build the dashboard and wire the hooks")).toBeVisible();

  // Token estimate shown only when > 0 (2 of the 3).
  await expect(ph.getByText(/Tokens/)).toHaveCount(2);

  // Each entry is a drill-down link to its session detail page.
  await expect(ph.locator("li a").first()).toHaveAttribute("href", "/session?id=s-alpha");
  await expect(ph.locator("li", { hasText: "Analyze recent orders" }).locator("a")).toHaveAttribute(
    "href",
    "/session?id=s-beta",
  );

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("prompt-history: global search filters, and a no-match shows no-results", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const ph = w(page);
  await ph.scrollIntoViewIfNeeded();

  const search = page.locator('input[type="search"]');
  await search.fill("orders");
  await expect(ph.locator("li")).toHaveCount(1);
  await expect(ph.getByText("Analyze recent orders for outliers")).toBeVisible();

  await search.fill("zzz-no-such-term");
  await expect(ph.getByText("Keine Treffer.")).toBeVisible();
  await expect(ph.locator("li")).toHaveCount(0);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("prompt-history: empty state when there are no prompts", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, { prompts: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const ph = w(page);
  await ph.scrollIntoViewIfNeeded();
  await expect(ph.getByText("Noch keine Prompts.")).toBeVisible();
  await expect(ph.locator("li")).toHaveCount(0);
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
      test(`prompt-history visual — ${label}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stub(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prime(page, mode, lang);
        await gotoDashboard(page);
        const ph = w(page);
        await ph.scrollIntoViewIfNeeded();
        await expect(ph.locator("li").first()).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(400);
        const shot = await ph.screenshot({ path: `test-results/prompt-history-shots/${label}.png` });
        await testInfo.attach(label, { body: shot, contentType: "image/png" });
        expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
      });
    }
  }
}
