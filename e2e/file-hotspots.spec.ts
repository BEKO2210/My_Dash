import { test, expect, type Page } from "@playwright/test";

// The file-hotspots treemap reads /api/files?days=N. We stub it per page (varying
// by the days param) so tiles, the colour ramp, tooltips, the click-to-search and
// the range toggle are deterministic — and the screenshots reproducible. The SQL
// rollup is unit-tested in src/lib/files.test.ts.
type FileHotspot = { path: string; name: string; edits: number; added: number; removed: number; churn: number };
const f = (path: string, edits: number, added: number, removed: number): FileHotspot => ({
  path,
  name: path.split("/").pop() ?? path,
  edits,
  added,
  removed,
  churn: added + removed,
});

const D30: FileHotspot[] = [
  f("src/components/dashboard.tsx", 40, 1200, 300),
  f("src/lib/ingest.ts", 25, 600, 150),
  f("src/plugins/tool-graph/widget.tsx", 18, 420, 90),
  f("src/lib/db.ts", 12, 300, 60),
  f("README.md", 9, 200, 40),
  f("package.json", 5, 30, 10),
];
const D7: FileHotspot[] = [f("src/auth/session.ts", 20, 800, 100), f("src/lib/db.ts", 8, 200, 40)];
const D0: FileHotspot[] = [f("src/components/dashboard.tsx", 90, 3000, 800), f("src/lib/ingest.ts", 50, 1400, 300)];

async function stubFiles(page: Page) {
  await page.route("**/api/files*", (route) => {
    const days = new URL(route.request().url()).searchParams.get("days");
    const files = days === "7" ? D7 : days === "30" ? D30 : D0;
    route.fulfill({ json: { files } });
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

const widgetOf = (page: Page) => page.locator("#mc-widget-file-hotspots");
const surfaceOf = (page: Page) => widgetOf(page).locator("svg.recharts-surface");

test("treemap: tiles, opaque colour ramp, tooltip, click-to-search", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubFiles(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(surfaceOf(page)).toBeVisible();

  // Tiles render with labels (the largest is wide enough to show its full name).
  await expect(w.getByText("dashboard.tsx")).toBeVisible();

  // Colours: tile fills must be opaque rgb(...) — a semi-transparent fill would go
  // pale and unreadable on the light theme (regression guard for the contrast fix).
  const fills = await surfaceOf(page).locator("rect").evaluateAll((els) => els.map((e) => e.getAttribute("fill") ?? ""));
  expect(fills.length).toBeGreaterThan(1);
  expect(fills.every((c) => /^rgb\(/.test(c))).toBe(true);
  expect(fills.some((c) => /rgba\(/.test(c))).toBe(false);

  // Tooltip on hover: full path + edits/added/removed.
  const box = await surfaceOf(page).boundingBox();
  expect(box).not.toBeNull();
  if (box) await page.mouse.move(box.x + 90, box.y + 70);
  await expect(w.locator("div.font-mono")).toContainText("/", { timeout: 5_000 });
  await expect(w.getByText(/×\s*Bearbeitungen/)).toBeVisible();

  // Click a tile → the global search is set to that file's name.
  if (box) await page.mouse.click(box.x + 90, box.y + 70);
  const search = page.locator('input[type="search"]');
  await expect(search).toHaveValue(/.+\.(tsx|ts|md|json)$/);
  expect(D30.map((d) => d.name)).toContain(await search.inputValue());

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("range toggle refetches the treemap, with aria-pressed", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubFiles(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  const btn30 = w.getByRole("button", { name: "30T" });
  const btn7 = w.getByRole("button", { name: "7T" });

  await expect(btn30).toHaveAttribute("aria-pressed", "true");
  await expect(w.getByText("dashboard.tsx")).toBeVisible();

  // 7 days → a different file set; the 7d-only file appears, the 30d top is gone.
  await btn7.click();
  await expect(btn7).toHaveAttribute("aria-pressed", "true");
  await expect(btn30).toHaveAttribute("aria-pressed", "false");
  await expect(w.getByText("session.ts")).toBeVisible();
  await expect(w.getByText("dashboard.tsx")).toHaveCount(0);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("empty state when no file changes", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await page.route("**/api/files*", (route) => route.fulfill({ json: { files: [] } }));
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  await expect(w.getByText("Noch keine Datei-Änderungen.")).toBeVisible();
  await expect(surfaceOf(page)).toHaveCount(0);

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
      test(`file-hotspots visual — ${label}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);

        await stubFiles(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prime(page, mode, lang);
        await gotoDashboard(page);
        const w = widgetOf(page);
        await w.scrollIntoViewIfNeeded();
        await expect(surfaceOf(page)).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(500);

        const shot = await w.screenshot({ path: `test-results/file-hotspots-shots/${label}.png` });
        await testInfo.attach(label, { body: shot, contentType: "image/png" });

        expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
      });
    }
  }
}
