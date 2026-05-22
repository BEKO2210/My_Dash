import path from "node:path";
import { db } from "./db";
import { publish } from "./bus";
import type { EventRow, HookPayload, SessionRow, SessionStatus } from "./types";

// Which session status each event implies. Crucially: Stop != "done" (it fires after every
// turn) — only SessionEnd ends a session. Stop/Notification mean "waiting for the user".
function statusFor(eventType: string): SessionStatus | null {
  switch (eventType) {
    case "SessionStart":
    case "UserPromptSubmit":
    case "PreToolUse":
    case "PostToolUse":
    case "PreCompact":
      return "active";
    case "Stop":
    case "SubagentStop":
    case "Notification":
      return "waiting";
    case "SessionEnd":
      return "ended";
    default:
      return null;
  }
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

// Best-effort "what does this tool act on" for the stream + graph.
function extractTarget(toolName: string | undefined, input: unknown): string | null {
  if (!toolName || !input || typeof input !== "object") return null;
  const i = input as Record<string, unknown>;
  const first = (...keys: string[]) => {
    for (const k of keys) if (typeof i[k] === "string") return i[k] as string;
    return null;
  };
  switch (toolName) {
    case "Read":
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return first("file_path", "notebook_path");
    case "Bash":
      return first("command");
    case "Grep":
      return first("pattern");
    case "Glob":
      return first("pattern", "path");
    case "WebFetch":
      return first("url");
    case "WebSearch":
      return first("query");
    case "Task":
      return first("description", "subagent_type");
    default:
      return first("file_path", "path", "url", "query", "command", "pattern");
  }
}

function summarize(eventType: string, payload: HookPayload): string {
  const tool = payload.tool_name;
  switch (eventType) {
    case "SessionStart":
      return `Session gestartet (${payload.source ?? "startup"})`;
    case "SessionEnd":
      return `Session beendet (${payload.reason ?? "exit"})`;
    case "UserPromptSubmit":
      return payload.prompt ? `Prompt: ${clip(payload.prompt, 80)}` : "Prompt gesendet";
    case "PreToolUse": {
      const t = extractTarget(tool, payload.tool_input);
      return t ? `${tool}: ${clip(t, 70)}` : `${tool}`;
    }
    case "PostToolUse": {
      const t = extractTarget(tool, payload.tool_input);
      return t ? `${tool} ✓ ${clip(t, 70)}` : `${tool} ✓`;
    }
    case "Notification":
      return payload.message ? clip(payload.message, 90) : "Notification";
    case "Stop":
      return "Antwort abgeschlossen — wartet auf Eingabe";
    case "SubagentStop":
      return "Subagent fertig";
    case "PreCompact":
      return `Kontext wird komprimiert (${payload.trigger ?? "auto"})`;
    default:
      return eventType;
  }
}

function toolSucceeded(response: unknown): number {
  if (response && typeof response === "object") {
    const r = response as Record<string, unknown>;
    if (r.is_error === true || r.error) return 0;
  }
  return 1;
}

const upsertSession = db.prepare<
  [string, string | null, string | null, string | null]
>(`
  INSERT INTO sessions (id, project_path, project_name, source, status)
  VALUES (?, ?, ?, ?, 'active')
  ON CONFLICT(id) DO UPDATE SET
    project_path = COALESCE(excluded.project_path, sessions.project_path),
    project_name = COALESCE(excluded.project_name, sessions.project_name),
    source       = COALESCE(sessions.source, excluded.source)
`);

const setTitleIfEmpty = db.prepare<[string, string]>(
  `UPDATE sessions SET title = ? WHERE id = ? AND (title IS NULL OR title = '')`,
);

const setStatus = db.prepare<[string, string]>(
  `UPDATE sessions SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
);

const setEnded = db.prepare<[string]>(
  `UPDATE sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP, last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
);

const insertEvent = db.prepare<[string, string, string | null, string, string]>(`
  INSERT INTO events (session_id, event_type, tool_name, summary, payload_json)
  VALUES (?, ?, ?, ?, ?)
  RETURNING *
`);

const getSession = db.prepare<[string]>(`SELECT * FROM sessions WHERE id = ?`);

const lastPreToolTime = db.prepare<[string, string]>(`
  SELECT created_at FROM events
  WHERE session_id = ? AND event_type = 'PreToolUse' AND tool_name = ?
  ORDER BY id DESC LIMIT 1
`);

const insertToolCall = db.prepare<
  [string, string, string | null, number | null, number]
>(`
  INSERT INTO tool_calls (session_id, tool_name, target, duration_ms, success)
  VALUES (?, ?, ?, ?, ?)
`);

export interface IngestResult {
  event: EventRow;
  session: SessionRow;
}

// The one and only write path. Everything funnels through here.
export function ingest(headerEvent: string, payload: HookPayload): IngestResult {
  const eventType = payload.hook_event_name || headerEvent || "unknown";
  const sessionId = payload.session_id || "unknown";
  const cwd = typeof payload.cwd === "string" ? payload.cwd : null;
  const projectName = cwd ? path.basename(cwd) : null;
  const toolName = typeof payload.tool_name === "string" ? payload.tool_name : null;
  const summary = summarize(eventType, payload);

  const tx = db.transaction(() => {
    upsertSession.run(sessionId, cwd, projectName, payload.source ?? null);

    if (eventType === "UserPromptSubmit" && typeof payload.prompt === "string") {
      setTitleIfEmpty.run(clip(payload.prompt, 90), sessionId);
    }

    if (eventType === "SessionEnd") {
      setEnded.run(sessionId);
    } else {
      const status = statusFor(eventType);
      if (status) setStatus.run(status, sessionId);
    }

    if (eventType === "PostToolUse" && toolName) {
      const pre = lastPreToolTime.get(sessionId, toolName) as
        | { created_at: string }
        | undefined;
      let duration: number | null = null;
      if (pre) duration = Math.max(0, Date.now() - new Date(pre.created_at + "Z").getTime());
      insertToolCall.run(
        sessionId,
        toolName,
        extractTarget(toolName, payload.tool_input),
        duration,
        toolSucceeded(payload.tool_response),
      );
    }

    const event = insertEvent.get(
      sessionId,
      eventType,
      toolName,
      summary,
      JSON.stringify(payload),
    ) as EventRow;

    const session = getSession.get(sessionId) as SessionRow;
    return { event, session };
  });

  const result = tx();
  publish(result);
  return result;
}
