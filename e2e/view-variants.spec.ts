import { test, expect, type Page } from "@playwright/test";

// Phase F — per-widget view variants: visual-regression + behaviour gate.
// One spec per pilot/rollout widget (cloned from the same template). Each asserts:
// default variant === today's look, every variant renders in light AND dark, the
// ViewSwitch carries DE+EN labels with correct aria-pressed, and the console stays
// clean. Hermetic: the `view` setting persists via POST /api/plugins/config, so we
// intercept that route (GET = the view under test, POST = no-op) to pick a variant
// WITHOUT writing to the shared e2e DB — zero cross-spec pollution.

const IGNORE = [/WebGL/i, /THREE\.WebGLRenderer/i, /Download the React DevTools/i, /reading 'tick'/];
function watchConsole(page: Page, errors: string[]) {
  page.on("console", (m) => { if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) errors.push(m.text()); });
  page.on("pageerror", (e) => { if (!IGNORE.some((re) => re.test(e.message))) errors.push(e.message); });
}
function prime(page: Page, mode: "dark" | "light", lang: "de" | "en") {
  return page.addInitScript(([m, l]) => {
    try {
      localStorage.setItem("mc-onboarded", "1");
      localStorage.setItem("mc-theme", JSON.stringify({ mode: m, accent: "#4f8cff" }));
      localStorage.setItem("mc-lang", l);
    } catch { /* ignore */ }
  }, [mode, lang] as const);
}
async function gotoDashboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Claude Mission Control" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });
}
// Pin a widget's `view` deterministically via the config route — no DB write.
async function stubPluginConfig(page: Page, config: Record<string, Record<string, unknown>> = {}) {
  await page.route("**/api/plugins/config**", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ json: { ok: true } });
    return route.fulfill({ json: { config } });
  });
}
const widget = (page: Page, id: string) => page.locator(`#mc-widget-${id}`);
const viewSwitchOf = (w: ReturnType<typeof widget>) => w.getByRole("group", { name: /^(Ansicht|View)$/ });

// ── F4 reference (tool-frequency): bars (default) ↔ table ─────────────────────
type ToolStat = { tool: string; count: number; failures: number; source: string | null; mcpServer: string | null; avgDurationMs: number | null };
const b = (tool: string, count: number, failures = 0, avg = 30): ToolStat => ({ tool, count, failures, source: "builtin", mcpServer: null, avgDurationMs: avg });
const TOOLS: ToolStat[] = [
  b("Read", 120, 0, 42), b("Edit", 90, 0, 30), b("Bash", 75, 5, 820),
  { tool: "mcp__github__search_issues", count: 48, failures: 1, source: "mcp", mcpServer: "github", avgDurationMs: 210 },
  b("Grep", 33, 0, 18), b("Write", 21, 0, 25),
];
async function stubToolFreq(page: Page, view?: "bars" | "table") {
  await page.route("**/api/tools*", (route) => route.fulfill({ json: { tools: TOOLS } }));
  await stubPluginConfig(page, view ? { "tool-frequency": { view } } : {});
}

