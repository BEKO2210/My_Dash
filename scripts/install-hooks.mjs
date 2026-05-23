#!/usr/bin/env node
// Wires Claude Code's lifecycle hooks into ~/.claude/settings.json so every action
// is forwarded to the dashboard. Idempotent + non-destructive (backs up first,
// merges, replaces only our own entries). The actual logic lives in wire-hooks.mjs
// so the Electron app can reuse it.
//
//   npm run install-hooks
//   (honours MC_PORT, MC_HOOK_TOKEN and CLAUDE_DIR from the environment)

import { wireHooks } from "./wire-hooks.mjs";

const port = process.env.MC_PORT || "3000";

try {
  const { settingsPath, count, backup } = wireHooks({
    port,
    token: process.env.MC_HOOK_TOKEN || "",
    claudeDir: process.env.CLAUDE_DIR || undefined,
  });
  if (backup) console.log(`Backed up existing settings to ${backup}`);
  console.log(`Wired ${count} hooks into ${settingsPath}`);
  console.log(`Forwarding to http://127.0.0.1:${port}/api/ingest`);
  console.log("Restart any running Claude Code sessions to pick up the new hooks.");
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
