import type Database from "better-sqlite3";

// Most-touched files (hotspots) from file_edits: edit count + line churn. Treemap
// data — size by churn, color by churn.
export interface FileHotspot {
  path: string;
  name: string; // last path segment
  edits: number;
  added: number;
  removed: number;
  churn: number; // added + removed
}

export function fileHotspots(
  db: Database.Database,
  limit = 40,
  sinceIso: string | null = null,
): FileHotspot[] {
  const cond = sinceIso ? "WHERE created_at >= ?" : "";
  const params = sinceIso ? [sinceIso, limit] : [limit];
  const rows = db
    .prepare(
      `SELECT path,
              COUNT(*)     AS edits,
              SUM(added)   AS added,
              SUM(removed) AS removed
       FROM file_edits
       ${cond}
       GROUP BY path
       ORDER BY SUM(added) + SUM(removed) DESC, edits DESC
       LIMIT ?`,
    )
    .all(...params) as { path: string; edits: number; added: number; removed: number }[];
  return rows.map((r) => ({
    ...r,
    name: r.path.split("/").filter(Boolean).pop() ?? r.path,
    churn: r.added + r.removed,
  }));
}
