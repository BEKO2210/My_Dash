import type Database from "better-sqlite3";
import { db as defaultDb } from "./db";

// Optional SECOND read-only ingress: parse Claude Code's OpenTelemetry export
// (OTLP/HTTP, JSON encoding) into flat rows for the isolated otlp_* tables. These
// functions are pure (no DB) except the insert helpers, so they're easy to test and
// can never reach into the hook-driven model. Mapping/reconcile is a later run.

export interface OtlpMetricRow {
  ts: string | null;
  name: string;
  sessionId: string | null;
  model: string | null;
  value: number;
  attrs: Record<string, string | number | boolean>;
}

export interface OtlpLogRow {
  ts: string | null;
  name: string;
  sessionId: string | null;
  model: string | null;
  body: string | null;
  attrs: Record<string, string | number | boolean>;
}

export function otlpEnabled(): boolean {
  return process.env.MC_OTLP_ENABLED === "1";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

// Extract a scalar from an OTLP AnyValue ({ stringValue | intValue | doubleValue | boolValue }).
// intValue/asInt arrive as strings on the wire, so coerce numerics defensively.
export function attrValue(v: unknown): string | number | boolean | null {
  const o = asRecord(v);
  if (!o) return null;
  if (typeof o.stringValue === "string") return o.stringValue;
  if (o.intValue !== undefined) {
    const n = Number(o.intValue);
    return Number.isFinite(n) ? n : null;
  }
  if (o.doubleValue !== undefined) {
    const n = Number(o.doubleValue);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof o.boolValue === "boolean") return o.boolValue;
  return null;
}

// Flatten an OTLP attributes array ([{ key, value }]) into a plain object.
export function flattenAttributes(attrs: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const a of asArray(attrs)) {
    const kv = asRecord(a);
    if (!kv || typeof kv.key !== "string") continue;
    const val = attrValue(kv.value);
    if (val !== null) out[kv.key] = val;
  }
  return out;
}

function nanoToIso(ts: unknown): string | null {
  if (ts === undefined || ts === null) return null;
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n / 1e6).toISOString();
}

function promote(attrs: Record<string, string | number | boolean>, key: string): string | null {
  const v = attrs[key];
  return v === undefined ? null : String(v);
}

// resourceMetrics[].scopeMetrics[].metrics[].(sum|gauge).dataPoints[] -> rows.
export function parseMetrics(body: unknown): OtlpMetricRow[] {
  const rows: OtlpMetricRow[] = [];
  for (const rm of asArray(asRecord(body)?.resourceMetrics)) {
    const rmo = asRecord(rm);
    const resourceAttrs = flattenAttributes(asRecord(rmo?.resource)?.attributes);
    for (const sm of asArray(rmo?.scopeMetrics)) {
      for (const m of asArray(asRecord(sm)?.metrics)) {
        const mo = asRecord(m);
        if (!mo || typeof mo.name !== "string") continue;
        const points = [
          ...asArray(asRecord(mo.sum)?.dataPoints),
          ...asArray(asRecord(mo.gauge)?.dataPoints),
        ];
        for (const dp of points) {
          const dpo = asRecord(dp);
          if (!dpo) continue;
          const attrs = { ...resourceAttrs, ...flattenAttributes(dpo.attributes) };
          const raw = dpo.asInt !== undefined ? Number(dpo.asInt) : dpo.asDouble !== undefined ? Number(dpo.asDouble) : 0;
          rows.push({
            ts: nanoToIso(dpo.timeUnixNano),
            name: mo.name,
            sessionId: promote(attrs, "session.id"),
            model: promote(attrs, "model"),
            value: Number.isFinite(raw) ? raw : 0,
            attrs,
          });
        }
      }
    }
  }
  return rows;
}

// resourceLogs[].scopeLogs[].logRecords[] -> rows. The event name is the
// event.name attribute (Claude Code's convention), falling back to the log body.
export function parseLogs(body: unknown): OtlpLogRow[] {
  const rows: OtlpLogRow[] = [];
  for (const rl of asArray(asRecord(body)?.resourceLogs)) {
    const rlo = asRecord(rl);
    const resourceAttrs = flattenAttributes(asRecord(rlo?.resource)?.attributes);
    for (const sl of asArray(rlo?.scopeLogs)) {
      for (const lr of asArray(asRecord(sl)?.logRecords)) {
        const lro = asRecord(lr);
        if (!lro) continue;
        const attrs = { ...resourceAttrs, ...flattenAttributes(lro.attributes) };
        const bodyVal = attrValue(lro.body);
        const name = promote(attrs, "event.name") ?? (typeof bodyVal === "string" ? bodyVal : null);
        if (!name) continue;
        rows.push({
          ts: nanoToIso(lro.timeUnixNano),
          name,
          sessionId: promote(attrs, "session.id"),
          model: promote(attrs, "model"),
          body: bodyVal !== null ? String(bodyVal) : null,
          attrs,
        });
      }
    }
  }
  return rows;
}

export function insertMetrics(rows: OtlpMetricRow[], database: Database.Database = defaultDb): number {
  if (rows.length === 0) return 0;
  const stmt = database.prepare(
    "INSERT INTO otlp_metric (ts, name, session_id, model, value, attrs) VALUES (?, ?, ?, ?, ?, ?)",
  );
  database.transaction((rs: OtlpMetricRow[]) => {
    for (const r of rs) stmt.run(r.ts, r.name, r.sessionId, r.model, r.value, JSON.stringify(r.attrs));
  })(rows);
  return rows.length;
}

export function insertLogs(rows: OtlpLogRow[], database: Database.Database = defaultDb): number {
  if (rows.length === 0) return 0;
  const stmt = database.prepare(
    "INSERT INTO otlp_log (ts, name, session_id, model, body, attrs) VALUES (?, ?, ?, ?, ?, ?)",
  );
  database.transaction((rs: OtlpLogRow[]) => {
    for (const r of rs) stmt.run(r.ts, r.name, r.sessionId, r.model, r.body, JSON.stringify(r.attrs));
  })(rows);
  return rows.length;
}
