import type Database from "better-sqlite3";

// Per-project reliability: share of tool calls that succeeded. Joined via session
// → project. Powers the reliability-per-project widget. Surfaces which projects
// are error-prone rather than a single server-wide average.

export interface ProjectReliability {
  project: string;
  total: number;
  failures: number;
  successRate: number; // 0..1
}

export function projectReliability(db: Database.Database, limit = 100): ProjectReliability[] {
  const rows = db
    .prepare(
      `SELECT COALESCE(NULLIF(s.project_name, ''), '(unknown)') AS project,
              COUNT(*) AS total,
              SUM(CASE WHEN tc.success = 0 THEN 1 ELSE 0 END) AS failures
       FROM tool_calls tc
       JOIN sessions s ON s.id = tc.session_id
       GROUP BY project
       ORDER BY total DESC, project ASC
       LIMIT ?`,
    )
    .all(limit) as { project: string; total: number; failures: number }[];

  return rows.map((r) => ({
    ...r,
    successRate: r.total ? (r.total - r.failures) / r.total : 1,
  }));
}
