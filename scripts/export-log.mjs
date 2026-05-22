#!/usr/bin/env node
// Exports the stored prompts + tool calls (the "what") into a readable Markdown
// transcript, grouped by session, newest session first. The "why" lives in
// DECISIONS.md; persistent Claude knowledge lives in ~/.claude/.../memory.
//
//   npm run export-log
//
// Output: exports/log-<timestamp>.md

import Database from "better-sqlite3";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const src = path.join(process.cwd(), "data", "mission-control.db");
if (!existsSync(src)) {
  console.error(`Keine Datenbank gefunden: ${src}\nLäuft das Dashboard schon? (./start.sh)`);
  process.exit(1);
}

const outDir = path.join(process.cwd(), "exports");
mkdirSync(outDir, { recursive: true });

const db = new Database(src, { readonly: true, fileMustExist: true });

const sessions = db
  .prepare(
    `SELECT s.*,
            (SELECT COUNT(*) FROM events e WHERE e.session_id = s.id)     AS ev,
            (SELECT COUNT(*) FROM tool_calls t WHERE t.session_id = s.id) AS tc
     FROM sessions s ORDER BY datetime(s.last_seen) DESC LIMIT 200`,
  )
  .all();

const eventsFor = db.prepare(
  `SELECT event_type, tool_name, summary, created_at FROM events WHERE session_id = ? ORDER BY id ASC LIMIT 2000`,
);

const fullTime = (s) => {
  if (!s) return "—";
  const d = new Date(s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("de-DE");
};
const clock = (s) => {
  if (!s) return "--:--:--";
  const d = new Date(s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? s : d.toLocaleTimeString("de-DE");
};

let totalEvents = 0;
const body = [];

for (const s of sessions) {
  const evs = eventsFor.all(s.id);
  totalEvents += evs.length;
  const title = s.title || `Session ${s.id.slice(0, 8)}`;
  body.push(`## ${s.project_name || "—"} — ${title}`);
  body.push(
    `Status: **${s.status}** · ${fullTime(s.first_seen)} → ${fullTime(s.last_seen)} · ` +
      `${s.ev} Events, ${s.tc} Tools · ID \`${s.id.slice(0, 12)}\``,
  );
  body.push("");
  for (const e of evs) body.push(`- \`${clock(e.created_at)}\`  ${e.summary || e.event_type}`);
  if (evs.length === 0) body.push("- _(keine Events)_");
  body.push("");
}

const header =
  `# Claude Mission Control — Log-Export\n\n` +
  `Erzeugt: ${new Date().toLocaleString("de-DE")} · ${sessions.length} Sessions · ${totalEvents} Events\n\n` +
  `Quelle: \`data/mission-control.db\` (Prompts + Tool-Aufrufe). Das *Warum* steht in \`DECISIONS.md\`.\n\n---\n`;

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const outFile = path.join(outDir, `log-${stamp}.md`);
writeFileSync(outFile, header + "\n" + body.join("\n") + "\n");

console.log(`✓ Export: ${path.relative(process.cwd(), outFile)} (${sessions.length} Sessions, ${totalEvents} Events)`);
