import { test, expect, type Page } from "@playwright/test";

// Phase F — per-widget view variants: visual-regression + behaviour gate.
// TEMPLATE spec (extended per widget during FC rollout). Reference widget:
// tool-frequency (view ∈ {bars (default = today's look), table}).
//
// Hermetic by design: the `view` setting persists server-side via POST
// /api/plugins/config, so we intercept that route — GET returns the view under
// test, POST is a no-op — to pick a variant deterministically WITHOUT writing to
// the shared e2e DB (no cross-spec pollution). Tool data is stubbed too.

type ToolStat = { tool: string; count: number; failures: number; source: string | null; mcpServer: string | null; avgDurationMs: number | null };
const b = (tool: string, count: number, failures = 0, avg = 30): ToolStat => ({ tool, count, failures, source: "builtin", mcpServer: null, avgDurationMs: avg });
const TOOLS: ToolStat[] = [
  b("Read", 120, 0, 42), b("Edit", 90, 0, 30), b("Bash", 75, 5, 820),
  { tool: "mcp__github__search_issues", count: 48, failures: 1, source: "mcp", mcpServer: "github", avgDurationMs: 210 },
  b("Grep", 33, 0, 18), b("Write", 21, 0, 25),
];

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

// Stub tool data + pin tool-frequency's view via the config route (no DB write).
async function stub(page: Page, view?: "bars" | "table") {
  await page.route("**/api/tools*", (route) => route.fulfill({ json: { tools: TOOLS } }));
  await page.route("**/api/plugins/config**", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ json: { ok: true } });
    return route.fulfill({ json: { config: view ? { "tool-frequency": { view } } : {} } });
  });
}

async function gotoDashboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Claude Mission Control" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });
}

const tf = (page: Page) => page.locator("#mc-widget-tool-frequency");
const bars = (page: Page) => tf(page).locator("li div.h-full");
const viewSwitch = (page: Page) => tf(page).getByRole("group", { name: /^(Ansicht|View)$/ });