test.describe("view variant — tool-frequency (bars↔table)", () => {
  const tf = (page: Page) => widget(page, "tool-frequency");
  const bars = (page: Page) => tf(page).locator("li div.h-full");

  test("default = bars (today's look), ViewSwitch labelled DE", async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await stubToolFreq(page);
    await prime(page, "dark", "de");
    await gotoDashboard(page);
    const w = tf(page);
    await w.scrollIntoViewIfNeeded();
    await expect(bars(page).first()).toBeVisible({ timeout: 15_000 });
    await expect(w.locator("table")).toHaveCount(0);
    const sw = viewSwitchOf(w);
    await expect(sw.getByRole("button", { name: "Balken" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "false");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("ViewSwitch localized (EN)", async ({ page }) => {
    await stubToolFreq(page);
    await prime(page, "dark", "en");
    await gotoDashboard(page);
    const sw = viewSwitchOf(tf(page));
    await expect(sw.getByRole("button", { name: "Bars" })).toBeVisible();
    await expect(sw.getByRole("button", { name: "Table" })).toBeVisible();
  });

  for (const mode of ["dark", "light"] as const) {
    for (const view of ["bars", "table"] as const) {
      test(`variant=${view} renders — ${mode}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stubToolFreq(page, view);
        await prime(page, mode, "de");
        await gotoDashboard(page);
        const w = tf(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w).toBeVisible({ timeout: 15_000 });
        if (view === "bars") {
          await expect(bars(page).first()).toBeVisible();
          await expect(w.locator("table")).toHaveCount(0);
          await expect(viewSwitchOf(w).getByRole("button", { name: "Balken" })).toHaveAttribute("aria-pressed", "true");
        } else {
          await expect(w.locator("table tbody tr").first()).toBeVisible();
          await expect(bars(page)).toHaveCount(0);
          await expect(viewSwitchOf(w).getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "true");
        }
        await page.waitForTimeout(250);
        const shot = await w.screenshot({ path: `test-results/view-variants-shots/tool-frequency-${view}-${mode}.png` });
        await testInfo.attach(`tool-frequency-${view}-${mode}`, { body: shot, contentType: "image/png" });
        expect(errors, errors.join("\n")).toEqual([]);
      });
    }
  }
});

// ── F1 pilot (token-chart): chart (default) ↔ table ───────────────────────────
const USAGE = {
  available: true,
  months: [],
  blocks: [],
  burn: null,
  // Populated for model-donut (F2, per-model share) as well as token-chart's days.
  models: [
    { model: "claude-opus-4-7", inputTokens: 200000, outputTokens: 120000, cacheTokens: 480000, totalTokens: 800000, costUsd: 12.5, costEur: 11.5 },
    { model: "claude-sonnet-4-6", inputTokens: 400000, outputTokens: 300000, cacheTokens: 800000, totalTokens: 1500000, costUsd: 4.2, costEur: 3.86 },
    { model: "claude-haiku-4-5", inputTokens: 200000, outputTokens: 100000, cacheTokens: 300000, totalTokens: 600000, costUsd: 0.8, costEur: 0.74 },
  ],
  totals: { inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, costEur: 0 },
  days: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-05-0${i + 1}`,
    inputTokens: 20000 + i * 3000,
    outputTokens: 12000 + i * 2000,
    cacheTokens: 40000 + i * 5000,
    costEur: Number((1.2 + i * 0.3).toFixed(2)),
    costUsd: Number((1.3 + i * 0.32).toFixed(2)),
  })),
};
async function stubTokenChart(page: Page, view?: "chart" | "table") {
  await page.route("**/api/usage", (route) => route.fulfill({ json: USAGE }));
  await stubPluginConfig(page, view ? { "token-chart": { view } } : {});
}

test.describe("view variant — token-chart (chart↔table)", () => {
  const tc = (page: Page) => widget(page, "token-chart");
  const chart = (page: Page) => tc(page).locator(".recharts-responsive-container");

  test("default = chart (today's look), ViewSwitch labelled DE", async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await stubTokenChart(page);
    await prime(page, "dark", "de");
    await gotoDashboard(page);
    const w = tc(page);
    await w.scrollIntoViewIfNeeded();
    await expect(chart(page)).toBeVisible({ timeout: 15_000 });
    await expect(w.locator("table")).toHaveCount(0);
    const sw = viewSwitchOf(w);
    await expect(sw.getByRole("button", { name: "Diagramm" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "false");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("ViewSwitch localized (EN)", async ({ page }) => {
    await stubTokenChart(page);
    await prime(page, "dark", "en");
    await gotoDashboard(page);
    const sw = viewSwitchOf(tc(page));
    await expect(sw.getByRole("button", { name: "Chart" })).toBeVisible();
    await expect(sw.getByRole("button", { name: "Table" })).toBeVisible();
  });

  for (const mode of ["dark", "light"] as const) {
    for (const view of ["chart", "table"] as const) {
      test(`variant=${view} renders — ${mode}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stubTokenChart(page, view);
        await prime(page, mode, "de");
        await gotoDashboard(page);
        const w = tc(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w).toBeVisible({ timeout: 15_000 });
        if (view === "chart") {
          await expect(chart(page)).toBeVisible();
          await expect(w.locator("table")).toHaveCount(0);
          await expect(viewSwitchOf(w).getByRole("button", { name: "Diagramm" })).toHaveAttribute("aria-pressed", "true");
        } else {
          await expect(w.locator("table tbody tr").first()).toBeVisible();
          await expect(chart(page)).toHaveCount(0);
          await expect(viewSwitchOf(w).getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "true");
        }
        await page.waitForTimeout(250);
        const shot = await w.screenshot({ path: `test-results/view-variants-shots/token-chart-${view}-${mode}.png` });
        await testInfo.attach(`token-chart-${view}-${mode}`, { body: shot, contentType: "image/png" });
        expect(errors, errors.join("\n")).toEqual([]);
      });
    }
  }
});

// ── F2 pilot (model-donut): donut (default) ↔ bars ────────────────────────────
async function stubModelDonut(page: Page, view?: "donut" | "bars") {
  await page.route("**/api/usage", (route) => route.fulfill({ json: USAGE }));
  await stubPluginConfig(page, view ? { "model-donut": { view } } : {});
}

test.describe("view variant — model-donut (donut↔bars)", () => {
  const md = (page: Page) => widget(page, "model-donut");
  // donut variant renders a recharts pie; bars variant (DonutBars) has no recharts.
  const donut = (page: Page) => md(page).locator(".recharts-responsive-container");

  test("default = donut (today's look), ViewSwitch labelled DE", async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await stubModelDonut(page);
    await prime(page, "dark", "de");
    await gotoDashboard(page);
    const w = md(page);
    await w.scrollIntoViewIfNeeded();
    await expect(donut(page)).toBeVisible({ timeout: 15_000 });
    const sw = viewSwitchOf(w);
    await expect(sw.getByRole("button", { name: "Donut" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "Balken" })).toHaveAttribute("aria-pressed", "false");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("ViewSwitch localized (EN)", async ({ page }) => {
    await stubModelDonut(page);
    await prime(page, "dark", "en");
    await gotoDashboard(page);
    const sw = viewSwitchOf(md(page));
    await expect(sw.getByRole("button", { name: "Donut" })).toBeVisible();
    await expect(sw.getByRole("button", { name: "Bars" })).toBeVisible();
  });

  for (const mode of ["dark", "light"] as const) {
    for (const view of ["donut", "bars"] as const) {
      test(`variant=${view} renders — ${mode}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stubModelDonut(page, view);
        await prime(page, mode, "de");
        await gotoDashboard(page);
        const w = md(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w).toBeVisible({ timeout: 15_000 });
        if (view === "donut") {
          await expect(donut(page)).toBeVisible();
          await expect(viewSwitchOf(w).getByRole("button", { name: "Donut" })).toHaveAttribute("aria-pressed", "true");
        } else {
          await expect(donut(page)).toHaveCount(0);
          await expect(w.locator("ul li").first()).toBeVisible();
          await expect(viewSwitchOf(w).getByRole("button", { name: "Balken" })).toHaveAttribute("aria-pressed", "true");
        }
        await page.waitForTimeout(250);
        const shot = await w.screenshot({ path: `test-results/view-variants-shots/model-donut-${view}-${mode}.png` });
        await testInfo.attach(`model-donut-${view}-${mode}`, { body: shot, contentType: "image/png" });
        expect(errors, errors.join("\n")).toEqual([]);
      });
    }
  }
});

// ── F3 pilot (kanban): board (default) ↔ list ─────────────────────────────────
const sess = (id: string, status: "active" | "waiting" | "ended", title: string, hh: string) => ({
  id, project_path: `/home/user/projects/${title}`, project_name: "demo-bot", title, status,
  source: "startup", first_seen: "2026-05-25 10:00:00", last_seen: `2026-05-25 ${hh}:00:00`,
  ended_at: status === "ended" ? "2026-05-25 12:00:00" : null,
  token_input: 1000, token_output: 800, token_cache: 2000, cost_usd: 0.5,
  branch: "main", git_commit: null, remote_url: null, transcript_path: null, machine: null,
  event_count: 12, tool_count: 5,
});
const SESSIONS = [sess("s-active", "active", "alpha", "11"), sess("s-wait", "waiting", "beta", "10"), sess("s-ended", "ended", "gamma", "12")];
async function stubKanban(page: Page, view?: "board" | "list") {
  await page.route("**/api/sessions*", (route) => route.fulfill({ json: { sessions: SESSIONS } }));
  await stubPluginConfig(page, view ? { kanban: { view } } : {});
}

test.describe("view variant — kanban (board↔list)", () => {
  const kb = (page: Page) => widget(page, "kanban");
  // board variant is the 3-column grid; list variant (SessionList) is a flat <ul>.
  const board = (page: Page) => kb(page).locator('[class*="grid-cols-3"]');
  const listRows = (page: Page) => kb(page).locator("ul li button");

  test("default = board (today's look), ViewSwitch labelled DE", async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await stubKanban(page);
    await prime(page, "dark", "de");
    await gotoDashboard(page);
    const w = kb(page);
    await w.scrollIntoViewIfNeeded();
    await expect(board(page)).toBeVisible({ timeout: 15_000 });
    const sw = viewSwitchOf(w);
    await expect(sw.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "Liste" })).toHaveAttribute("aria-pressed", "false");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("ViewSwitch localized (EN)", async ({ page }) => {
    await stubKanban(page);
    await prime(page, "dark", "en");
    await gotoDashboard(page);
    const sw = viewSwitchOf(kb(page));
    await expect(sw.getByRole("button", { name: "Board" })).toBeVisible();
    await expect(sw.getByRole("button", { name: "List" })).toBeVisible();
  });

  for (const mode of ["dark", "light"] as const) {
    for (const view of ["board", "list"] as const) {
      test(`variant=${view} renders — ${mode}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stubKanban(page, view);
        await prime(page, mode, "de");
        await gotoDashboard(page);
        const w = kb(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w).toBeVisible({ timeout: 15_000 });
        if (view === "board") {
          await expect(board(page)).toBeVisible();
          await expect(viewSwitchOf(w).getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
        } else {
          await expect(board(page)).toHaveCount(0);
          await expect(listRows(page).first()).toBeVisible();
          await expect(viewSwitchOf(w).getByRole("button", { name: "Liste" })).toHaveAttribute("aria-pressed", "true");
        }
        await page.waitForTimeout(250);
        const shot = await w.screenshot({ path: `test-results/view-variants-shots/kanban-${view}-${mode}.png` });
        await testInfo.attach(`kanban-${view}-${mode}`, { body: shot, contentType: "image/png" });
        expect(errors, errors.join("\n")).toEqual([]);
      });
    }
  }
});

// ── F5 (project-leaderboard): table (default) ↔ bars ──────────────────────────
const PROJECTS = { projects: [
  { project: "alpha", sessions: 2, tools: 40, costUsd: 10, tokenInput: 0, tokenOutput: 0, tokenCache: 0, totalTokens: 500000 },
  { project: "beta", sessions: 9, tools: 20, costUsd: 5, tokenInput: 0, tokenOutput: 0, tokenCache: 0, totalTokens: 300000 },
  { project: "gamma", sessions: 5, tools: 60, costUsd: 8, tokenInput: 0, tokenOutput: 0, tokenCache: 0, totalTokens: 900000 },
] };
async function stubLeaderboard(page: Page, view?: "table" | "bars") {
  await page.route("**/api/usage/projects*", (route) => route.fulfill({ json: PROJECTS }));
  await stubPluginConfig(page, view ? { "project-leaderboard": { view } } : {});
}

test.describe("view variant — project-leaderboard (table↔bars)", () => {
  const pl = (page: Page) => widget(page, "project-leaderboard");
  test("default = table (today's look), ViewSwitch labelled DE", async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await stubLeaderboard(page);
    await prime(page, "dark", "de");
    await gotoDashboard(page);
    const w = pl(page);
    await w.scrollIntoViewIfNeeded();
    await expect(w.locator("table")).toBeVisible({ timeout: 15_000 });
    const sw = viewSwitchOf(w);
    await expect(sw.getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "Balken" })).toHaveAttribute("aria-pressed", "false");
    expect(errors, errors.join("\n")).toEqual([]);
  });
  test("ViewSwitch localized (EN)", async ({ page }) => {
    await stubLeaderboard(page);
    await prime(page, "dark", "en");
    await gotoDashboard(page);
    const sw = viewSwitchOf(pl(page));
    await expect(sw.getByRole("button", { name: "Table" })).toBeVisible();
    await expect(sw.getByRole("button", { name: "Bars" })).toBeVisible();
  });
  for (const mode of ["dark", "light"] as const) {
    for (const view of ["table", "bars"] as const) {
      test(`variant=${view} renders — ${mode}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stubLeaderboard(page, view);
        await prime(page, mode, "de");
        await gotoDashboard(page);
        const w = pl(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w).toBeVisible({ timeout: 15_000 });
        if (view === "table") {
          await expect(w.locator("table")).toBeVisible();
          await expect(viewSwitchOf(w).getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "true");
        } else {
          await expect(w.locator("table")).toHaveCount(0);
          await expect(w.locator("ul li").first()).toBeVisible();
          await expect(viewSwitchOf(w).getByRole("button", { name: "Balken" })).toHaveAttribute("aria-pressed", "true");
        }
        await page.waitForTimeout(250);
        const shot = await w.screenshot({ path: `test-results/view-variants-shots/project-leaderboard-${view}-${mode}.png` });
        await testInfo.attach(`project-leaderboard-${view}-${mode}`, { body: shot, contentType: "image/png" });
        expect(errors, errors.join("\n")).toEqual([]);
      });
    }
  }
});

// ── F6 (tag-cloud): cloud (default) ↔ list ────────────────────────────────────
const TAGS = { terms: [
  { term: "dashboard", count: 20 }, { term: "widget", count: 16 }, { term: "refactor", count: 12 },
  { term: "tooltip", count: 9 }, { term: "sankey", count: 7 }, { term: "audit", count: 6 },
  { term: "theme", count: 5 }, { term: "hover", count: 3 }, { term: "empty", count: 2 },
] };
async function stubTagCloud(page: Page, view?: "cloud" | "list") {
  await page.route("**/api/tags*", (route) => route.fulfill({ json: TAGS }));
  await stubPluginConfig(page, view ? { "tag-cloud": { view } } : {});
}

test.describe("view variant — tag-cloud (cloud↔list)", () => {
  const tg = (page: Page) => widget(page, "tag-cloud");
  const cloud = (page: Page) => tg(page).locator('[class*="flex-wrap"]');
  test("default = cloud (today's look), ViewSwitch labelled DE", async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await stubTagCloud(page);
    await prime(page, "dark", "de");
    await gotoDashboard(page);
    const w = tg(page);
    await w.scrollIntoViewIfNeeded();
    await expect(cloud(page)).toBeVisible({ timeout: 15_000 });
    await expect(w.locator("ul")).toHaveCount(0);
    const sw = viewSwitchOf(w);
    await expect(sw.getByRole("button", { name: "Cloud" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "Liste" })).toHaveAttribute("aria-pressed", "false");
    expect(errors, errors.join("\n")).toEqual([]);
  });
  test("ViewSwitch localized (EN)", async ({ page }) => {
    await stubTagCloud(page);
    await prime(page, "dark", "en");
    await gotoDashboard(page);
    const sw = viewSwitchOf(tg(page));
    await expect(sw.getByRole("button", { name: "Cloud" })).toBeVisible();
    await expect(sw.getByRole("button", { name: "List" })).toBeVisible();
  });
  for (const mode of ["dark", "light"] as const) {
    for (const view of ["cloud", "list"] as const) {
      test(`variant=${view} renders — ${mode}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stubTagCloud(page, view);
        await prime(page, mode, "de");
        await gotoDashboard(page);
        const w = tg(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w).toBeVisible({ timeout: 15_000 });
        if (view === "cloud") {
          await expect(cloud(page)).toBeVisible();
          await expect(w.locator("ul")).toHaveCount(0);
          await expect(viewSwitchOf(w).getByRole("button", { name: "Cloud" })).toHaveAttribute("aria-pressed", "true");
        } else {
          await expect(w.locator("ul li").first()).toBeVisible();
          await expect(viewSwitchOf(w).getByRole("button", { name: "Liste" })).toHaveAttribute("aria-pressed", "true");
        }
        await page.waitForTimeout(250);
        const shot = await w.screenshot({ path: `test-results/view-variants-shots/tag-cloud-${view}-${mode}.png` });
        await testInfo.attach(`tag-cloud-${view}-${mode}`, { body: shot, contentType: "image/png" });
        expect(errors, errors.join("\n")).toEqual([]);
      });
    }
  }
});

// ── F7 (latency): histogram (default) ↔ table ─────────────────────────────────
const LAT = { stats: { count: 100, p50: 40, p95: 200, p99: 500, max: 800, buckets: [
  { label: "0–50ms", count: 60 }, { label: "50–100ms", count: 25 }, { label: "100–500ms", count: 12 }, { label: "500ms+", count: 3 },
] }, tools: ["Read", "Bash", "Edit"] };
async function stubLatency(page: Page, view?: "histogram" | "table") {
  await page.route("**/api/tools/latency*", (route) => route.fulfill({ json: LAT }));
  await stubPluginConfig(page, view ? { latency: { view } } : {});
}

test.describe("view variant — latency (histogram↔table)", () => {
  const lt = (page: Page) => widget(page, "latency");
  const hist = (page: Page) => lt(page).locator(".recharts-responsive-container");
  test("default = histogram (today's look), ViewSwitch labelled DE", async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await stubLatency(page);
    await prime(page, "dark", "de");
    await gotoDashboard(page);
    const w = lt(page);
    await w.scrollIntoViewIfNeeded();
    await expect(hist(page)).toBeVisible({ timeout: 15_000 });
    await expect(w.locator("table")).toHaveCount(0);
    const sw = viewSwitchOf(w);
    await expect(sw.getByRole("button", { name: "Histogramm" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "false");
    expect(errors, errors.join("\n")).toEqual([]);
  });
  test("ViewSwitch localized (EN)", async ({ page }) => {
    await stubLatency(page);
    await prime(page, "dark", "en");
    await gotoDashboard(page);
    const sw = viewSwitchOf(lt(page));
    await expect(sw.getByRole("button", { name: "Histogram" })).toBeVisible();
    await expect(sw.getByRole("button", { name: "Table" })).toBeVisible();
  });
  for (const mode of ["dark", "light"] as const) {
    for (const view of ["histogram", "table"] as const) {
      test(`variant=${view} renders — ${mode}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stubLatency(page, view);
        await prime(page, mode, "de");
        await gotoDashboard(page);
        const w = lt(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w).toBeVisible({ timeout: 15_000 });
        if (view === "histogram") {
          await expect(hist(page)).toBeVisible();
          await expect(w.locator("table")).toHaveCount(0);
          await expect(viewSwitchOf(w).getByRole("button", { name: "Histogramm" })).toHaveAttribute("aria-pressed", "true");
        } else {
          await expect(w.locator("table")).toBeVisible();
          await expect(hist(page)).toHaveCount(0);
          await expect(viewSwitchOf(w).getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "true");
        }
        await page.waitForTimeout(250);
        const shot = await w.screenshot({ path: `test-results/view-variants-shots/latency-${view}-${mode}.png` });
        await testInfo.attach(`latency-${view}-${mode}`, { body: shot, contentType: "image/png" });
        expect(errors, errors.join("\n")).toEqual([]);
      });
    }
  }
});

// ── F8 (error-rate): chart (default) ↔ table ──────────────────────────────────
const ERRORS = {
  stats: { toolCalls: 200, failures: 24, errorRate: 0.12 },
  series: [
    { date: "2026-05-18", total: 30, failures: 2 }, { date: "2026-05-19", total: 40, failures: 5 },
    { date: "2026-05-20", total: 35, failures: 8 }, { date: "2026-05-21", total: 45, failures: 3 },
    { date: "2026-05-22", total: 50, failures: 6 },
  ],
  topTools: [
    { tool: "Bash", failures: 12, total: 60, rate: 0.2 }, { tool: "WebFetch", failures: 7, total: 20, rate: 0.35 },
    { tool: "Edit", failures: 5, total: 80, rate: 0.0625 },
  ],
  recent: [],
};
async function stubErrorRate(page: Page, view?: "chart" | "table") {
  await page.route("**/api/errors*", (route) => route.fulfill({ json: ERRORS }));
  await stubPluginConfig(page, view ? { "error-rate": { view } } : {});
}

test.describe("view variant — error-rate (chart↔table)", () => {
  const er = (page: Page) => widget(page, "error-rate");
  const chart = (page: Page) => er(page).locator(".recharts-responsive-container");
  test("default = chart (today's look), ViewSwitch labelled DE", async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await stubErrorRate(page);
    await prime(page, "dark", "de");
    await gotoDashboard(page);
    const w = er(page);
    await w.scrollIntoViewIfNeeded();
    await expect(chart(page)).toBeVisible({ timeout: 15_000 });
    await expect(w.locator("table")).toHaveCount(0);
    const sw = viewSwitchOf(w);
    await expect(sw.getByRole("button", { name: "Diagramm" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "false");
    expect(errors, errors.join("\n")).toEqual([]);
  });
  test("ViewSwitch localized (EN)", async ({ page }) => {
    await stubErrorRate(page);
    await prime(page, "dark", "en");
    await gotoDashboard(page);
    const sw = viewSwitchOf(er(page));
    await expect(sw.getByRole("button", { name: "Chart" })).toBeVisible();
    await expect(sw.getByRole("button", { name: "Table" })).toBeVisible();
  });
  for (const mode of ["dark", "light"] as const) {
    for (const view of ["chart", "table"] as const) {
      test(`variant=${view} renders — ${mode}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stubErrorRate(page, view);
        await prime(page, mode, "de");
        await gotoDashboard(page);
        const w = er(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w).toBeVisible({ timeout: 15_000 });
        if (view === "chart") {
          await expect(chart(page)).toBeVisible();
          await expect(w.locator("table")).toHaveCount(0);
          await expect(viewSwitchOf(w).getByRole("button", { name: "Diagramm" })).toHaveAttribute("aria-pressed", "true");
        } else {
          await expect(w.locator("table")).toBeVisible();
          await expect(chart(page)).toHaveCount(0);
          await expect(viewSwitchOf(w).getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "true");
        }
        await page.waitForTimeout(250);
        const shot = await w.screenshot({ path: `test-results/view-variants-shots/error-rate-${view}-${mode}.png` });
        await testInfo.attach(`error-rate-${view}-${mode}`, { body: shot, contentType: "image/png" });
        expect(errors, errors.join("\n")).toEqual([]);
      });
    }
  }
});
