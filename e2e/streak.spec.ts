import { test, expect, type Page } from "@playwright/test";

// Run 118a — streak (day-streak, peak hours, sessions-per-day) + subagent-tree
// (Task subagents grouped by parent session). streak reads /api/streak,
// subagent-tree /api/subagents; both stubbed per page so the stat tiles, bars,
// expand/collapse and search are deterministic and the screenshots reproducible.
// The maths is unit-tested in src/lib/{streak,subagents}.test.ts.
function dbTime(minAgo: number): string {
  const d = new Date(Date.now() - minAgo * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

const STREAK = {
  streak: { current: 4, longest: 9, activeDays: 18, totalSessions: 72 },
  days: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-05-${String(i + 1).padStart(2, "0")}`,
    count: i > 25 ? 6 : Math.round(Math.abs(Math.sin(i / 3)) * 5),
  })),
  hours: Array.from({ length: 24 }, (_, h) => (h >= 9 && h <= 18 ? Math.round(Math.abs(Math.cos((h - 13) / 4)) * 10) : 1)),
  peakHour: 14,
};
const SUBAGENTS = {
  groups: [
    {
      session_id: "s1", project: "my_dash", title: "Build dashboard", count: 3, last_at: dbTime(10),
      tasks: [
        { id: 1, label: "Explore codebase", child_session_id: "c1", tool_call_id: 1, created_at: dbTime(30) },
        { id: 2, label: "Write tests", child_session_id: "c2", tool_call_id: 2, created_at: dbTime(20) },
        { id: 3, label: null, child_session_id: null, tool_call_id: 3, created_at: dbTime(15) },
      ],
    },
    {
      session_id: "s2", project: "shopify-bot", title: "Analyze orders", count: 1, last_at: dbTime(60),
      tasks: [{ id: 4, label: "Fetch order data", child_session_id: "c3", tool_call_id: 4, created_at: dbTime(60) }],
    },
  ],
};

async function stub(page: Page, streak: object = STREAK, subagents: object = SUBAGENTS) {
  await page.route("**/api/streak*", (route) => route.fulfill({ json: streak }));
  await page.route("**/api/subagents*", (route) => route.fulfill({ json: subagents }));
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

// ── streak ───────────────────────────────────────────────────────────────────
const skOf = (page: Page) => page.locator("#mc-widget-streak");

test("streak: stat tiles, per-day + peak-hour bars with the right bars highlighted", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = skOf(page);
  await w.scrollIntoViewIfNeeded();

  // Stat tiles: current streak (🔥), longest, active days, peak hour.
  await expect(w.locator(".grid p.font-mono")).toHaveText(["🔥 4", "9", "18", "14:00"]);

  // Two bar rows: 30 day bars + 24 hour bars, each with a hover title.
  const perDay = w.locator(".flex.h-12.items-end").nth(0);
  const hours = w.locator(".flex.h-12.items-end").nth(1);
  await expect(perDay.locator("div[title]")).toHaveCount(30);
  await expect(hours.locator("div[title]")).toHaveCount(24);

  // Highlight: today's bar (last) is accent, an earlier one is not; the peak hour
  // (14:00) bar is accent.
  const isHot = (loc: ReturnType<typeof perDay.locator>) => loc.evaluate((e) => e.classList.contains("bg-accent"));
  expect(await isHot(perDay.locator("div[title]").last())).toBe(true);
  expect(await isHot(perDay.locator("div[title]").first())).toBe(false);
  expect(await isHot(hours.locator("div[title]").nth(14))).toBe(true);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("streak: empty state when there is no activity", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, { streak: { current: 0, longest: 0, activeDays: 0, totalSessions: 0 }, days: [], hours: [], peakHour: -1 });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = skOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Aktivität.")).toBeVisible();
  await expect(w.locator(".flex.h-12.items-end")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("streak", "streak");

// ── subagent-tree ────────────────────────────────────────────────────────────
const saOf = (page: Page) => page.locator("#mc-widget-subagent-tree");

test("subagent-tree: groups expand/collapse each node + search filter", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = saOf(page);
  await w.scrollIntoViewIfNeeded();

  // Two parent groups, each a node with an aria-expanded toggle and a count badge.
  const nodes = w.locator("button[aria-expanded]");
  await expect(nodes).toHaveCount(2);
  await expect(w.getByText("Build dashboard")).toBeVisible();
  await expect(w.getByText("Explore codebase")).toBeVisible(); // a child task (expanded by default)

  // Collapse the first node → its tasks hide; expand again → they return.
  const first = nodes.first();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(w.getByText("Explore codebase")).toBeHidden();
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(w.getByText("Explore codebase")).toBeVisible();

  // Global search filters the groups.
  await page.locator('input[type="search"]').fill("Analyze");
  await expect(w.locator("button[aria-expanded]")).toHaveCount(1);
  await expect(w.getByText("Analyze orders")).toBeVisible();
  await expect(w.getByText("Build dashboard")).toHaveCount(0);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("subagent-tree: empty state when there are no subagents", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, STREAK, { groups: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = saOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Subagenten.")).toBeVisible();
  await expect(w.locator("button[aria-expanded]")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("subagent-tree", "subagent-tree");
