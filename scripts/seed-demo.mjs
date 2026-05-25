#!/usr/bin/env node
// Posts a realistic sequence of synthetic hook events so the whole dashboard can be
// seen and tested without waiting for real Claude Code activity.
//
//   npm run seed

import { randomBytes } from "node:crypto";

const PORT = process.env.MC_PORT || 3000;
const TOKEN = process.env.MC_HOOK_TOKEN || "";
const BASE = `http://127.0.0.1:${PORT}/api/ingest`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(event, payload) {
  const headers = { "Content-Type": "application/json", "X-Hook-Event": event };
  if (TOKEN) headers["X-Hook-Token"] = TOKEN;
  const res = await fetch(BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...payload, hook_event_name: event }),
  });
  if (!res.ok) throw new Error(`${event} -> HTTP ${res.status}`);
}

function id() {
  return "demo-" + randomBytes(6).toString("hex");
}

async function runSession({ cwd, prompt, tools, end }) {
  const session_id = id();
  const base = { session_id, cwd };
  await post("SessionStart", { ...base, source: "startup" });
  await sleep(120);
  await post("UserPromptSubmit", { ...base, prompt });
  await sleep(120);
  for (const [tool, input] of tools) {
    await post("PreToolUse", { ...base, tool_name: tool, tool_input: input });
    await sleep(150);
    await post("PostToolUse", { ...base, tool_name: tool, tool_input: input, tool_response: { ok: true } });
    await sleep(120);
  }
  await post("Stop", { ...base, stop_hook_active: true });
  if (end) {
    await sleep(150);
    await post("SessionEnd", { ...base, reason: "clear" });
  }
}

async function main() {
  try {
    await fetch(`http://127.0.0.1:${PORT}/`, { method: "HEAD" }).catch(() => {});
    console.log(`Seeding demo events to ${BASE} ...`);

    await runSession({
      cwd: "/home/user/My_Dash",
      prompt: "Baue das Mission-Control-Dashboard und verkabele die Hooks.",
      tools: [
        ["Read", { file_path: "/home/user/My_Dash/src/lib/ingest.ts" }],
        ["Bash", { command: "npm run build" }],
        ["Edit", { file_path: "/home/user/My_Dash/src/app/page.tsx" }],
        ["Write", { file_path: "/home/user/My_Dash/scripts/seed-demo.mjs" }],
      ],
      end: false,
    });

    await runSession({
      cwd: "/home/user/projects/shopify-bot",
      prompt: "Analysiere die letzten Bestellungen und finde Ausreißer.",
      tools: [
        ["Grep", { pattern: "createOrder" }],
        ["Read", { file_path: "/home/user/projects/shopify-bot/src/orders.ts" }],
        ["WebFetch", { url: "https://shopify.dev/docs/api" }],
      ],
      end: true,
    });

    await post("Notification", {
      session_id: id(),
      cwd: "/home/user/My_Dash",
      message: "Claude benötigt deine Erlaubnis für einen Bash-Befehl",
    });

    console.log("Done. Open the dashboard to see the events.");
  } catch (err) {
    console.error("Seed failed:", err.message);
    console.error("Is the dashboard running?  npm run dev  (then re-run npm run seed)");
    process.exit(1);
  }
}

main();
