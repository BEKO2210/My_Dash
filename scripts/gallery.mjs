// Z-Shots — automated screenshot/GIF gallery for the README and the Features page.
//
// Serves the static demo export (out/) under its basePath, drives it in Chromium
// over the seeded in-browser demo engine (deterministic), and captures:
//   • every registry widget, dark + light  → public/shots/widgets/<id>-<mode>.png
//   • the full dashboard hero, dark + light → public/shots/dashboard-<mode>.png
//   • a short live GIF of the dashboard      → public/shots/dashboard-live.gif
//
// Prereqs: `out/` must exist (build the demo first), Chromium installed, and an
// ffmpeg binary for the GIF. In CI, PLAYWRIGHT_BROWSERS_PATH/FFMPEG_PATH are set.
// Run: node scripts/gallery.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(process.env.GALLERY_OUT_DIR || "out");
const BASE = process.env.GALLERY_BASE_PATH ?? "/My_Dash";
const PORT = Number(process.env.GALLERY_PORT || 5090);
const SHOTS = path.resolve("public/shots");
const FFMPEG =
  process.env.FFMPEG_PATH ||
  (fs.existsSync("/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux") ? "/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux" : "ffmpeg");

const WIDGETS = [
  "kpi-bar", "kanban", "live-stream", "token-chart", "tool-graph", "budget-gauge", "heatmap",
  "tool-frequency", "file-hotspots", "session-timeline", "latency", "error-rate", "model-donut",
  "sankey-flow", "project-leaderboard", "live-now", "prompt-history", "streak", "subagent-tree",
  "mcp-servers", "compaction-timeline", "tag-cloud", "token-burn", "calendar-heatmap", "velocity",
  "session-duration", "reliability", "incidents", "anomaly", "git-correlation",
];

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2",
  ".txt": "text/plain", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};

function serve() {
  return http
    .createServer((req, res) => {
      let url = req.url.split("?")[0];
      if (BASE && url.startsWith(BASE)) url = url.slice(BASE.length);
      let fp = path.join(ROOT, decodeURIComponent(url));
      try {
        if (fp.endsWith("/") || fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html");
      } catch {
        /* fall through */
      }
      try {
        if (!fs.existsSync(fp) && fs.existsSync(fp + ".html")) fp += ".html";
        const buf = fs.readFileSync(fp);
        res.writeHead(200, { "content-type": TYPES[path.extname(fp)] || "application/octet-stream" });
        res.end(buf);
      } catch {
        res.writeHead(404);
        res.end("404");
      }
    })
    .listen(PORT);
}

const prime = (mode) => `(()=>{try{localStorage.setItem("mc-onboarded","1");localStorage.setItem("mc-theme",JSON.stringify({mode:"${mode}",accent:"#4f8cff"}));localStorage.setItem("mc-lang","en");}catch{}})()`;

async function gotoDashboard(page) {
  await page.goto(`http://localhost:${PORT}${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Claude Mission Control" }).first().waitFor({ timeout: 30000 });
  await page.locator('[data-testid="connection-status"]').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(4500); // let the live engine populate every widget
}

async function captureWidgets(browser, mode) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  await page.addInitScript(prime(mode));
  await gotoDashboard(page);
  const dir = path.join(SHOTS, "widgets");
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const id of WIDGETS) {
    const el = page.locator(`#mc-widget-${id}`).first();
    if ((await el.count()) === 0) {
      console.log(`  skip ${id} (not present)`);
      continue;
    }
    try {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await el.screenshot({ path: path.join(dir, `${id}-${mode}.png`) });
      n++;
    } catch (e) {
      console.log(`  warn ${id}: ${e.message.split("\n")[0]}`);
    }
  }
  // Full dashboard hero (skip the landing hero — capture the grid area).
  await page.locator("#mc-widget-kpi-bar").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `dashboard-${mode}.png`) });
  console.log(`${mode}: captured ${n}/${WIDGETS.length} widgets + dashboard hero`);
  await ctx.close();
}

async function captureGif(browser) {
  const tmp = path.resolve(".gallery-video");
  fs.mkdirSync(tmp, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: tmp, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();
  await page.addInitScript(prime("dark"));
  await gotoDashboard(page);
  await page.locator("#mc-widget-live-stream").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(8000); // record ~8s of live updates
  await ctx.close(); // flush the video
  const webm = fs.readdirSync(tmp).find((f) => f.endsWith(".webm"));
  if (!webm) return console.log("gif: no video recorded");
  const out = path.join(SHOTS, "dashboard-live.gif");
  // Palette filtergraph uses split → must be -filter_complex (not -vf).
  const fc =
    "fps=10,scale=860:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3";
  const r = spawnSync(FFMPEG, ["-y", "-i", path.join(tmp, webm), "-filter_complex", fc, "-loop", "0", out], {
    encoding: "utf8",
  });
  if (r.status === 0) console.log(`gif: wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
  else console.log("gif: ffmpeg failed:\n" + (r.stderr || "").split("\n").slice(-4).join("\n"));
  fs.rmSync(tmp, { recursive: true, force: true });
}

(async () => {
  if (!fs.existsSync(path.join(ROOT, "index.html"))) {
    console.error(`No export at ${ROOT}. Build the demo first (MC_DEMO=1 … npm run build).`);
    process.exit(1);
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = serve();
  const browser = await chromium.launch();
  try {
    if (process.env.GALLERY_GIF_ONLY !== "1") {
      await captureWidgets(browser, "dark");
      await captureWidgets(browser, "light");
    }
    await captureGif(browser);
  } finally {
    await browser.close();
    server.close();
  }
  console.log("gallery: done →", SHOTS);
})();
