import { test, expect, type Page } from "@playwright/test";

// Run 117 — project-leaderboard (sortable per-project table), reliability
// (per-project success rate) and git-correlation (sessions grouped by branch/PR).
// Each reads its own API; all stubbed per page so the audit is deterministic and
// the screenshots reproducible. The aggregation maths is unit-tested in
// src/lib/{projects,reliability,git-correlation}.test.ts.
const PROJECTS = {
  projects: [
    { project: "alpha", sessions: 2, tools: 40, costUsd: 10, tokenInput: 0, tokenOutput: 0, tokenCache: 0, totalTokens: 500000 },
    { project: "beta", sessions: 9, tools: 20, costUsd: 5, tokenInput: 0, tokenOutput: 0, tokenCache: 0, totalTokens: 300000 },
    { project: "gamma", sessions: 5, tools: 60, costUsd: 8, tokenInput: 0, tokenOutput: 0, tokenCache: 0, totalTokens: 900000 },
  ],
};
const RELIABILITY = {
  projects: [
    { project: "alpha", total: 100, failures: 2, successRate: 0.98 }, // green
    { project: "beta", total: 80, failures: 10, successRate: 0.875 }, // amber
    { project: "gamma", total: 50, failures: 15, successRate: 0.7 }, // red
  ],
};
const BRANCHES = {
  branches: [
    {
      branch: "main",
      project: "my_dash",
      repo: "beko/my_dash",
      branchUrl: "https://example.com/beko/my_dash/tree/main",
      prUrl: "https://example.com/beko/my_dash/compare/main",
      sessionCount: 2,
      lastActivity: "2026-05-24 10:00:00",
      sessions: [
        { id: "s1", title: "Build dashboard", lastSeen: "2026-05-24 10:00:00" },
        { id: "s2", title: "Fix ingest", lastSeen: "2026-05-24 09:00:00" },
      ],
    },
    {
      branch: "feature/x",
      project: "my_dash",
      repo: "beko/my_dash",
      branchUrl: "https://example.com/beko/my_dash/tree/feature/x",
      prUrl: "https://example.com/beko/my_dash/compare/feature/x",
      sessionCount: 1,
      lastActivity: "2026-05-23 12:00:00",
      sessions: [{ id: "s3", title: "Feature work", lastSeen: "2026-05-23 12:00:00" }],
    },
  ],
};

async function stub(page: Page, projects: object = PROJECTS, reliability: object = RELIABILITY, branches: object = BRANCHES) {
  await page.route("**/api/usage/projects", (route) => route.fulfill({ json: projects }));
  await page.route("**/api/reliability*", (route) => route.fulfill({ json: reliability }));
  await page.route("**/api/git/branches", (route) => route.fulfill({ json: branches }));
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

// ── project-leaderboard ──────────────────────────────────────────────────────
const lbOf = (page: Page) => page.locator("#mc-widget-project-leaderboard");

test("leaderboard: medals, sortable columns re-order rows + aria-sort", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = lbOf(page);
  await w.scrollIntoViewIfNeeded();

  const firstProject = () => w.locator("tbody tr").first().locator("td").nth(1);
  await expect(w.locator("tbody tr")).toHaveCount(3);
  await expect(w.getByText("🥇")).toBeVisible();

  // Default sort is cost (desc) → alpha ($10) first; the cost header is aria-sorted.
  await expect(firstProject()).toHaveText("alpha");
  await expect(w.locator("th", { hasText: "Kosten" })).toHaveAttribute("aria-sort", "descending");

  // Click the Sessions column → re-sorts (beta has the most), aria-sort moves there.
  await w.getByRole("button", { name: "Sessions" }).click();
  await expect(firstProject()).toHaveText("beta");
  await expect(w.locator("th", { hasText: "Sessions" })).toHaveAttribute("aria-sort", "descending");
  await expect(w.locator("th", { hasText: "Kosten" })).toHaveAttribute("aria-sort", "none");

  // Click Tokens → gamma (900k) leads.
  await w.getByRole("button", { name: "Tokens" }).click();
  await expect(firstProject()).toHaveText("gamma");

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("leaderboard: empty state", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, { projects: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = lbOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Projekte.")).toBeVisible();
  await expect(w.locator("tbody tr")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("project-leaderboard", "project-leaderboard");

// ── reliability ──────────────────────────────────────────────────────────────
const relOf = (page: Page) => page.locator("#mc-widget-reliability");

test("reliability: per-project rates with severity colours + search filter", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = relOf(page);
  await w.scrollIntoViewIfNeeded();

  await expect(w.locator("li")).toHaveCount(3);
  // Severity colours: ≥95% green, ≥85% amber, else red.
  await expect(w.locator("li", { hasText: "alpha" }).locator("div.h-full")).toHaveClass(/bg-emerald-400/);
  await expect(w.locator("li", { hasText: "beta" }).locator("div.h-full")).toHaveClass(/bg-amber-400/);
  await expect(w.locator("li", { hasText: "gamma" }).locator("div.h-full")).toHaveClass(/bg-red-400/);
  await expect(w.getByText("98%")).toBeVisible();

  // Global search filters the list.
  await page.locator('input[type="search"]').fill("gamma");
  await expect(w.locator("li")).toHaveCount(1);
  await expect(w.getByText("70%")).toBeVisible();

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("reliability: empty state", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, PROJECTS, { projects: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = relOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Tool-Aufrufe.")).toBeVisible();
  await expect(w.locator("li")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("reliability", "reliability");

// ── git-correlation ──────────────────────────────────────────────────────────
const gcOf = (page: Page) => page.locator("#mc-widget-git-correlation");

test("git-correlation: branch rows with branch/PR links + session drilldowns", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = gcOf(page);
  await w.scrollIntoViewIfNeeded();

  await expect(w.locator("li")).toHaveCount(2);

  // Branch link → its web URL.
  await expect(w.getByRole("link", { name: "main" })).toHaveAttribute("href", "https://example.com/beko/my_dash/tree/main");
  // "Open PR" link → the compare URL.
  const pr = w.locator("li", { hasText: "main" }).getByRole("link", { name: /PR öffnen/ });
  await expect(pr).toHaveAttribute("href", "https://example.com/beko/my_dash/compare/main");

  // Session chip → the session detail page.
  await expect(w.getByRole("link", { name: "Build dashboard" })).toHaveAttribute("href", "/session?id=s1");

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("git-correlation: empty state", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, PROJECTS, RELIABILITY, { branches: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = gcOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText(/Noch keine Branch-Daten/)).toBeVisible();
  await expect(w.locator("li")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("git-correlation", "git-correlation");
