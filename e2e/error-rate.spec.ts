import { test, expect, type Page } from "@playwright/test";

// Run 114 — the "Fehlerrate & Fehler-Panel" pair: error-rate (rate, series, top
// failing tools) and incidents (the recent-failures list with click-to-drilldown).
// Both read /api/errors; we stub it (and /api/tool-calls/:id, /api/search) per page
// so the audit is deterministic and the screenshots reproducible. The SQL is
// unit-tested in src/lib/errors.test.ts.
function dbTime(minAgo: number): string {
  const d = new Date(Date.now() - minAgo * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

const ERRORS = {
  stats: { toolCalls: 200, failures: 24, errorRate: 0.12 }, // 12% → amber tone
  series: [
    { date: "2026-05-18", total: 30, failures: 2 },
    { date: "2026-05-19", total: 40, failures: 5 },
    { date: "2026-05-20", total: 35, failures: 8 },
    { date: "2026-05-21", total: 45, failures: 3 },
    { date: "2026-05-22", total: 50, failures: 6 },
  ],
  topTools: [
    { tool: "Bash", failures: 12, total: 60, rate: 0.2 },
    { tool: "WebFetch", failures: 7, total: 20, rate: 0.35 },
    { tool: "Edit", failures: 5, total: 80, rate: 0.0625 },
  ],
  recent: [
    { id: 101, session_id: "s-1", tool_name: "Bash", target: "npm run build", error_text: "exit code 1: build failed", created_at: dbTime(5) },
    { id: 102, session_id: "s-1", tool_name: "WebFetch", target: "https://example.com", error_text: "timeout after 30s", created_at: dbTime(20) },
    { id: 103, session_id: "s-2", tool_name: "Edit", target: "/src/x.ts", error_text: "file not found", created_at: dbTime(60) },
  ],
};
const EMPTY = { stats: { toolCalls: 0, failures: 0, errorRate: 0 }, series: [], topTools: [], recent: [] };

const DETAIL = {
  detail: {
    id: 101,
    session_id: "s-1",
    tool_name: "Bash",
    target: "npm run build",
    success: 0,
    created_at: dbTime(5),
    input: { command: "npm run build", cwd: "/tmp/repo" },
    output: null,
    error_text: "exit code 1: build failed",
  },
};

async function stubErrors(page: Page, payload: object = ERRORS) {
  await page.route("**/api/errors*", (route) => route.fulfill({ json: payload }));
  await page.route("**/api/tool-calls/*", (route) => route.fulfill({ json: DETAIL }));
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
          await stubErrors(page);
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

// ── error-rate ───────────────────────────────────────────────────────────────
const erOf = (page: Page) => page.locator("#mc-widget-error-rate");

test("error-rate: rate, failures series, top failing tools, translated tooltip", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stubErrors(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = erOf(page);
  await w.scrollIntoViewIfNeeded();

  // Headline error rate + failures/total.
  await expect(w.getByText("12%")).toBeVisible();
  await expect(w.getByText(/24 \/ 200/)).toBeVisible();

  // Series area chart renders.
  await expect(w.locator(".recharts-area")).toBeVisible();

  // Top failing tools, with failure count + per-tool rate.
  await expect(w.getByText("Fehleranfälligste Tools")).toBeVisible();
  for (const tool of ["Bash", "WebFetch", "Edit"]) await expect(w.getByText(tool, { exact: true })).toBeVisible();
  await expect(w.getByText("35%")).toBeVisible(); // WebFetch rate

  // Tooltip on the series → the metric is translated ("Fehler", not raw "failures").
  const box = await w.locator(".recharts-surface").boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  }
  await expect(w.locator(".recharts-tooltip-wrapper")).toContainText("Fehler", { timeout: 5_000 });

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("error-rate: empty state when there are no tool calls", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stubErrors(page, EMPTY);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = erOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Tool-Aufrufe.")).toBeVisible();
  await expect(w.locator(".recharts-area")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("error-rate", "error-rate");

// ── incidents (the "what went wrong" failure list) ───────────────────────────
const inOf = (page: Page) => page.locator("#mc-widget-incidents");

test("incidents: failure list, click expands to a drill-down, search filters", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stubErrors(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = inOf(page);
  await w.scrollIntoViewIfNeeded();

  // Three failures listed with their error text.
  await expect(w.locator("li")).toHaveCount(3);
  await expect(w.getByText("exit code 1: build failed")).toBeVisible();

  // Click the first row → it expands (aria-expanded) and the tool-call inspector
  // drill-down loads (its input JSON shows the stubbed "cwd" key — unique to the
  // expanded detail; "Eingabe" would also match the panel's info hint text).
  const firstRow = w.locator("li button").first();
  await firstRow.click();
  await expect(firstRow).toHaveAttribute("aria-expanded", "true");
  await expect(w.getByText("cwd")).toBeVisible({ timeout: 5_000 });

  // Collapse again.
  await firstRow.click();
  await expect(firstRow).toHaveAttribute("aria-expanded", "false");

  // Global search filters the list down to the matching incident.
  await page.locator('input[type="search"]').fill("WebFetch");
  await expect(w.locator("li")).toHaveCount(1);
  await expect(w.getByText("timeout after 30s")).toBeVisible();

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("incidents: empty state when there are no failures", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stubErrors(page, EMPTY);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = inOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Keine Fehler – alles grün. 🎉")).toBeVisible();
  await expect(w.locator("li")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("incidents", "incidents");
