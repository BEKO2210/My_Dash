import path from "node:path";
import { db } from "./db";
import { hourBucket } from "./activity";
import { processAlerts } from "./alerts";
import { checkBudgetAlarms } from "./budget-alarm";
import { publish } from "./bus";
import { describeFileEdit } from "./file-edit";
import { parseDbTime } from "./format";
import { scheduleGitUpdate } from "./git-sync";
import { log } from "./log";
import { parseMcpTool } from "./mcp";
import { preparePrompt, redactSecrets, redactValue, type PreparedPrompt } from "./prompt";
import { pruneAll } from "./retention";
import { scheduleTranscriptUpdate } from "./transcript-sync";
import { getQuietConfig, isSuppressed } from "./quiet";
import { getWebhookConfig, sendAlertWebhook } from "./webhook";
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

// Label for a Task (subagent) link: prefer the agent type, fall back to the
// task description. The full input stays in tool_io for drill-down.
function taskLabel(input: unknown): string | null {
  if (input && typeof input === "object") {
    const i = input as Record<string, unknown>;
    if (typeof i.subagent_type === "string") return i.subagent_type;
    if (typeof i.description === "string") return i.description;
  }
  return null;
}

// Classify a tool_response into an error flag + best-effort message. A response is
// an error when it carries is_error:true or a truthy error field.
function describeToolResult(response: unknown): { isError: boolean; errorText: string | null } {
  if (response && typeof response === "object") {
    const r = response as Record<string, unknown>;
    if (r.is_error === true || r.error) {
      const text =
        typeof r.error === "string"
          ? r.error
          : typeof r.errorText === "string"
            ? r.errorText
            : typeof r.message === "string"
              ? r.message
              : null;
      return { isError: true, errorText: text };
    }
  }
  return { isError: false, errorText: null };
}

