#!/usr/bin/env node
// Backfills the dashboard with sessions that happened BEFORE it was installed, by
// reading Claude Code's transcripts at ~/.claude/projects/**/*.jsonl. Populates the
// same rich data the live ingest path captures (model, per-session tokens + cost,
// MCP classification, tool I/O, file edits, redacted prompts, activity rollup).
// Safe to re-run: sessions already in the DB are skipped.
//
//   npm run import-history    (honours CLAUDE_DIR and MC_DATA_DIR)

import { readdirSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../src/lib/migrations-sql.mjs";

// Apply the shared migrations (single source of truth) so the imported DB has the
// exact same schema as the running app.
function migrate(db) {
  const current = db.pragma("user_version", { simple: true });
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

// ── Derivations (kept simple; this is a best-effort backfill mirroring src/lib) ──
const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const estimateTokens = (s) => Math.ceil(String(s).length / 4);
const hourBucket = (ts) => String(ts).replace("T", " ").slice(0, 13);

function parseMcp(name) {
  if (typeof name !== "string" || !name.startsWith("mcp__")) return { source: "builtin", server: null };
  const rest = name.slice(5);
  if (!rest) return { source: "builtin", server: null };
  const i = rest.indexOf("__");
  return { source: "mcp", server: i > 0 ? rest.slice(0, i) : rest };
}

const PRICES = [
  [/opus/i, { in: 15, out: 75, cw: 18.75, cr: 1.5 }],
  [/haiku/i, { in: 0.8, out: 4, cw: 1, cr: 0.08 }],
  [/sonnet/i, { in: 3, out: 15, cw: 3.75, cr: 0.3 }],
];
function priceFor(model) {
  if (model) for (const [re, p] of PRICES) if (re.test(model)) return p;
  return { in: 3, out: 15, cw: 3.75, cr: 0.3 }; // sonnet fallback
}
function costUsd(u, model) {
  const p = priceFor(model);
  return (u.input * p.in + u.output * p.out + u.cacheCreation * p.cw + u.cacheRead * p.cr) / 1_000_000;
}

const TOKEN_PATTERNS = [
  /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g,
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
];
const KV_PATTERN =
  /\b((?:api[_-]?key|secret|token|password|passwd|access[_-]?key)\b\s*[:=]\s*)(["']?[^\s"']+["']?)/gi;
function redact(text) {
  if (process.env.MC_REDACT === "0") return text;
  let out = String(text);
  for (const re of TOKEN_PATTERNS) out = out.replace(re, "[REDACTED]");
  return out.replace(KV_PATTERN, (_m, key) => `${key}[REDACTED]`);
}

const lineCount = (s) => (typeof s === "string" && s.length > 0 ? s.split("\n").length : 0);
function describeFileEdit(name, input) {
  if (!input || typeof input !== "object") return null;
  if (name === "Edit") {
    if (typeof input.file_path !== "string") return null;
    return { path: input.file_path, added: lineCount(input.new_string), removed: lineCount(input.old_string) };
  }
  if (name === "Write") {
    if (typeof input.file_path !== "string") return null;
    return { path: input.file_path, added: lineCount(input.content), removed: 0 };
  }
  if (name === "NotebookEdit") {
    if (typeof input.notebook_path !== "string") return null;
    return { path: input.notebook_path, added: lineCount(input.new_source), removed: 0 };
  }
  return null;
}

const claudeDir = process.env.CLAUDE_DIR || path.join(os.homedir(), ".claude");
const projectsDir = path.join(claudeDir, "projects");
const dataDir = process.env.MC_DATA_DIR || path.join(process.cwd(), "data");

function clip(s, n) {
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const t = content.find((b) => b?.type === "text" && typeof b.text === "string");
    return t ? t.text : "";
  }
  return "";
}

function targetOf(name, input) {
  if (!input || typeof input !== "object") return null;
  for (const k of ["file_path", "notebook_path", "command", "pattern", "url", "query", "path"]) {
    if (typeof input[k] === "string") return input[k];
  }
  return null;
}

function parseSession(file) {
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  let sessionId = path.basename(file, ".jsonl");
  let cwd = null;
  let minTs = null;
  let maxTs = null;
  let title = null;
  let model = null;
  const usage = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 };
  const prompts = [];
  const tools = [];

  for (const line of lines) {
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.sessionId) sessionId = o.sessionId;
    if (o.cwd) cwd = o.cwd;
    if (o.timestamp) {
      if (!minTs || o.timestamp < minTs) minTs = o.timestamp;
      if (!maxTs || o.timestamp > maxTs) maxTs = o.timestamp;
    }
    const msg = o.message;
    if (!msg) continue;

    if (msg.role === "user") {
      const txt = textOf(msg.content);
      if (txt && !txt.startsWith("<")) {
        if (!title) title = clip(txt, 90);
        prompts.push({ ts: o.timestamp, text: txt });
      }
    } else if (msg.role === "assistant") {
      if (typeof msg.model === "string") model = msg.model;
      const u = msg.usage;
      if (u && typeof u === "object") {
        usage.input += num(u.input_tokens);
        usage.output += num(u.output_tokens);
        usage.cacheCreation += num(u.cache_creation_input_tokens);
        usage.cacheRead += num(u.cache_read_input_tokens);
      }
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block?.type === "tool_use" && block.name) {
            tools.push({ ts: o.timestamp, name: block.name, input: block.input ?? null });
          }
        }
      }
    }
  }

  return {
    sessionId,
    cwd,
    minTs,
    maxTs,
    title,
    model,
    usage,
    prompts: prompts.slice(0, 200),
    tools: tools.slice(0, 500),
  };
}

