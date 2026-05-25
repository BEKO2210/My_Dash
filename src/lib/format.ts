// Client-safe formatting helpers (no node imports).

// SQLite CURRENT_TIMESTAMP is UTC, stored as "YYYY-MM-DD HH:MM:SS" with no zone marker.
export function parseDbTime(s: string | null | undefined): Date | null {
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function relativeTime(s: string | null | undefined, lang: "de" | "en" = "de"): string {
  const d = parseDbTime(s);
  if (!d) return "—";
  const secs = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (secs < 5) return lang === "en" ? "just now" : "gerade eben";
  const ago = (n: number, u: string) => (lang === "en" ? `${n}${u} ago` : `vor ${n}${u}`);
  if (secs < 60) return ago(secs, "s");
  const mins = Math.round(secs / 60);
  if (mins < 60) return ago(mins, "m");
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return ago(hrs, "h");
  return ago(Math.round(hrs / 24), "d");
}

// Elapsed wall-clock duration → "12s", "2m 15s", "1h 03m". For live timers.
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}

export function formatMoney(n: number, currency: "USD" | "EUR"): string {
  const symbol = currency === "EUR" ? "€" : "$";
  const safe = Number.isFinite(n) ? n : 0;
  return symbol + safe.toFixed(2);
}

// Locale-aware money formatter (the single money helper going forward): thousands
// separators + correct symbol placement + decimals per the active language —
// EN "$1,234.56", DE "1.234,56 €". Widgets migrate from formatMoney(n,cur) to this
// (passing the active lang) in the currency-consistency pass so the whole dashboard
// renders one consistent currency. NaN→0; defensive fallback keeps it from throwing.
export function formatCurrency(
  amount: number,
  currency: "USD" | "EUR",
  lang: "de" | "en" = "en",
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return (currency === "EUR" ? "€" : "$") + safe.toFixed(2);
  }
}

// USD→EUR conversion (pure). `rate` = EUR per 1 USD.
export function usdToEur(usd: number, rate: number): number {
  const u = Number.isFinite(usd) ? usd : 0;
  return u * (Number.isFinite(rate) && rate > 0 ? rate : 0);
}

// Client-visible EUR/USD rate, mirroring ccusage's server-side default. Override
// with NEXT_PUBLIC_EUR_PER_USD (inlined at build); defaults to 0.92.
export function eurRate(): number {
  const r = Number(process.env.NEXT_PUBLIC_EUR_PER_USD);
  return Number.isFinite(r) && r > 0 ? r : 0.92;
}

// Logical category for an event → drives colour + icon in the UI.
export type EventKind =
  | "session-start"
  | "session-end"
  | "prompt"
  | "tool-pre"
  | "tool-post"
  | "notification"
  | "stop"
  | "subagent"
  | "compact"
  | "other";

export function eventKind(eventType: string): EventKind {
  switch (eventType) {
    case "SessionStart":
      return "session-start";
    case "SessionEnd":
      return "session-end";
    case "UserPromptSubmit":
      return "prompt";
    case "PreToolUse":
      return "tool-pre";
    case "PostToolUse":
      return "tool-post";
    case "Notification":
      return "notification";
    case "Stop":
      return "stop";
    case "SubagentStop":
      return "subagent";
    case "PreCompact":
      return "compact";
    default:
      return "other";
  }
}

export const KIND_COLOR: Record<EventKind, string> = {
  "session-start": "text-emerald-400",
  "session-end": "text-zinc-400",
  prompt: "text-sky-400",
  "tool-pre": "text-amber-400",
  "tool-post": "text-emerald-400",
  notification: "text-fuchsia-400",
  stop: "text-zinc-400",
  subagent: "text-violet-400",
  compact: "text-orange-400",
  other: "text-zinc-400",
};

export const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: "Aktiv", dot: "bg-emerald-400", text: "text-emerald-400" },
  waiting: { label: "Wartet", dot: "bg-amber-400", text: "text-amber-400" },
  ended: { label: "Beendet", dot: "bg-zinc-500", text: "text-zinc-400" },
};