// Best-effort model name from the payload. Most hook events don't carry it; the
// transcript-tailing step fills it in reliably. Captured here so it's stored
// whenever a payload does include it.
function extractModel(payload: HookPayload): string | null {
  return typeof payload.model === "string" ? payload.model : null;
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

const setTranscriptPath = db.prepare<[string, string]>(
  `UPDATE sessions SET transcript_path = ? WHERE id = ?`,
);

const setStatus = db.prepare<[string, string]>(
  `UPDATE sessions SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
);

const setEnded = db.prepare<[string]>(
  `UPDATE sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP, last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
);

const insertEvent = db.prepare<[string, string, string | null, string | null, string, string]>(`
  INSERT INTO events (session_id, event_type, tool_name, model, summary, payload_json)
  VALUES (?, ?, ?, ?, ?, ?)
  RETURNING *
`);

const insertPrompt = db.prepare<[string, number, string, number]>(`
  INSERT INTO prompts (session_id, event_id, text, token_estimate)
  VALUES (?, ?, ?, ?)
`);

const insertSearch = db.prepare<[string, string, number, string]>(`
  INSERT INTO search_fts (text, kind, ref_id, session_id) VALUES (?, ?, ?, ?)
`);

const bumpActivity = db.prepare<[string, string]>(`
  INSERT INTO activity_buckets (bucket, event_type, count) VALUES (?, ?, 1)
  ON CONFLICT(bucket, event_type) DO UPDATE SET count = count + 1
`);

const getSession = db.prepare<[string]>(`SELECT * FROM sessions WHERE id = ?`);

// Error rate over a session's most recent tool calls — feeds the error-spike alert.
// Scoped per session so a noisy project can't trip the alert for an unrelated one.
const recentErrorRateStmt = db.prepare<[string]>(
  `SELECT AVG(CASE WHEN success = 0 THEN 1.0 ELSE 0 END) AS r
   FROM (SELECT success FROM tool_calls WHERE session_id = ? ORDER BY id DESC LIMIT 50)`,
);

export function recentSessionErrorRate(sessionId: string): number {
  return (recentErrorRateStmt.get(sessionId) as { r: number | null }).r ?? 0;
}

const lastPreToolTime = db.prepare<[string, string]>(`
  SELECT created_at FROM events
  WHERE session_id = ? AND event_type = 'PreToolUse' AND tool_name = ?
  ORDER BY id DESC LIMIT 1
`);

// Most recent recorded tool_call (i.e. PostToolUse) time for a session+tool — used
// to tell whether the last PreToolUse is still "open" in the DB fallback below.
const lastToolCallTime = db.prepare<[string, string]>(`
  SELECT created_at FROM tool_calls
  WHERE session_id = ? AND tool_name = ?
  ORDER BY id DESC LIMIT 1
`);

const insertToolCall = db.prepare<
  [string, string, string | null, number | null, number, string, string | null]
>(`
  INSERT INTO tool_calls (session_id, tool_name, target, duration_ms, success, source, mcp_server)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertToolIo = db.prepare<
  [number, string | null, string | null, number, string | null]
>(`
  INSERT INTO tool_io (tool_call_id, input_json, output_json, is_error, error_text)
  VALUES (?, ?, ?, ?, ?)
`);

const insertSessionLink = db.prepare<[string, string | null, number | null, string, string | null]>(`
  INSERT INTO session_links (parent_session_id, child_session_id, tool_call_id, kind, label)
  VALUES (?, ?, ?, ?, ?)
`);

const insertFileEdit = db.prepare<[string, number, string, number, number]>(`
  INSERT INTO file_edits (session_id, tool_call_id, path, added, removed)
  VALUES (?, ?, ?, ?, ?)
`);

// Millisecond-precise tool durations: SQLite's CURRENT_TIMESTAMP only has second
// resolution, so we remember PreToolUse start times in memory (single process) and
// pair them on PostToolUse. Each key holds a FIFO *queue* of starts, so two
// concurrent calls of the same tool (Claude can issue parallel tool_use blocks) no
// longer overwrite each other. With a tool_use_id the key is unique per call (exact
// pairing, even out of order); otherwise it's per (session, tool), paired
// oldest-first. Falls back to the events table after a restart.
const globalForPending = globalThis as unknown as { __mcPending?: Map<string, number[]> };
const pendingStarts = globalForPending.__mcPending ?? new Map<string, number[]>();
globalForPending.__mcPending = pendingStarts;
// A space can't appear in a session id, tool name or tool_use_id, so it separates
// the parts unambiguously.
const startKey = (sessionId: string, toolName: string, toolUseId: string | null) =>
  `${sessionId} ${toolUseId ?? `name:${toolName}`}`;

function pushStart(key: string, at: number): void {
  const q = pendingStarts.get(key);
  if (q) q.push(at);
  else pendingStarts.set(key, [at]);
}

function shiftStart(key: string): number | undefined {
  const q = pendingStarts.get(key);
  if (!q || q.length === 0) return undefined;
  const at = q.shift();
  if (q.length === 0) pendingStarts.delete(key);
  return at;
}

// Duration for the DB fallback (used after a restart, when the in-memory start is
// gone). Returns null when the most-recent PreToolUse was already consumed by an
// earlier PostToolUse — i.e. it is no newer than the last recorded tool_call — so a
// 2nd Post with no fresh Pre doesn't over-count from a stale start. Pure → testable.
export function fallbackDuration(
  nowMs: number,
  preMs: number | null,
  lastCallMs: number | null,
): number | null {
  if (preMs === null || !Number.isFinite(preMs)) return null;
  if (lastCallMs !== null && preMs <= lastCallMs) return null; // Pre already paired
  return Math.max(0, nowMs - preMs);
}

export interface IngestResult {
  event: EventRow;
  session: SessionRow;
}

// Apply retention every so often rather than on every write — pruning is a cheap
// indexed delete, but no need to run it per event. Runs outside the write
// transaction and never propagates a failure into the ingest path.
const PRUNE_INTERVAL = 200;
let sinceLastPrune = 0;
function maybePrune(): void {
  if (++sinceLastPrune < PRUNE_INTERVAL) return;
  sinceLastPrune = 0;
  try {
    pruneAll(db);
  } catch (err) {
    log.error("retention prune failed", err);
  }
}

// The one and only write path. Everything funnels through here.
export function ingest(headerEvent: string, payload: HookPayload): IngestResult {
  const eventType = payload.hook_event_name || headerEvent || "unknown";
  const sessionId = payload.session_id || "unknown";
  const cwd = typeof payload.cwd === "string" ? payload.cwd : null;
  const projectName = cwd ? path.basename(cwd) : null;
  const toolName = typeof payload.tool_name === "string" ? payload.tool_name : null;
  const toolUseId = typeof payload.tool_use_id === "string" ? payload.tool_use_id : null;
  const model = extractModel(payload);

  // Captured in the PostToolUse branch for the alert engine (after the tx).
  let alertToolSource: string | null = null;
  let alertToolSuccess: number | null = null;

  // Redact secrets in the prompt before it's persisted anywhere (payload_json,
  // title, summary, prompts table all use the redacted text).
  let prepared: PreparedPrompt | null = null;
  let stored: HookPayload = payload;
  if (eventType === "UserPromptSubmit" && typeof payload.prompt === "string") {
    prepared = preparePrompt(payload.prompt);
    stored = { ...payload, prompt: prepared.redacted };
  }

  // Tool I/O can carry secrets too (a Bash command with a token, an env dump, a
  // file read). Redact it before it's persisted to tool_io + payload_json or shown
  // in the UI/export — the same guarantee the prompt already gets.
  const redactedToolInput = payload.tool_input !== undefined ? redactValue(payload.tool_input) : undefined;
  const redactedToolResponse =
    payload.tool_response !== undefined ? redactValue(payload.tool_response) : undefined;

  // payload_json carries the redacted prompt and now redacted tool I/O. Built from
  // a plain object so the typed HookPayload fields don't fight the redacted values.
  const storedForJson: Record<string, unknown> = { ...stored };
  if (redactedToolInput !== undefined) storedForJson.tool_input = redactedToolInput;
  if (redactedToolResponse !== undefined) storedForJson.tool_response = redactedToolResponse;
  const payloadJson = JSON.stringify(storedForJson);

  // The summary is derived from tool_input (e.g. a Bash command) → redact it so no
  // secret leaks into events.summary / the search index / the live stream.
  const summary = redactSecrets(summarize(eventType, stored));

  const tx = db.transaction(() => {
    upsertSession.run(sessionId, cwd, projectName, payload.source ?? null);

    if (prepared) {
      setTitleIfEmpty.run(clip(prepared.redacted, 90), sessionId);
    }

    if (typeof payload.transcript_path === "string" && payload.transcript_path) {
      setTranscriptPath.run(payload.transcript_path, sessionId);
    }

    if (eventType === "SessionEnd") {
      setEnded.run(sessionId);
    } else {
      const status = statusFor(eventType);
      if (status) setStatus.run(status, sessionId);
    }

    if (eventType === "PreToolUse" && toolName) {
      if (pendingStarts.size > 1000) pendingStarts.clear(); // guard against orphaned starts
      pushStart(startKey(sessionId, toolName, toolUseId), Date.now());
    }

    if (eventType === "PostToolUse" && toolName) {
      let duration: number | null = null;
      const startedAt = shiftStart(startKey(sessionId, toolName, toolUseId));
      if (startedAt !== undefined) {
        duration = Date.now() - startedAt;
      } else {
        // No in-memory start (server restarted mid-call). Pair against the events
        // table — but only if that PreToolUse is still "open" (newer than the last
        // recorded tool_call), so a 2nd Post with no fresh Pre doesn't over-count.
        const pre = lastPreToolTime.get(sessionId, toolName) as { created_at: string } | undefined;
        const lastCall = lastToolCallTime.get(sessionId, toolName) as { created_at: string } | undefined;
        duration = fallbackDuration(
          Date.now(),
          pre ? (parseDbTime(pre.created_at)?.getTime() ?? null) : null,
          lastCall ? (parseDbTime(lastCall.created_at)?.getTime() ?? null) : null,
        );
      }
      const { isError, errorText } = describeToolResult(payload.tool_response);
      const mcp = parseMcpTool(toolName);
      alertToolSource = mcp.isMcp ? "mcp" : "builtin";
      alertToolSuccess = isError ? 0 : 1;
      const target = extractTarget(toolName, payload.tool_input);
      const info = insertToolCall.run(
        sessionId,
        toolName,
        target !== null ? redactSecrets(target) : null,
        duration,
        isError ? 0 : 1,
        mcp.isMcp ? "mcp" : "builtin",
        mcp.server,
      );
      insertToolIo.run(
        Number(info.lastInsertRowid),
        redactedToolInput !== undefined ? JSON.stringify(redactedToolInput) : null,
        redactedToolResponse !== undefined ? JSON.stringify(redactedToolResponse) : null,
        isError ? 1 : 0,
        errorText !== null ? redactSecrets(errorText) : null,
      );

      // A Task call spawned a subagent — record the parent→subagent link.
      if (toolName === "Task") {
        insertSessionLink.run(
          sessionId,
          null,
          Number(info.lastInsertRowid),
          "subagent",
          taskLabel(payload.tool_input),
        );
      }

      // Successful file edits feed the hotspot analytics.
      if (!isError) {
        const fe = describeFileEdit(toolName, payload.tool_input);
        if (fe) {
          insertFileEdit.run(sessionId, Number(info.lastInsertRowid), fe.path, fe.added, fe.removed);
        }
      }
    }

    const event = insertEvent.get(
      sessionId,
      eventType,
      toolName,
      model,
      summary,
      payloadJson,
    ) as EventRow;

    if (summary) insertSearch.run(summary, "event", event.id, sessionId);

    if (prepared) {
      const p = insertPrompt.run(sessionId, event.id, prepared.capped, prepared.tokenEstimate);
      insertSearch.run(prepared.capped, "prompt", Number(p.lastInsertRowid), sessionId);
    }

    bumpActivity.run(hourBucket(event.created_at), eventType);

    const session = getSession.get(sessionId) as SessionRow;
    return { event, session };
  });

  const result = tx();
  maybePrune();
  publish(result);

  // Read-only alerting: evaluate the rule engine against this event. Never blocks
  // or fails ingest.
  try {
    const startMs = parseDbTime(result.session.first_seen)?.getTime();
    const durationMin = startMs ? Math.max(0, (Date.now() - startMs) / 60_000) : 0;
    const recentErrorRate = eventType === "PostToolUse" ? recentSessionErrorRate(sessionId) : 0;
    const fired = processAlerts(db, {
      eventType,
      toolName,
      toolSource: alertToolSource,
      toolSuccess: alertToolSuccess,
      sessionId,
      sessionCostUsd: result.session.cost_usd ?? 0,
      sessionDurationMin: durationMin,
      recentErrorRate,
      hourBucket: hourBucket(result.event.created_at),
    });
    // Optional outbound webhook (Slack/Discord), off by default. Fire-and-forget.
    if (fired.length > 0) {
      const wh = getWebhookConfig(db);
      if (wh.enabled && wh.url) {
        const quiet = getQuietConfig(db);
        const at = new Date();
        for (const f of fired) {
          if (isSuppressed(f.type, quiet, at)) continue; // quiet hours: skip non-critical
          void sendAlertWebhook(wh.url, f.message).catch((err) => log.error("webhook failed", err));
        }
      }
    }

    // Budget over-spend alarm: a write, so it belongs here on the ingest path (not
    // on the read-only /api/budget GET). Checked at turn boundaries, where spend
    // changes; no-ops unless a budget is configured. Deduped per period/day.
    if (eventType === "Stop" || eventType === "SessionEnd") {
      checkBudgetAlarms(db);
    }
  } catch (err) {
    log.error("alert processing failed", err);
  }

  // Capture the git branch/commit of the project once, at session start.
  if (eventType === "SessionStart" && cwd) {
    scheduleGitUpdate(sessionId, cwd);
  }

  // At a turn boundary, refresh the session's real token usage from the transcript
  // (fire-and-forget; SessionEnd forces a final parse).
  if (
    (eventType === "Stop" || eventType === "SessionEnd") &&
    typeof payload.transcript_path === "string"
  ) {
    scheduleTranscriptUpdate(sessionId, payload.transcript_path, eventType === "SessionEnd");
  }

  return result;
}
