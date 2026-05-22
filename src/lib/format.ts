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
