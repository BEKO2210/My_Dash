import type Database from "better-sqlite3";
import { errorStats, topFailingTools, type FailingTool } from "./errors";

// Daily / weekly digest: a windowed summary (events, cost, sessions, top tools,
// top failing tools) plus an email-ready HTML renderer. buildDigest reads the DB;
// renderDigestHtml is pure (inline styles so it survives email clients).

export type DigestPeriod = "day" | "week";

export interface DigestData {
  period: DigestPeriod;
  since: string;
  generatedAt: string;
  events: number;
  toolCalls: number;
  failures: number;
  sessions: number;
  costUsd: number;
  errorRate: number;
  topTools: { tool: string; count: number }[];
  topErrors: FailingTool[];
}

function sinceIso(period: DigestPeriod, now: Date): string {
  const days = period === "week" ? 7 : 1;
  return new Date(now.getTime() - days * 86_400_000).toISOString().replace("T", " ").slice(0, 19);
}

export function buildDigest(db: Database.Database, period: DigestPeriod, now: Date = new Date()): DigestData {
  const since = sinceIso(period, now);
  const count = (sql: string) => (db.prepare(sql).get(since) as { n: number }).n;
  const events = count(`SELECT COUNT(*) AS n FROM events WHERE created_at >= ?`);
  const sessions = count(`SELECT COUNT(*) AS n FROM sessions WHERE first_seen >= ?`);
  const cost = (
    db.prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS n FROM sessions WHERE first_seen >= ?`).get(since) as {
      n: number;
    }
  ).n;
  const stats = errorStats(db, since);
  const topTools = db
    .prepare(
      `SELECT tool_name AS tool, COUNT(*) AS count FROM tool_calls
       WHERE created_at >= ? GROUP BY tool_name ORDER BY count DESC, tool ASC LIMIT 5`,
    )
    .all(since) as { tool: string; count: number }[];

  return {
    period,
    since,
    generatedAt: now.toISOString().replace("T", " ").slice(0, 19),
    events,
    toolCalls: stats.toolCalls,
    failures: stats.failures,
    sessions,
    costUsd: Number(cost.toFixed(2)),
    errorRate: stats.errorRate,
    topTools,
    topErrors: topFailingTools(db, 5, since),
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

export function renderDigestHtml(d: DigestData): string {
  const title = d.period === "week" ? "Weekly digest" : "Daily digest";
  const stat = (label: string, value: string) =>
    `<td style="padding:10px 14px;border:1px solid #e2e6ee;border-radius:8px"><div style="font-size:20px;font-weight:600;color:#1a2230">${value}</div><div style="font-size:11px;color:#586074;text-transform:uppercase;letter-spacing:.04em">${label}</div></td>`;
  const list = (rows: string[]) =>
    rows.length ? `<ul style="margin:6px 0 0;padding-left:18px;color:#1a2230">${rows.join("")}</ul>` : `<p style="color:#586074;font-size:13px">—</p>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head>
<body style="margin:0;background:#f5f7fa;font-family:ui-sans-serif,system-ui,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <h1 style="font-size:18px;color:#1a2230;margin:0 0 4px">Claude Mission Control — ${title}</h1>
    <p style="font-size:12px;color:#586074;margin:0 0 16px">Since ${esc(d.since)} · generated ${esc(d.generatedAt)}</p>
    <table style="border-collapse:separate;border-spacing:6px;width:100%"><tr>
      ${stat("Events", String(d.events))}
      ${stat("Tool calls", String(d.toolCalls))}
      ${stat("Sessions", String(d.sessions))}
    </tr><tr>
      ${stat("Failures", String(d.failures))}
      ${stat("Error rate", `${Math.round(d.errorRate * 100)}%`)}
      ${stat("Cost", `$${d.costUsd.toFixed(2)}`)}
    </tr></table>
    <h2 style="font-size:14px;color:#1a2230;margin:18px 0 0">Top tools</h2>
    ${list(d.topTools.map((t) => `<li>${esc(t.tool)} — ${t.count}</li>`))}
    <h2 style="font-size:14px;color:#1a2230;margin:18px 0 0">Most failure-prone tools</h2>
    ${list(d.topErrors.map((t) => `<li>${esc(t.tool)} — ${t.failures} fails (${Math.round(t.rate * 100)}%)</li>`))}
    <p style="font-size:11px;color:#9aa3b5;margin-top:24px">Generated locally by Claude Mission Control · read-only.</p>
  </div>
</body></html>`;
}
