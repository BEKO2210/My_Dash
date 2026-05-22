#!/usr/bin/env node
// Visual QA: screenshots of the dashboard at a few sizes + fullscreen + EN,
// and a dump of any console/page errors. Local dev tool, not shipped.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.env.MC_URL || "http://127.0.0.1:3001/";
const OUT = "/tmp/qa";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});

const errors = [];
async function shoot(name, { width, height, steps } = {}) {
  const ctx = await browser.newContext({ viewport: { width: width || 1440, height: height || 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${name}] console.error: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  // SSE keeps a connection open → "networkidle" never fires; use domcontentloaded.
  await page.goto(URL, { waitUntil: "domcontentloaded" }).catch((e) => errors.push(`[${name}] goto: ${e.message}`));
  await page.waitForTimeout(5500); // let the 3D graph settle
  if (steps) await steps(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  await ctx.close();
  console.log(`✓ ${name}.png`);
}

await shoot("01-hd", { width: 1440, height: 900 });
await shoot("02-qhd", { width: 2560, height: 1440 });
await shoot("03-fullscreen", {
  width: 1600,
  height: 900,
  steps: async (page) => {
    const btn = page.locator('button[title="Vollbild"], button[title="Fullscreen"]').first();
    await btn.click({ timeout: 4000 }).catch((e) => errors.push(`[fullscreen] click: ${e.message}`));
    await page.waitForTimeout(2500);
  },
});
await shoot("04-en", {
  width: 1440,
  height: 900,
  steps: async (page) => {
    const en = page.locator('[aria-label="Language"] button', { hasText: "en" }).first();
    await en.click({ timeout: 4000 }).catch((e) => errors.push(`[en] click: ${e.message}`));
    await page.waitForTimeout(1200);
  },
});

await browser.close();

console.log("\n=== Console / page errors ===");
if (errors.length === 0) console.log("  (keine)");
else errors.forEach((e) => console.log("  ✗ " + e));
