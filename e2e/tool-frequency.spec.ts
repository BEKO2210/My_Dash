import { test, expect, type Page } from "@playwright/test";

// The top-tools widget reads /api/tools?days=N. We stub it per page (varying the
// payload by the days param) so the bars, descending sort, MCP colouring, failure
// markers, hover titles and the range toggle are all deterministic — and the
// screenshots reproducible. The SQL ranking is unit-tested in src/lib/tools.test.ts.
type ToolStat = {
  tool: string;
  count: number;
  failures: number;
  source: string | null;
  mcpServer: string | null;
  avgDurationMs: number | null;
};
const builtin = (tool: string, count: number, failures = 0, avg = 30): ToolStat => ({
  tool,
  count,
  failures,
  source: "builtin",
  mcpServer: null,
  avgDurationMs: avg,
});

const D30: ToolStat[] = [
  builtin("Read", 120, 0, 42),
  builtin("Edit", 90, 0, 30),
  builtin("Bash", 75, 5, 820),
  { tool: "mcp__github__search_issues", count: 48, failures: 1, source: "mcp", mcpServer: "github", avgDurationMs: 210 },
  builtin("Grep", 33, 0, 18),
  builtin("Write", 21, 0, 25),
];
const D7: ToolStat[] = [builtin("Bash", 50, 2, 700), builtin("Read", 40, 0, 40), builtin("Edit", 30, 0, 28)];
const D0: ToolStat[] = [builtin("Read", 300, 0, 44), builtin("Edit", 210, 0, 31), builtin("Grep", 95, 0, 19)];

async function stubTools(page: Page) {
  await page.route("**/api/tools*", (route) => {
    const days = new URL(route.request().url()).searchParams.get("days");
    const tools = days === "7" ? D7 : days === "30" ? D30 : D0;
    route.fulfill({ json: { tools } });
  });
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

const widgetOf = (page: Page) => page.locator("#mc-widget-tool-frequency");
const fillsOf = (page: Page) => widgetOf(page).locator("li div.h-full");

test("bars: descending sort, proportional widths, hover, MCP colour, failures", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubTools(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  // One bar per tool, labels in the API's descending-count order.
  const labels = w.locator("li span.truncate");
  await expect(labels).toHaveText(["Read", "Edit", "Bash", "github / search_issues", "Grep", "Write"]);

  // The grow animation sets the top bar to 100%; widths are then non-increasing.
  await expect(fillsOf(page).first()).toHaveAttribute("style", /width:\s*100%/);
  const widths = await fillsOf(page).evaluateAll((els) => els.map((e) => parseFloat((e as HTMLElement).style.width)));
  expect(widths[0]).toBe(100);
  for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThanOrEqual(widths[i - 1]);

  // Hover: every bar carries an average-duration title.
  const titles = await w.locator("li").evaluateAll((els) => els.map((e) => e.getAttribute("title") ?? ""));
  expect(titles.every((t) => /\d+\s*ms/.test(t))).toBe(true);

  // MCP tools are violet, built-ins use the accent.
  const mcpFill = w.locator("li", { hasText: "github / search_issues" }).locator("div.h-full");
  await expect(mcpFill).toHaveClass(/bg-violet-500/);
  await expect(w.locator("li", { hasText: "Read" }).locator("div.h-full")).toHaveClass(/bg-accent/);

  // Failure marker on a tool with failures.
  await expect(w.getByText(/·?5✗/)).toBeVisible();

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("range toggle refetches and re-sorts, with aria-pressed", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubTools(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  const btn30 = w.getByRole("button", { name: "30T" });
  const btn7 = w.getByRole("button", { name: "7T" });
  const btnAll = w.getByRole("button", { name: "Alle" });

  // Default is 30 days → top tool "Read".
  await expect(btn30).toHaveAttribute("aria-pressed", "true");
  await expect(w.locator("li span.truncate").first()).toHaveText("Read");

  // 7 days → different ranking (top "Bash"), pressed state moves.
  await btn7.click();
  await expect(btn7).toHaveAttribute("aria-pressed", "true");
  await expect(btn30).toHaveAttribute("aria-pressed", "false");
  await expect(w.locator("li span.truncate").first()).toHaveText("Bash");
  await expect(w.locator("li")).toHaveCount(3);

  // All time → top "Read" again, three bars.
  await btnAll.click();
  await expect(btnAll).toHaveAttribute("aria-pressed", "true");
  await expect(w.locator("li span.truncate").first()).toHaveText("Read");

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("empty state when no tool calls", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await page.route("**/api/tools*", (route) => route.fulfill({ json: { tools: [] } }));
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  await expect(w.getByText("Noch keine Tool-Aufrufe.")).toBeVisible();
  await expect(w.locator("li")).toHaveCount(0);

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
      test(`tool-frequency visual — ${label}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);

        await stubTools(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prime(page, mode, lang);
        await gotoDashboard(page);
        const w = widgetOf(page);
        await w.scrollIntoViewIfNeeded();
        await expect(fillsOf(page).first()).toHaveAttribute("style", /width:\s*100%/, { timeout: 15_000 });
        await page.waitForTimeout(800); // let the width transition settle

        const shot = await w.screenshot({ path: `test-results/tool-frequency-shots/${label}.png` });
        await testInfo.attach(label, { body: shot, contentType: "image/png" });

        expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
      });
    }
  }
}
