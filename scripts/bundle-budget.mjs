#!/usr/bin/env node
// Bundle budget gate: sums the client JS chunks emitted by `next build` and fails if
// they exceed a budget, so a stray heavy import can't silently bloat the dashboard.
//
//   npm run build && npm run bundle:budget
//   MC_BUNDLE_BUDGET_KB=3500 npm run bundle:budget   # override the budget
//
// Measures raw bytes of .next/static/chunks/**/*.js (a stable proxy for client weight).

import { readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const BUDGET_KB = Number(process.env.MC_BUNDLE_BUDGET_KB) > 0 ? Number(process.env.MC_BUNDLE_BUDGET_KB) : 3300;
const chunksDir = path.join(process.cwd(), ".next", "static", "chunks");

if (!existsSync(chunksDir)) {
  console.error(`No build output at ${chunksDir}. Run \`npm run build\` first.`);
  process.exit(1);
}

/** @type {{ file: string, bytes: number }[]} */
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) files.push({ file: path.relative(chunksDir, full), bytes: statSync(full).size });
  }
}
walk(chunksDir);

const totalKb = files.reduce((s, f) => s + f.bytes, 0) / 1024;
const top = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 5);

console.log(`Client JS chunks: ${files.length} files, ${totalKb.toFixed(0)} KB total (budget ${BUDGET_KB} KB).`);
console.log("Largest:");
for (const f of top) console.log(`  ${(f.bytes / 1024).toFixed(0).padStart(5)} KB  ${f.file}`);

if (totalKb > BUDGET_KB) {
  console.error(`\n✗ Over budget by ${(totalKb - BUDGET_KB).toFixed(0)} KB. Trim imports or raise MC_BUNDLE_BUDGET_KB.`);
  process.exit(1);
}
console.log(`\n✓ Within budget (${(BUDGET_KB - totalKb).toFixed(0)} KB to spare).`);
