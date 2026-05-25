// Shared, cross-platform Claude Code hook wiring. Used by the CLI
// (scripts/install-hooks.mjs) and by the Electron app's onboarding action.
//
// The forwarder is a single `curl` invocation (curl ships on Windows 10+, macOS
// and Linux) — no bash, no shell-specific `VAR=… cmd` prefix — so the exact same
// settings.json entry works on every OS. The hook's JSON payload is read from
// stdin via `--data-binary @-`; it's fire-and-forget (short timeout) so a stopped
// dashboard never blocks Claude Code.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

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

// Substrings that identify a hook entry as ours, so re-runs replace cleanly.
// Includes the legacy bash forwarder so upgrades drop the old, non-portable entry.
const MARKERS = ["/api/ingest", "claude-hook.sh"];

/** Build the cross-platform forwarder command for one event. */
export function hookCommand(event, { port = "3000", token = "", platform = process.platform } = {}) {
  const curl = platform === "win32" ? "curl.exe" : "curl";
  const parts = [
    curl,
    "-s",
    "--max-time",
    "1",
    "-X",
    "POST",
    `http://127.0.0.1:${port}/api/ingest`,
    "-H",
    `"Content-Type: application/json"`,
    "-H",
    `"X-Hook-Event: ${event}"`,
  ];
  if (token) parts.push("-H", `"X-Hook-Token: ${token}"`);
  parts.push("--data-binary", "@-");
  return parts.join(" ");
}

function entryFor(event, withMatcher, opts) {
  const hooks = [{ type: "command", command: hookCommand(event, opts) }];
  return withMatcher ? { matcher: "*", hooks } : { hooks };
}

function withoutOurs(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (e) =>
      !(e?.hooks ?? []).some(
        (h) => typeof h?.command === "string" && MARKERS.some((m) => h.command.includes(m)),
      ),
  );
}

/**
 * Merge our hooks into the user's ~/.claude/settings.json. Non-destructive:
 * backs up first, keeps every other hook/MCP entry, and replaces only our own.
 * @returns {{ settingsPath: string, count: number, backup: string|null }}
 */
export function wireHooks({ port = "3000", token = "", claudeDir } = {}) {
  const dir = claudeDir || path.join(os.homedir(), ".claude");
  const settingsPath = path.join(dir, "settings.json");
  const opts = { port: String(port), token: token || "" };

  mkdirSync(dir, { recursive: true });

  let settings = {};
  let backup = null;
  // Read directly and handle "missing" via ENOENT instead of an existsSync
  // check, so there's no check-then-use race on the settings file.
  let existing = null;
  try {
    existing = readFileSync(settingsPath);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  if (existing != null) {
    try {
      settings = JSON.parse(existing.toString("utf8"));
    } catch {
      throw new Error(`Could not parse ${settingsPath} — aborting to avoid clobbering it.`);
    }
    backup = settingsPath + ".bak";
    writeFileSync(backup, existing);
  }

  settings.hooks = settings.hooks || {};
  for (const event of MATCHER_EVENTS) {
    settings.hooks[event] = [...withoutOurs(settings.hooks[event]), entryFor(event, true, opts)];
  }
  for (const event of PLAIN_EVENTS) {
    settings.hooks[event] = [...withoutOurs(settings.hooks[event]), entryFor(event, false, opts)];
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  return { settingsPath, count: MATCHER_EVENTS.length + PLAIN_EVENTS.length, backup };
}
