import { test, expect, type Page } from "@playwright/test";

// Run 119a — mcp-servers (activity per MCP server: calls, error rate, latency) and
// compaction-timeline (auto/manual context compactions over time). mcp-servers
// reads /api/mcp, compaction-timeline /api/compactions; both stubbed per page so
// rows, bars, severity colours, stats and search are deterministic and the
// screenshots reproducible. Maths is unit-tested in
// src/lib/{mcp-servers,compaction}.test.ts.
function dbTime(minAgo: number): string {
  const d = new Date(Date.now() - minAgo * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
const MCP = {
  servers: [
    { server: "github", calls: 120, failures: 0, errorRate: 0, tools: 8, avgMs: 210, last_at: dbTime(5) },
    { server: "supabase", calls: 64, failures: 3, errorRate: 0.047, tools: 5, avgMs: 540, last_at: dbTime(30) },
    { server: "shopify", calls: 30, failures: 9, errorRate: 0.3, tools: 12, avgMs: 1200, last_at: dbTime(120) },
  ],
};
const COMPACTIONS = {
  compactions: Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    session_id: `sess${i}`,
    trigger: i % 2 ? "manual" : "auto",
    customInstructions: i === 0 ? "keep the API design notes" : null,
    created_at: dbTime(10 + i * 60),
  })),
};

async function stub(page: Page, mcp: object = MCP, compactions: object = COMPACTIONS) {
  await page.route("**/api/mcp*", (route) => route.fulfill({ json: mcp }));
  await page.route("**/api/compactions*", (route) => route.fulfill({ json: compactions }));
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
          await page.waitForTimeout(600);
          const shot = await w.screenshot({ path: `test-results/${dir}-shots/${label}.png` });
          await testInfo.attach(label, { body: shot, contentType: "image/png" });
          expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
        });
      }
    }
  }
}

// ── mcp-servers ──────────────────────────────────────────────────────────────
const mcOf = (page: Page) => page.locator("#mc-widget-mcp-servers");

test("mcp-servers: rows with calls, severity error colours, latency + search", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = mcOf(page);
  await w.scrollIntoViewIfNeeded();

  await expect(w.locator("li")).toHaveCount(3);
  await expect(w.getByText("github", { exact: true })).toBeVisible();

  // Severity colour by error rate: 0% green, <10% amber, else red.
  await expect(w.locator("li", { hasText: "github" }).getByText(/Fehler/)).toHaveClass(/text-emerald-400/);
  await expect(w.locator("li", { hasText: "supabase" }).getByText(/Fehler/)).toHaveClass(/text-amber-400/);
  await expect(w.locator("li", { hasText: "shopify" }).getByText(/Fehler/)).toHaveClass(/text-red-400/);

  // Bar width is proportional; the busiest server (github, 120) fills the track.
  const githubBar = w.locator("li", { hasText: "github" }).locator("div[style*='width']");
  expect(await githubBar.evaluate((e) => (e as HTMLElement).style.width)).toBe("100%");

  // Latency + tools shown.
  await expect(w.locator("li", { hasText: "shopify" }).getByText("1.2s")).toBeVisible();

  // Global search filters.
  await page.locator('input[type="search"]').fill("supabase");
  await expect(w.locator("li")).toHaveCount(1);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("mcp-servers: empty state", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, { servers: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = mcOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine MCP-Aufrufe.")).toBeVisible();
  await expect(w.locator("li")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("mcp-servers", "mcp-servers");

// ── compaction-timeline ──────────────────────────────────────────────────────
const ctOf = (page: Page) => page.locator("#mc-widget-compaction-timeline");

test("compaction-timeline: stats, per-day bars, trigger-tagged list", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = ctOf(page);
  await w.scrollIntoViewIfNeeded();

  // Summary tiles: total, auto, manual, last.
  await expect(w.locator(".grid p.font-mono")).toHaveText(["5", "3", "2", /vor/]);

  // 14 per-day bars, each with a hover title.
  await expect(w.locator("div[title]")).toHaveCount(14);

  // The recent list with auto/manual trigger tags + a custom instruction.
  await expect(w.locator("ul li")).toHaveCount(5);
  await expect(w.getByText("auto").first()).toBeVisible();
  await expect(w.getByText("manuell").first()).toBeVisible();
  await expect(w.getByText("keep the API design notes")).toBeVisible();

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("compaction-timeline: empty state", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, MCP, { compactions: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = ctOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Kompaktierungen.")).toBeVisible();
  await expect(w.locator("ul li")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("compaction-timeline", "compaction-timeline");
