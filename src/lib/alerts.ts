import type Database from "better-sqlite3";

// Read-only alerting rule engine. Rules live in the DB and are evaluated at ingest
// against a small per-event context. Pure evaluateRules so the conditions are
// unit-testable; the DB helpers add caching + dedup (one alert per rule + key).
// This NEVER writes back to Claude — it only records alerts for the dashboard.

export type RuleType = "mcp_error" | "error_spike" | "session_long" | "cost_session";

export interface Rule {
  id: number;
  type: string;
  threshold: number;
  enabled: number;
  label: string | null;
}

export interface RuleCtx {
  eventType: string;
  toolName: string | null;
  toolSource: string | null; // "mcp" | "builtin" | null
  toolSuccess: number | null; // 0 | 1 | null
  sessionId: string;
  sessionCostUsd: number;
  sessionDurationMin: number;
  recentErrorRate: number; // 0..1 over recent tool calls
  hourBucket: string; // for spike dedup
}

// Values the UI interpolates into the localized alert template (keyed by type).
// `message` stays the English fallback + webhook text.
export type AlertParams = Record<string, string | number>;

export interface AlertFire {
  ruleId: number;
  type: string;
  message: string;
  sessionId: string;
  dedupKey: string; // (ruleId, dedupKey) is unique → no flapping/spam
  params?: AlertParams;
}

export function evaluateRules(ctx: RuleCtx, rules: Rule[]): AlertFire[] {
  const fires: AlertFire[] = [];
  const isPost = ctx.eventType === "PostToolUse";
  for (const r of rules) {
    if (!r.enabled) continue;
    switch (r.type) {
      case "mcp_error":
        if (isPost && ctx.toolSource === "mcp" && ctx.toolSuccess === 0) {
          const tool = ctx.toolName ?? "?";
          fires.push({
            ruleId: r.id,
            type: r.type,
            sessionId: ctx.sessionId,
            dedupKey: `${ctx.sessionId}:${ctx.toolName}:${ctx.hourBucket}`,
            message: `MCP tool failed: ${tool}`,
            params: { tool },
          });
        }
        break;
      case "error_spike":
        if (isPost && ctx.recentErrorRate >= r.threshold && r.threshold > 0) {
          const rate = Math.round(ctx.recentErrorRate * 100);
          const threshold = Math.round(r.threshold * 100);
          fires.push({
            ruleId: r.id,
            type: r.type,
            sessionId: ctx.sessionId,
            dedupKey: ctx.hourBucket,
            message: `Error rate ${rate}% (≥ ${threshold}%)`,
            params: { rate, threshold },
          });
        }
        break;
      case "session_long":
        if (ctx.sessionDurationMin >= r.threshold && r.threshold > 0) {
          const minutes = Math.round(ctx.sessionDurationMin);
          fires.push({
            ruleId: r.id,
            type: r.type,
            sessionId: ctx.sessionId,
            dedupKey: ctx.sessionId,
            message: `Session running ${minutes} min (≥ ${r.threshold})`,
            // key matches the i18n template alert.session_long → {minutes}
            params: { minutes, threshold: r.threshold },
          });
        }
        break;
      case "cost_session":
        if (ctx.sessionCostUsd >= r.threshold && r.threshold > 0) {
          const cost = ctx.sessionCostUsd.toFixed(2);
          fires.push({
            ruleId: r.id,
            type: r.type,
            sessionId: ctx.sessionId,
            dedupKey: ctx.sessionId,
            message: `Session cost $${cost} (≥ $${r.threshold})`,
            params: { cost, threshold: r.threshold },
          });
        }
        break;
    }
  }
  return fires;
}

export interface AlertItem {
  id: number;
  rule_id: number | null;
  type: string;
  message: string;
  session_id: string | null;
  read: number;
  created_at: string;
  params: AlertParams | null; // localization values; null for pre-v20 rows
}

// Enabled rules, cached briefly so the hot ingest path doesn't re-query per event.
let rulesCache: Rule[] | null = null;
let rulesCacheAt = 0;

export function getEnabledRules(db: Database.Database): Rule[] {
  const now = Date.now();
  if (rulesCache && now - rulesCacheAt < 60_000) return rulesCache;
  rulesCache = db
    .prepare(`SELECT id, type, threshold, enabled, label FROM alert_rules WHERE enabled = 1`)
    .all() as Rule[];
  rulesCacheAt = now;
  return rulesCache;
}

// Insert an alert, ignoring duplicates (same rule + dedup key). Returns true when
// a new alert was actually recorded.
export function recordAlert(db: Database.Database, fire: AlertFire): boolean {
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO alerts (rule_id, type, message, session_id, dedup_key, params)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      fire.ruleId,
      fire.type,
      fire.message,
      fire.sessionId,
      fire.dedupKey,
      fire.params ? JSON.stringify(fire.params) : null,
    );
  return info.changes > 0;
}

// Evaluates rules and records new (non-duplicate) alerts; returns those new fires
// so callers (ingest) can bridge them onward (desktop/webhook).
export function processAlerts(db: Database.Database, ctx: RuleCtx): AlertFire[] {
  const recorded: AlertFire[] = [];
  for (const fire of evaluateRules(ctx, getEnabledRules(db))) {
    if (recordAlert(db, fire)) recorded.push(fire);
  }
  return recorded;
}

export function recentAlerts(db: Database.Database, limit: number): AlertItem[] {
  const rows = db
    .prepare(
      `SELECT id, rule_id, type, message, session_id, read, created_at, params
       FROM alerts ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as (Omit<AlertItem, "params"> & { params: string | null })[];
  return rows.map((r) => ({ ...r, params: parseParams(r.params) }));
}

function parseParams(json: string | null): AlertParams | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as AlertParams) : null;
  } catch {
    return null;
  }
}

export function unreadAlertCount(db: Database.Database): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM alerts WHERE read = 0`).get() as { n: number }).n;
}

export function markAllAlertsRead(db: Database.Database): number {
  return db.prepare(`UPDATE alerts SET read = 1 WHERE read = 0`).run().changes;
}

export function markAlertsRead(db: Database.Database, ids: number[]): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`UPDATE alerts SET read = 1 WHERE id IN (${placeholders})`).run(...ids).changes;
}