test.describe("tool-frequency view variants (FA reference widget)", () => {
  test("default view is bars (today's look) with a localized ViewSwitch (DE)", async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await stub(page); // no view → default
    await prime(page, "dark", "de");
    await gotoDashboard(page);
    const w = tf(page);
    await w.scrollIntoViewIfNeeded();

    // Default == bars: the original list of proportional bars renders, no table.
    await expect(bars(page).first()).toBeVisible({ timeout: 15_000 });
    await expect(w.locator("table")).toHaveCount(0);

    // ViewSwitch present, DE labels, bars is the pressed option.
    const sw = viewSwitch(page);
    await expect(sw).toBeVisible();
    await expect(sw.getByRole("button", { name: "Balken" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "false");
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("ViewSwitch labels are localized (EN)", async ({ page }) => {
    await stub(page);
    await prime(page, "dark", "en");
    await gotoDashboard(page);
    const sw = viewSwitch(page);
    await expect(sw.getByRole("button", { name: "Bars" })).toBeVisible();
    await expect(sw.getByRole("button", { name: "Table" })).toBeVisible();
  });

  // Visual regression: each variant in light AND dark (default + table).
  for (const mode of ["dark", "light"] as const) {
    for (const view of ["bars", "table"] as const) {
      test(`variant=${view} renders — ${mode}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stub(page, view);
        await prime(page, mode, "de");
        await gotoDashboard(page);
        const w = tf(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w).toBeVisible({ timeout: 15_000 });

        if (view === "bars") {
          await expect(bars(page).first()).toBeVisible();
          await expect(w.locator("table")).toHaveCount(0);
          await expect(viewSwitch(page).getByRole("button", { name: "Balken" })).toHaveAttribute("aria-pressed", "true");
        } else {
          await expect(w.locator("table tbody tr").first()).toBeVisible();
          await expect(bars(page)).toHaveCount(0);
          await expect(viewSwitch(page).getByRole("button", { name: "Tabelle" })).toHaveAttribute("aria-pressed", "true");
        }

        await page.waitForTimeout(250); // settle width/colour transitions before the shot
        const shot = await w.screenshot({ path: `test-results/view-variants-shots/tool-frequency-${view}-${mode}.png` });
        await testInfo.attach(`tool-frequency-${view}-${mode}`, { body: shot, contentType: "image/png" });
        expect(errors, `console errors (${view}-${mode}):\n${errors.join("\n")}`).toEqual([]);
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

// ── F9 (file-hotspots): treemap (default) ↔ list ──────────────────────────────
const FILES = { files: [
  { path: "src/app/page.tsx", name: "page.tsx", edits: 40, added: 600, removed: 200, churn: 800 },
  { path: "src/lib/ingest.ts", name: "ingest.ts", edits: 30, added: 400, removed: 150, churn: 550 },
  { path: "src/components/dashboard.tsx", name: "dashboard.tsx", edits: 25, added: 300, removed: 100, churn: 400 },
  { path: "README.md", name: "README.md", edits: 12, added: 150, removed: 60, churn: 210 },
  { path: "src/lib/db.ts", name: "db.ts", edits: 8, added: 90, removed: 30, churn: 120 },
] };
async function stubFileHotspots(page: Page, view?: "treemap" | "list") {
  await page.route("**/api/files*", (route) => route.fulfill({ json: FILES }));
  await stubPluginConfig(page, view ? { "file-hotspots": { view } } : {});
}

test.describe("view variant — file-hotspots (treemap↔list)", () => {
  const fh = (page: Page) => widget(page, "file-hotspots");
  const treemap = (page: Page) => fh(page).locator(".recharts-responsive-container");
  test("default = treemap (today's look), ViewSwitch labelled DE", async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await stubFileHotspots(page);
    await prime(page, "dark", "de");
    await gotoDashboard(page);
    const w = fh(page);
    await w.scrollIntoViewIfNeeded();
    await expect(treemap(page)).toBeVisible({ timeout: 15_000 });
    await expect(w.locator("ul")).toHaveCount(0);
    const sw = viewSwitchOf(w);
    await expect(sw.getByRole("button", { name: "Treemap" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "Liste" })).toHaveAttribute("aria-pressed", "false");
    expect(errors, errors.join("\n")).toEqual([]);
  });
  test("ViewSwitch localized (EN)", async ({ page }) => {
    await stubFileHotspots(page);
    await prime(page, "dark", "en");
    await gotoDashboard(page);
    const sw = viewSwitchOf(fh(page));
    await expect(sw.getByRole("button", { name: "Treemap" })).toBeVisible();
    await expect(sw.getByRole("button", { name: "List" })).toBeVisible();
  });
  for (const mode of ["dark", "light"] as const) {
    for (const view of ["treemap", "list"] as const) {
      test(`variant=${view} renders — ${mode}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stubFileHotspots(page, view);
        await prime(page, mode, "de");
        await gotoDashboard(page);
        const w = fh(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w).toBeVisible({ timeout: 15_000 });
        if (view === "treemap") {
          await expect(treemap(page)).toBeVisible();
          await expect(w.locator("ul")).toHaveCount(0);
          await expect(viewSwitchOf(w).getByRole("button", { name: "Treemap" })).toHaveAttribute("aria-pressed", "true");
        } else {
          await expect(w.locator("ul li").first()).toBeVisible();
          await expect(viewSwitchOf(w).getByRole("button", { name: "Liste" })).toHaveAttribute("aria-pressed", "true");
        }
        await page.waitForTimeout(250);
        const shot = await w.screenshot({ path: `test-results/view-variants-shots/file-hotspots-${view}-${mode}.png` });
        await testInfo.attach(`file-hotspots-${view}-${mode}`, { body: shot, contentType: "image/png" });
        expect(errors, errors.join("\n")).toEqual([]);
      });
    }
  }
});

// ── F10 (session-timeline): timeline (default) ↔ list ─────────────────────────
// Gantt bars only render for sessions inside the [now−Nd, now] window, so build
// timestamps RELATIVE to now (DB format "YYYY-MM-DD HH:MM:SS", UTC).
const dbTs = (msAgo: number) => new Date(Date.now() - msAgo).toISOString().slice(0, 19).replace("T", " ");
const stRow = (id: string, status: "active" | "waiting" | "ended", title: string, startAgo: number, endAgo: number) => ({
  id, project_path: `/home/user/projects/${title}`, project_name: "demo-bot", title, status,
  source: "startup", first_seen: dbTs(startAgo), last_seen: dbTs(endAgo),
  ended_at: status === "ended" ? dbTs(endAgo) : null,
  token_input: 1000, token_output: 800, token_cache: 2000, cost_usd: 0.5,
  branch: "main", git_commit: null, remote_url: null, transcript_path: null, machine: null,
  event_count: 12, tool_count: 5,
});
const TIMELINE_SESSIONS = {
  sessions: [
    stRow("st-1", "active", "alpha", 60 * 60_000, 5 * 60_000),
    stRow("st-2", "waiting", "beta", 120 * 60_000, 30 * 60_000),
    stRow("st-3", "ended", "gamma", 180 * 60_000, 90 * 60_000),
  ],
};
async function stubTimeline(page: Page, view?: "timeline" | "list") {
  await page.route("**/api/sessions*", (route) => route.fulfill({ json: TIMELINE_SESSIONS }));
  await stubPluginConfig(page, view ? { "session-timeline": { view } } : {});
}

test.describe("view variant — session-timeline (timeline↔list)", () => {
  const st = (page: Page) => widget(page, "session-timeline");
  const ganttBars = (page: Page) => st(page).locator("ul > li div.absolute"); // gantt bars; list view has none
  test("default = timeline (today's look), ViewSwitch labelled DE", async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await stubTimeline(page);
    await prime(page, "dark", "de");
    await gotoDashboard(page);
    const w = st(page);
    await w.scrollIntoViewIfNeeded();
    await expect(ganttBars(page).first()).toBeVisible({ timeout: 15_000 });
    const sw = viewSwitchOf(w);
    await expect(sw.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "Liste" })).toHaveAttribute("aria-pressed", "false");
    expect(errors, errors.join("\n")).toEqual([]);
  });
  test("ViewSwitch localized (EN)", async ({ page }) => {
    await stubTimeline(page);
    await prime(page, "dark", "en");
    await gotoDashboard(page);
    const sw = viewSwitchOf(st(page));
    await expect(sw.getByRole("button", { name: "Timeline" })).toBeVisible();
    await expect(sw.getByRole("button", { name: "List" })).toBeVisible();
  });
  for (const mode of ["dark", "light"] as const) {
    for (const view of ["timeline", "list"] as const) {
      test(`variant=${view} renders — ${mode}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);
        await stubTimeline(page, view);
        await prime(page, mode, "de");
        await gotoDashboard(page);
        const w = st(page);
        await w.scrollIntoViewIfNeeded();
        await expect(w).toBeVisible({ timeout: 15_000 });
        if (view === "timeline") {
          await expect(ganttBars(page).first()).toBeVisible();
          await expect(viewSwitchOf(w).getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-pressed", "true");
        } else {
          await expect(ganttBars(page)).toHaveCount(0);
          await expect(w.locator("ul li").first()).toBeVisible();
          await expect(viewSwitchOf(w).getByRole("button", { name: "Liste" })).toHaveAttribute("aria-pressed", "true");
        }
        await page.waitForTimeout(250);
        const shot = await w.screenshot({ path: `test-results/view-variants-shots/session-timeline-${view}-${mode}.png` });
        await testInfo.attach(`session-timeline-${view}-${mode}`, { body: shot, contentType: "image/png" });
        expect(errors, errors.join("\n")).toEqual([]);
      });
    }
  }
});
