import type Database from "better-sqlite3";
import { getConfig } from "./config";

// Quiet hours: suppress NON-critical alerts (toast / desktop / webhook) during a
// scheduled window. Alerts are still recorded to the inbox — quiet hours only
// silence the intrusive channels. Pure time/severity helpers are unit-tested.

export interface QuietConfig {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

const CRITICAL = new Set(["error_spike", "cost_projection"]);

export function isCritical(type: string): boolean {
  return CRITICAL.has(type);
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Handles overnight windows (e.g. 22:00–07:00). Empty/equal/invalid → not quiet.
export function inQuietHours(start: string, end: string, now: Date): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s == null || e == null || s === e) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

// An alert is suppressed when quiet hours are active and it isn't critical.
export function isSuppressed(type: string, cfg: QuietConfig, now: Date): boolean {
  return cfg.enabled && !isCritical(type) && inQuietHours(cfg.start, cfg.end, now);
}

let cache: QuietConfig | null = null;
let cacheAt = 0;

export function getQuietConfig(db: Database.Database): QuietConfig {
  const now = Date.now();
  if (cache && now - cacheAt < 60_000) return cache;
  cache = {
    enabled: getConfig(db, "quiet.enabled") === "1",
    start: getConfig(db, "quiet.start") ?? "22:00",
    end: getConfig(db, "quiet.end") ?? "07:00",
  };
  cacheAt = now;
  return cache;
}

export function invalidateQuietCache(): void {
  cache = null;
}
