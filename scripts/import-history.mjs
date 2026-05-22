#!/usr/bin/env node
// Backfills the dashboard with sessions that happened BEFORE it was installed, by
// reading Claude Code's transcripts at ~/.claude/projects/**/*.jsonl.
// Safe to re-run: sessions already in the DB are skipped.
//
//   npm run import-history

import { readdirSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, project_path TEXT, project_name TEXT, title TEXT,
  status TEXT NOT NULL DEFAULT 'active', source TEXT,
  first_seen DATETIME DEFAULT CURRENT_TIMESTAMP, last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME, token_input INTEGER DEFAULT 0, token_output INTEGER DEFAULT 0, cost_usd REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, event_type TEXT NOT NULL,
  tool_name TEXT, summary TEXT, payload_json TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, tool_name TEXT NOT NULL,
  target TEXT, duration_ms INTEGER, success INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const claudeDir = process.env.CLAUDE_DIR || path.join(os.homedir(), ".claude");
const projectsDir = path.join(claudeDir, "projects");
const dataDir = path.join(process.cwd(), "data");

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
        prompts.push({ ts: o.timestamp, text: clip(txt, 80) });
      }
    } else if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block?.type === "tool_use" && block.name) {
          tools.push({ ts: o.timestamp, name: block.name, target: targetOf(block.name, block.input) });
        }
      }
    }
  }

  return { sessionId, cwd, minTs, maxTs, title, prompts: prompts.slice(0, 200), tools: tools.slice(0, 500) };
}

function main() {
  if (!existsSync(projectsDir)) {
    console.error(`No transcripts found at ${projectsDir}`);
    process.exit(1);
  }
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "mission-control.db"));
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);

  const exists = db.prepare("SELECT 1 FROM sessions WHERE id = ?");
  const insSession = db.prepare(`
    INSERT INTO sessions (id, project_path, project_name, title, status, source, first_seen, last_seen, ended_at)
    VALUES (?, ?, ?, ?, 'ended', 'import', ?, ?, ?)
  `);
  const insEvent = db.prepare(`
    INSERT INTO events (session_id, event_type, tool_name, summary, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insTool = db.prepare(`
    INSERT INTO tool_calls (session_id, tool_name, target, duration_ms, success, created_at)
    VALUES (?, ?, ?, NULL, 1, ?)
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

    const tx = db.transaction(() => {
      insSession.run(s.sessionId, s.cwd, project, s.title, start, end, end);
      insEvent.run(s.sessionId, "SessionStart", null, "Session gestartet (import)", "{}", start);
      for (const p of s.prompts) {
        insEvent.run(s.sessionId, "UserPromptSubmit", null, `Prompt: ${p.text}`, "{}", p.ts || start);
      }
      for (const t of s.tools) {
        const summary = t.target ? `${t.name} ✓ ${clip(t.target, 70)}` : `${t.name} ✓`;
        insEvent.run(s.sessionId, "PostToolUse", t.name, summary, "{}", t.ts || start);
        insTool.run(s.sessionId, t.name, t.target, t.ts || start);
      }
      insEvent.run(s.sessionId, "SessionEnd", null, "Session beendet (import)", "{}", end);
    });
    tx();
    imported++;
  }

  console.log(`Imported ${imported} session(s), skipped ${skipped} already present.`);
}

main();
