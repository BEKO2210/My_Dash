import { test, expect, type Page } from "@playwright/test";

// The latency widget reads /api/tools/latency (histogram buckets + p50/p95/p99).
// We stub it per page (varying by the ?tool= filter) so the buckets, percentile
// stats, bars, tooltip and the tool filter are deterministic and the screenshots
// reproducible. The percentile/bucket maths is unit-tested in src/lib/latency.test.ts.
type LatencyResp = {
  stats: {
    count: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
    buckets: { label: string; count: number }[];
  };
  tools: string[];
};

const BUCKETS = [
  { label: "10ms", count: 40 },
  { label: "25ms", count: 120 },
  { label: "50ms", count: 260 },
  { label: "100ms", count: 340 }, // tallest (index 3)
  { label: "250ms", count: 210 },
  { label: "500ms", count: 130 },
  { label: "1s", count: 80 },
  { label: "2.5s", count: 34 },
  { label: "5s", count: 14 },
  { label: "10s", count: 5 },
  { label: "10s+", count: 1 },
];
const ALL: LatencyResp = {
  stats: { count: 500, p50: 85, p95: 1200, p99: 4800, max: 9500, buckets: BUCKETS },
  tools: ["Bash", "Edit", "Read"],
};
const BASH: LatencyResp = {
  stats: {
    count: 120,
    p50: 600,
    p95: 3000,
    p99: 8000,
    max: 9000,
    buckets: BUCKETS.map((b) => ({ ...b, count: Math.round(b.count / 3) })),
  },
  tools: ["Bash", "Edit", "Read"],
};

async function stubLatency(page: Page) {
  await page.route("**/api/tools/latency*", (route) => {
    const tool = new URL(route.request().url()).searchParams.get("tool");
    route.fulfill({ json: tool === "Bash" ? BASH : ALL });
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

const widgetOf = (page: Page) => page.locator("#mc-widget-latency");
const barsOf = (page: Page) => widgetOf(page).locator(".recharts-bar-rectangle");

test("percentiles, histogram buckets, each bar, tooltip", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubLatency(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  // Percentile stats with formatted values (p50, p95, p99, max, n), scoped to the
  // stats row so y-axis tick labels can't collide.
  for (const label of ["p50", "p95", "p99"]) await expect(w.getByText(label, { exact: true })).toBeVisible();
  const statVals = w.locator(".flex-wrap span.font-mono");
  await expect(statVals).toHaveText(["85ms", "1.2s", "4.8s", "9.5s", "500"]);

  // One bar per bucket; heights vary and the 100ms bucket (index 3) is tallest.
  await expect(barsOf(page)).toHaveCount(BUCKETS.length);
  // Wait out the recharts grow animation (bars start at height 0) before measuring.
  await expect
    .poll(async () => barsOf(page).evaluateAll((els) => Math.max(0, ...els.map((e) => e.getBoundingClientRect().height))))
    .toBeGreaterThan(1);
  const heights = await barsOf(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  const maxH = Math.max(...heights);
  expect(maxH).toBeGreaterThan(Math.min(...heights) + 1);
  expect(heights.indexOf(maxH)).toBe(3);

  // Tooltip: hover the tallest bar → bucket label + translated "Aufrufe" count.
  // .hover() auto-waits for the bar to be stable, avoiding a re-render race.
  await barsOf(page).nth(3).hover();
  await expect(w.locator(".recharts-tooltip-wrapper")).toContainText("Aufrufe", { timeout: 5_000 });

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("tool filter refetches the distribution", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await stubLatency(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  const nVal = w.locator(".flex-wrap span.font-mono").nth(4);
  await expect(nVal).toHaveText("500"); // all tools → n=500
  await w.locator("select").selectOption("Bash");
  await expect(nVal).toHaveText("120"); // Bash → n=120

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("empty state when there is no duration data", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);

  await page.route("**/api/tools/latency*", (route) =>
    route.fulfill({ json: { stats: { count: 0, p50: 0, p95: 0, p99: 0, max: 0, buckets: [] }, tools: [] } }),
  );
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = widgetOf(page);
  await w.scrollIntoViewIfNeeded();

  await expect(w.getByText("Noch keine Dauer-Daten.")).toBeVisible();
  await expect(barsOf(page)).toHaveCount(0);

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
      test(`latency visual — ${label}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);

        await stubLatency(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prime(page, mode, lang);
        await gotoDashboard(page);
        const w = widgetOf(page);
        await w.scrollIntoViewIfNeeded();
        await expect(barsOf(page).first()).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(1200); // let the recharts bar grow-animation finish

        const shot = await w.screenshot({ path: `test-results/latency-shots/${label}.png` });
        await testInfo.attach(label, { body: shot, contentType: "image/png" });

        expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
      });
    }
  }
}
