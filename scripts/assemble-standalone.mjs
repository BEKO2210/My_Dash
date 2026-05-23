#!/usr/bin/env node
// After `next build` (output: "standalone"), Next emits .next/standalone/server.js
// with a minimal node_modules, but NOT the static assets. Copy .next/static into
// the standalone tree so the packaged Electron server can serve them.
//
//   node scripts/assemble-standalone.mjs

import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standalone, ".next", "static");

if (!existsSync(standalone)) {
  console.error("Missing .next/standalone — run `next build` with output:'standalone' first.");
  process.exit(1);
}

mkdirSync(path.dirname(staticDest), { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true });
console.log(`Copied static assets → ${path.relative(root, staticDest)}`);

// public/ is optional; copy it if present (currently the repo has none).
const publicSrc = path.join(root, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, path.join(standalone, "public"), { recursive: true });
  console.log("Copied public/ into standalone");
}
