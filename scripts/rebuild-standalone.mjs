#!/usr/bin/env node
// Make the better-sqlite3 binary inside the Next standalone bundle match Electron's
// ABI, so the packaged desktop app (which runs the server via Electron's bundled
// Node) can load it. Run AFTER `next build` and BEFORE packaging.
//
// electron-rebuild can't operate on the standalone tree directly (Next strips the
// dependency graph it walks), so we rebuild the project's own better-sqlite3
// against Electron, copy that binary into the standalone bundle, then restore the
// project copy for the system Node so dev / build / tests keep working.

import { rebuild } from "@electron/rebuild";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronVersion = require("electron/package.json").version;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = path.join("node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
const projectBin = path.join(root, rel);
const standaloneBin = path.join(root, ".next", "standalone", rel);

// 1) Build better-sqlite3 against Electron's ABI in the project tree.
await rebuild({ buildPath: root, electronVersion, onlyModules: ["better-sqlite3"], force: true });

// 2) Copy the Electron-ABI binary into the standalone bundle.
copyFileSync(projectBin, standaloneBin);
console.log(`Copied Electron-ABI better-sqlite3 into standalone (Electron ${electronVersion})`);

// 3) Restore the project copy for the system Node so local dev/build/tests keep
//    working. Skipped in CI (the job ends after packaging) and never allowed to
//    fail the build — the standalone copy is already correct at this point.
//    `shell: true` is required so `npm` resolves to npm.cmd on Windows (Node
//    refuses to spawn .cmd directly without a shell).
if (!process.env.CI) {
  try {
    execFileSync("npm", ["rebuild", "better-sqlite3"], { cwd: root, stdio: "inherit", shell: true });
    console.log("Restored project better-sqlite3 for the system Node");
  } catch (err) {
    console.warn("Could not restore project better-sqlite3 for Node:", err?.message ?? err);
    console.warn("Run `npm rebuild better-sqlite3` before using the dev server again.");
  }
}
