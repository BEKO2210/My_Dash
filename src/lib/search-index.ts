import type Database from "better-sqlite3";

// Full-text search over event summaries + prompts (FTS5 `search_fts`). User input
// is tokenised into prefix terms so arbitrary characters can't break MATCH syntax.

export interface SearchHit {
  kind: string; // "event" | "prompt"
  ref_id: number;
  session_id: string;
  text: string;
}

// Build a safe FTS5 MATCH expression: each word becomes a quoted prefix term,
// AND-ed together. Returns null when there's nothing searchable.
export function ftsQuery(input: string): string | null {
  const tokens = input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" ");
}

export function searchFts(db: Database.Database, input: string, limit = 20): SearchHit[] {
  const q = ftsQuery(input);
  if (!q) return [];
  try {
    return db
      .prepare(
        `SELECT text, kind, ref_id, session_id
         FROM search_fts
         WHERE search_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(q, limit) as SearchHit[];
  } catch {
    return []; // malformed query / missing FTS — degrade to no results
  }
}
