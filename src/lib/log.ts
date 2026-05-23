import { appendFileSync } from "node:fs";

// Tiny structured logger for the server (API routes). Emits one JSON line per
// record to the console, and — when MC_LOG_FILE is set — appends the same line to
// that file. The minimum level is MC_LOG_LEVEL (default "info"). Server-only:
// never import this from a client component (it uses node:fs).

export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const lvl = (process.env.MC_LOG_LEVEL || "info").toLowerCase() as LogLevel;
  return ORDER[lvl] ?? ORDER.info;
}

// Turn an arbitrary log context into plain fields. Errors keep message + stack.
export function normalizeContext(ctx: unknown): Record<string, unknown> | undefined {
  if (ctx == null) return undefined;
  if (ctx instanceof Error) return { error: ctx.message, stack: ctx.stack };
  if (typeof ctx === "object") return ctx as Record<string, unknown>;
  return { detail: ctx };
}

export interface LogRecord {
  time: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

export function formatRecord(level: LogLevel, msg: string, ctx?: unknown, now?: string): LogRecord {
  return { time: now ?? new Date().toISOString(), level, msg, ...normalizeContext(ctx) };
}

function emit(level: LogLevel, msg: string, ctx?: unknown): void {
  if (ORDER[level] < threshold()) return;
  const line = JSON.stringify(formatRecord(level, msg, ctx));

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  const file = process.env.MC_LOG_FILE;
  if (file) {
    try {
      appendFileSync(file, line + "\n");
    } catch {
      /* logging must never throw */
    }
  }
}

export const log = {
  debug: (msg: string, ctx?: unknown) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: unknown) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: unknown) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: unknown) => emit("error", msg, ctx),
};