function main() {
  if (!existsSync(projectsDir)) {
    console.error(`No transcripts found at ${projectsDir}`);
    process.exit(1);
  }
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "mission-control.db"));
  db.pragma("journal_mode = WAL");
  migrate(db);

  const exists = db.prepare("SELECT 1 FROM sessions WHERE id = ?");
  const insSession = db.prepare(`
    INSERT INTO sessions (id, project_path, project_name, title, status, source,
                          first_seen, last_seen, ended_at, token_input, token_output, token_cache, cost_usd)
    VALUES (?, ?, ?, ?, 'ended', 'import', ?, ?, ?, ?, ?, ?, ?)
  `);
  const insEvent = db.prepare(`
    INSERT INTO events (session_id, event_type, tool_name, model, summary, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insTool = db.prepare(`
    INSERT INTO tool_calls (session_id, tool_name, target, duration_ms, success, source, mcp_server, created_at)
    VALUES (?, ?, ?, NULL, 1, ?, ?, ?)
  `);
  const insToolIo = db.prepare(`
    INSERT INTO tool_io (tool_call_id, input_json, output_json, is_error, error_text)
    VALUES (?, ?, NULL, 0, NULL)
  `);
  const insFileEdit = db.prepare(`
    INSERT INTO file_edits (session_id, tool_call_id, path, added, removed, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insPrompt = db.prepare(`
    INSERT INTO prompts (session_id, event_id, text, token_estimate, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const bumpActivity = db.prepare(`
    INSERT INTO activity_buckets (bucket, event_type, count) VALUES (?, ?, 1)
    ON CONFLICT(bucket, event_type) DO UPDATE SET count = count + 1
  `);

  const files = readdirSync(projectsDir, { recursive: true })
    .map((f) => path.join(projectsDir, f.toString()))
    .filter((f) => f.endsWith(".jsonl"));

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    let s;
    try {
      s = parseSession(file);
    } catch {
      continue;
    }
    if (!s.sessionId) continue;
    if (exists.get(s.sessionId)) {
      skipped++;
      continue;
    }

    const start = s.minTs || new Date().toISOString();
    const end = s.maxTs || start;
    const project = s.cwd ? path.basename(s.cwd) : null;
    const cost = costUsd(s.usage, s.model);

    const tx = db.transaction(() => {
      insSession.run(
        s.sessionId, s.cwd, project, s.title, start, end, end,
        s.usage.input, s.usage.output, s.usage.cacheCreation + s.usage.cacheRead, cost,
      );

      const event = (type, tool, model, summary, ts) =>
        insEvent.run(s.sessionId, type, tool, model, summary, "{}", ts || start);

      event("SessionStart", null, null, "Session gestartet (import)", start);
      bumpActivity.run(hourBucket(start), "SessionStart");

      for (const p of s.prompts) {
        const redacted = redact(p.text);
        const info = event("UserPromptSubmit", null, s.model, `Prompt: ${clip(redacted, 80)}`, p.ts);
        insPrompt.run(
          s.sessionId,
          Number(info.lastInsertRowid),
          redacted.length > 8000 ? redacted.slice(0, 8000) : redacted,
          estimateTokens(p.text),
          p.ts || start,
        );
        bumpActivity.run(hourBucket(p.ts || start), "UserPromptSubmit");
      }

      for (const t of s.tools) {
        const target = targetOf(t.name, t.input);
        const summary = target ? `${t.name} ✓ ${clip(target, 70)}` : `${t.name} ✓`;
        event("PostToolUse", t.name, s.model, summary, t.ts);
        const mcp = parseMcp(t.name);
        const callId = Number(
          insTool.run(s.sessionId, t.name, target, mcp.source, mcp.server, t.ts || start).lastInsertRowid,
        );
        if (t.input != null) insToolIo.run(callId, JSON.stringify(t.input));
        const fe = describeFileEdit(t.name, t.input);
        if (fe) insFileEdit.run(s.sessionId, callId, fe.path, fe.added, fe.removed, t.ts || start);
        if (t.name === "Task") {
          db.prepare(
            "INSERT INTO session_links (parent_session_id, tool_call_id, kind, label) VALUES (?, ?, 'subagent', ?)",
          ).run(
            s.sessionId,
            callId,
            (t.input && (t.input.subagent_type || t.input.description)) || null,
          );
        }
        bumpActivity.run(hourBucket(t.ts || start), "PostToolUse");
      }

      event("SessionEnd", null, null, "Session beendet (import)", end);
      bumpActivity.run(hourBucket(end), "SessionEnd");
    });
    tx();
    imported++;
  }

  console.log(`Imported ${imported} session(s), skipped ${skipped} already present.`);
}

main();
