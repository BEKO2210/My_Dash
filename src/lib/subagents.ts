import type Database from "better-sqlite3";

// Subagent tree: every `Task` tool call records a parent→subagent link at ingest
// (session_links, kind='subagent'). We group those links by the spawning session
// to render a Session → subagents tree. Powers the subagent-tree widget.

export interface SubagentTask {
  id: number;
  label: string | null;
  child_session_id: string | null;
  tool_call_id: number | null;
  created_at: string;
}

export interface SubagentGroup {
  session_id: string;
  project: string;
  title: string | null;
  count: number;
  last_at: string;
  tasks: SubagentTask[];
}

interface LinkRow extends SubagentTask {
  parent_session_id: string;
  project: string;
  title: string | null;
}

export function subagentTree(db: Database.Database, limit = 200): SubagentGroup[] {
  const rows = db
    .prepare(
      `SELECT sl.id,
              sl.parent_session_id,
              sl.child_session_id,
              sl.tool_call_id,
              sl.label,
              sl.created_at,
              COALESCE(NULLIF(s.project_name, ''), '(unknown)') AS project,
              s.title
       FROM session_links sl
       LEFT JOIN sessions s ON s.id = sl.parent_session_id
       WHERE sl.kind = 'subagent'
       ORDER BY sl.id DESC
       LIMIT ?`,
    )
    .all(limit) as LinkRow[];

  const groups = new Map<string, SubagentGroup>();
  for (const r of rows) {
    let g = groups.get(r.parent_session_id);
    if (!g) {
      g = {
        session_id: r.parent_session_id,
        project: r.project,
        title: r.title,
        count: 0,
        last_at: r.created_at,
        tasks: [],
      };
      groups.set(r.parent_session_id, g);
    }
    g.tasks.push({
      id: r.id,
      label: r.label,
      child_session_id: r.child_session_id,
      tool_call_id: r.tool_call_id,
      created_at: r.created_at,
    });
    g.count += 1;
  }
  return [...groups.values()];
}
