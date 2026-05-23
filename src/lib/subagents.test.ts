import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { subagentTree } from "@/lib/subagents";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

function seed(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  db.prepare(`INSERT INTO sessions (id, project_name, title) VALUES (?, ?, ?)`).run("p1", "alpha", "Build feature");
  db.prepare(`INSERT INTO sessions (id, project_name, title) VALUES (?, ?, ?)`).run("p2", null, null);
  const ins = db.prepare(
    `INSERT INTO session_links (parent_session_id, child_session_id, tool_call_id, kind, label)
     VALUES (?, ?, ?, ?, ?)`,
  );
  ins.run("p1", null, 10, "subagent", "Explore: find auth code");
  ins.run("p1", null, 11, "subagent", "Plan: design API");
  ins.run("p2", null, 12, "subagent", "general-purpose");
  ins.run("p1", null, 13, "other", "not a subagent"); // filtered out
  return db;
}

describe("subagentTree", () => {
  it("groups subagent links by spawning session", () => {
    const groups = subagentTree(seed());
    const p1 = groups.find((g) => g.session_id === "p1")!;
    expect(p1.count).toBe(2);
    expect(p1.project).toBe("alpha");
    expect(p1.title).toBe("Build feature");
    expect(p1.tasks.map((t) => t.label)).toContain("Plan: design API");
  });

  it("only includes subagent-kind links and labels unknown projects", () => {
    const groups = subagentTree(seed());
    const p2 = groups.find((g) => g.session_id === "p2")!;
    expect(p2.project).toBe("(unknown)");
    expect(p2.count).toBe(1);
    // The 'other'-kind link on p1 must not be counted.
    expect(groups.find((g) => g.session_id === "p1")!.count).toBe(2);
  });

  it("returns an empty array when there are no links", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    expect(subagentTree(db)).toEqual([]);
  });
});
