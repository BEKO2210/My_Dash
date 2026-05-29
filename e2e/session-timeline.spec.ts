import { test, expect, type Page } from "@playwright/test";

type StubSession = Record<string, unknown>;

// The session timeline reads /api/sessions and lays out Gantt bars over a [now-Nd,
// now] window. We stub /api/sessions per page so the lanes, time window, status
// colours and the range/zoom toggle are deterministic and the screenshots
// reproducible. The pure layout (clamping, min-width, sort) is unit-tested in
// src/lib/timeline.test.ts.
function dbTime(msAgo: number): string {
  const d = new Date(Date.now() - msAgo);
  const p = (n: number) => String(n).padStart(2, "0");
  // parseDbTime treats "YYYY-MM-DD HH:MM:SS" as UTC, so emit UTC fields.
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
const MIN = 60_000;
function session(
  id: string,
  title: string,
  project: string,
  status: string,
  startMinAgo: number,
  durMin: number,
): StubSession {
  const endMinAgo = startMinAgo - durMin;
  return {
    id,
    project_path: `/p/${project}`,
    project_name: project,
    title,
    status,
    source: "startup",
    first_seen: dbTime(startMinAgo * MIN),
    last_seen: dbTime(endMinAgo * MIN),
    ended_at: status === "ended" ? dbTime(endMinAgo * MIN) : null,
    token_input: 0,
    token_output: 0,
    token_cache: 0,
    cost_usd: 0,
    branch: null,
    git_commit: null,
    remote_url: null,
    transcript_path: null,
    machine: null,
  };
}

// Five sessions inside the last 24h + one ~30h ago (only visible at 7d/30d).
const WITHIN_24H: StubSession[] = [
  session("s1", "Build dashboard", "my_dash", "ended", 1380, 200),
  session("s2", "Fix ingest bug", "my_dash", "ended", 600, 90),
  session("s3", "Analyze orders", "shopify-bot", "waiting", 180, 60),
  session("s4", "Refactor auth", "api-gateway", "active", 40, 40),
  session("s5", "Quick tweak", "docs-site", "ended", 300, 1), // 1-min → min-width bar
];
const OLDER = session("s6", "Old migration", "ml-pipeline", "ended", 1800, 60); // ~30h ago
const ALL = [...WITHIN_24H, OLDER];

const MANY: StubSession[] = Array.from({ length: 40 }, (_, i) =>
  session(`m${i}`, `Session ${i}`, "proj", i % 3 === 0 ? "active" : i % 3 === 1 ? "waiting" : "ended", 30 + i * 20, 15),
);

async function stubSessions(page: Page, sessions: StubSession[]) {
  await page.route("**/api/sessions", (route) => route.fulfill({ json: { sessions } }));
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

const widgetOf = (page: Page) => page.locator("#mc-widget-session-timeline");
const barsOf = (page: Page) => widgetOf(page).locator("ul > li div.absolute");
const ticksOf = (page: Page) => widgetOf(page).locator("div.relative > span.absolute");

test("lanes, status colours, in-window bars, ticks and tooltip", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubSessions(page, ALL);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  // One lane per in-window session (the ~30h-old one is outside the 24h window).
  await expect(w.locator("ul > li")).toHaveCount(5);
  await expect(w.getByText("Build dashboard")).toBeVisible();
  await expect(w.getByText("Old migration")).toHaveCount(0);

  // Time window: five axis ticks, each a HH:MM label at 24h.
  const ticks = await ticksOf(page).allInnerTexts();
  expect(ticks).toHaveLength(5);
  expect(ticks.every((tx) => /^\d{1,2}:\d{2}$/.test(tx.trim()))).toBe(true);

  // Status colours: active=emerald, waiting=amber, ended=zinc.
  await expect(w.locator("div.absolute.bg-emerald-400")).toHaveCount(1);
  await expect(w.locator("div.absolute.bg-amber-400")).toHaveCount(1);
  await expect(w.locator("div.absolute.bg-zinc-500")).toHaveCount(3);

  // Every bar stays within the track (clamped, never overflowing).
  const geo = await barsOf(page).evaluateAll((els) =>
    els.map((e) => ({ left: parseFloat((e as HTMLElement).style.left), width: parseFloat((e as HTMLElement).style.width) })),
  );
  expect(geo.length).toBe(5);
  for (const g of geo) {
    expect(g.left).toBeGreaterThanOrEqual(0);
    expect(g.left + g.width).toBeLessThanOrEqual(100.5);
    expect(g.width).toBeGreaterThan(0);
  }

  // Hover tooltip on a bar (title · duration · project).
  const titles = await barsOf(page).evaluateAll((els) => els.map((e) => e.getAttribute("title") ?? ""));
  expect(titles.some((tx) => /·/.test(tx))).toBe(true);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("range/zoom toggle changes the window and axis, with aria-pressed", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubSessions(page, ALL);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  const btn24 = w.getByRole("button", { name: "24 h" });
  const btn30 = w.getByRole("button", { name: "30T" });

  await expect(btn24).toHaveAttribute("aria-pressed", "true");
  await expect(w.getByText("Old migration")).toHaveCount(0);

  // Zoom out to 30 days: the older session enters the window, and the axis ticks
  // switch from HH:MM to DD.MM.
  await btn30.click();
  await expect(btn30).toHaveAttribute("aria-pressed", "true");
  await expect(btn24).toHaveAttribute("aria-pressed", "false");
  await expect(w.getByText("Old migration")).toBeVisible();
  await expect(w.locator("ul > li")).toHaveCount(6);

  const ticks = await ticksOf(page).allInnerTexts();
  // Axis switched from clock time to day.month (no colon, a dotted date).
  expect(ticks.every((tx) => /\d{1,2}\.\d{1,2}/.test(tx) && !tx.includes(":"))).toBe(true);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("scrolls vertically when there are many sessions", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubSessions(page, MANY);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  const list = w.locator("ul");
  await expect(list.locator("> li").first()).toBeVisible();
  const scrollable = await list.evaluate((el) => el.scrollHeight - el.clientHeight > 4);
  expect(scrollable).toBe(true);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("empty state when no sessions in range", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubSessions(page, []);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  await expect(w.getByText("Keine Sessions im Zeitraum.")).toBeVisible();
  await expect(w.locator("ul > li")).toHaveCount(0);

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
      test(`session-timeline visual — ${label}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);

        await stubSessions(page, ALL);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prime(page, mode, lang);
        await gotoDashboard(page);
        const w = widgetOf(page);
        await w.scrollIntoViewIfNeeded();
        await expect(barsOf(page).first()).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(400);

        const shot = await w.screenshot({ path: `test-results/session-timeline-shots/${label}.png` });
        await testInfo.attach(label, { body: shot, contentType: "image/png" });

        expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
      });
    }
  }
}
