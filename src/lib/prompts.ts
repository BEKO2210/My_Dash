import type Database from "better-sqlite3";

// Prompt history: the redacted + capped prompt rows captured at ingest time
// (one per UserPromptSubmit), newest first, enriched with the project name.
// Powers the prompt-history widget.
export interface PromptHistoryItem {
  id: number;
  session_id: string;
  project: string;
  text: string;
  token_estimate: number;
  created_at: string;
}

export function promptHistory(db: Database.Database, limit = 100): PromptHistoryItem[] {
  return db
    .prepare(
      `SELECT p.id,
              p.session_id,
              COALESCE(NULLIF(s.project_name, ''), '(unknown)') AS project,
              p.text,
              p.token_estimate,
              p.created_at
       FROM prompts p
       LEFT JOIN sessions s ON s.id = p.session_id
       ORDER BY p.id DESC
       LIMIT ?`,
    )
    .all(limit) as PromptHistoryItem[];
}
