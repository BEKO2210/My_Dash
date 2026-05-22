#!/usr/bin/env node
// Safely wires Claude Code's lifecycle hooks into ~/.claude/settings.json so every
// action is forwarded to the dashboard. Idempotent + non-destructive:
//   - backs up the existing settings.json first
//   - merges (does NOT overwrite) — your other hooks / MCP config stay intact
//   - re-running updates our entries cleanly (matched by the claude-hook.sh marker)
//
//   npm run install-hooks
//   (honours MC_PORT and MC_HOOK_TOKEN from the environment at install time)

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hookScript = path.join(root, "scripts", "claude-hook.sh");
const MARKER = "claude-hook.sh";

const claudeDir = process.env.CLAUDE_DIR || path.join(os.homedir(), ".claude");
const settingsPath = path.join(claudeDir, "settings.json");

const port = process.env.MC_PORT || "3000";
const token = process.env.MC_HOOK_TOKEN || "";

// Events that support a tool matcher vs. those that don't.
const MATCHER_EVENTS = ["PreToolUse", "PostToolUse"];
const PLAIN_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "Notification",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "SessionEnd",
];

function commandFor(event) {
  const env = `MC_PORT=${port} ` + (token ? `MC_HOOK_TOKEN=${token} ` : "");
  return `${env}bash ${JSON.stringify(hookScript)} ${event}`;
}

function entryFor(event, withMatcher) {
  const hooks = [{ type: "command", command: commandFor(event) }];
  return withMatcher ? { matcher: "*", hooks } : { hooks };
}

// Drop any prior entries that reference our forwarder (so re-runs stay clean),
// keep everything else the user configured.
function withoutOurs(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (e) => !(e?.hooks ?? []).some((h) => typeof h?.command === "string" && h.command.includes(MARKER)),
  );
}

function main() {
  mkdirSync(claudeDir, { recursive: true });

  let settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    } catch {
      console.error(`Could not parse ${settingsPath} — aborting to avoid clobbering it.`);
      process.exit(1);
    }
    const backup = settingsPath + ".bak";
    copyFileSync(settingsPath, backup);
    console.log(`Backed up existing settings to ${backup}`);
  }

  settings.hooks = settings.hooks || {};

  for (const event of MATCHER_EVENTS) {
    settings.hooks[event] = [...withoutOurs(settings.hooks[event]), entryFor(event, true)];
  }
  for (const event of PLAIN_EVENTS) {
    settings.hooks[event] = [...withoutOurs(settings.hooks[event]), entryFor(event, false)];
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(`Wired ${MATCHER_EVENTS.length + PLAIN_EVENTS.length} hooks into ${settingsPath}`);
  console.log(`Forwarding to http://127.0.0.1:${port}/api/ingest`);
  console.log("Restart any running Claude Code sessions to pick up the new hooks.");
}

main();
