#!/usr/bin/env node
// PreToolUse guard for My_Dash. When `.mc-protect` exists in the project root,
// this BLOCKS Claude from modifying protected appearance/config files — so an
// automated run can't accidentally break the system's look or build.
//
// Default (no .mc-protect) allows everything. Toggle from a terminal:
//   npm run protect      # turn protection on
//   npm run unprotect    # turn it off (asks for PIN)
//
// Registered as a PreToolUse hook in .claude/settings.json. Exit code 2 = block.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const lockFile = path.join(root, ".mc-protect");

// Fast path: protection off → allow everything.
if (!existsSync(lockFile)) process.exit(0);

// Protected appearance/config files (relative to project root). Includes the lock
// file itself so it can't be removed through a blocked tool.
const PROTECTED = [
  "src/app/globals.css",
  "src/app/layout.tsx",
  "next.config.ts",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "tsconfig.json",
  "package.json",
  ".mc-protect",
];
const protectedAbs = new Set(PROTECTED.map((p) => path.resolve(root, p)));

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0); // unparseable → don't block
}

const tool = payload.tool_name;
const input = payload.tool_input || {};

function deny(rel) {
  console.error(
    `🔒 Schutz aktiv: "${rel}" darf nicht geändert werden.\n` +
      `   Zum Ändern in einem Terminal:  npm run unprotect   (PIN)\n` +
      `   (Schutz wurde mit  npm run protect  gesetzt.)`,
  );
  process.exit(2); // block the tool call
}

// Direct file tools — exact path check.
if (tool === "Edit" || tool === "Write" || tool === "NotebookEdit") {
  const f = input.file_path || input.notebook_path;
  if (typeof f === "string" && protectedAbs.has(path.resolve(root, f))) {
    deny(path.relative(root, path.resolve(root, f)));
  }
  process.exit(0);
}

// Bash — block only write-ish commands that name a protected file (reads are fine).
if (tool === "Bash" && typeof input.command === "string") {
  const cmd = input.command;
  const writeish = /(>|\bsed\s+-i|\brm\b|\bmv\b|\bcp\b|\btee\b|\btruncate\b|\bdd\b|\bchmod\b|\bchown\b|\bln\b)/i.test(cmd);
  if (writeish) {
    for (const rel of PROTECTED) {
      if (cmd.includes(rel) || cmd.includes(path.basename(rel))) deny(rel);
    }
  }
}

process.exit(0);
