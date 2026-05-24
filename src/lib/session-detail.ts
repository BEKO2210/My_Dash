import type Database from "better-sqlite3";
import type { EventRow, SessionRow, ToolCallRow } from "./types";

// Everything the /session/[id] detail page needs in one read: the session row,
// headline counts, and recent events / tool calls / prompts for that session.

export interface SessionPrompt {
  id: number;
  text: string | null;
  token_estimate: number;
  created_at: string;
}

export interface SessionDetail {
  session: SessionRow;
  eventCount: number;
  toolCount: number;
  failureCount: number;
  events: EventRow[]; // newest first
  tools: ToolCallRow[]; // newest first
  prompts: SessionPrompt[]; // newest first
}

export function sessionDetail(db: Database.Database, id: string, limit = 100): SessionDetail | null {
  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as SessionRow | undefined;
  if (!session) return null;

  const count = (sql: string) => (db.prepare(sql).get(id) as { n: number }).n;
  const eventCount = count(`SELECT COUNT(*) AS n FROM events WHERE session_id = ?`);
  const toolCount = count(`SELECT COUNT(*) AS n FROM tool_calls WHERE session_id = ?`);
  const failureCount = count(`SELECT COUNT(*) AS n FROM tool_calls WHERE session_id = ? AND success = 0`);

  const events = db
    .prepare(`SELECT * FROM events WHERE session_id = ? ORDER BY id DESC LIMIT ?`)
    .all(id, limit) as EventRow[];
  const tools = db
    .prepare(`SELECT * FROM tool_calls WHERE session_id = ? ORDER BY id DESC LIMIT ?`)
    .all(id, limit) as ToolCallRow[];
  const prompts = db
    .prepare(`SELECT id, text, token_estimate, created_at FROM prompts WHERE session_id = ? ORDER BY id DESC LIMIT ?`)
    .all(id, limit) as SessionPrompt[];

  return { session, eventCount, toolCount, failureCount, events, tools, prompts };
}
