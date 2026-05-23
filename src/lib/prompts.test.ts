import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { promptHistory } from "@/lib/prompts";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

function seed(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  db.prepare(`INSERT INTO sessions (id, project_name) VALUES (?, ?)`).run("s1", "alpha");
  db.prepare(`INSERT INTO sessions (id, project_name) VALUES (?, ?)`).run("s2", null);
  const ins = db.prepare(
    `INSERT INTO prompts (session_id, event_id, text, token_estimate) VALUES (?, ?, ?, ?)`,
  );
  ins.run("s1", 1, "first prompt", 3);
  ins.run("s1", 2, "second prompt", 5);
  ins.run("s2", 3, "orphan project prompt", 0);
  return db;
}

describe("promptHistory", () => {
  it("returns prompts newest first with the project name", () => {
    const rows = promptHistory(seed());
    expect(rows.map((r) => r.text)).toEqual([
      "orphan project prompt",
      "second prompt",
      "first prompt",
    ]);
    expect(rows.find((r) => r.text === "first prompt")!.project).toBe("alpha");
  });

  it("labels null project names as (unknown)", () => {
    const rows = promptHistory(seed());
    expect(rows.find((r) => r.text === "orphan project prompt")!.project).toBe("(unknown)");
  });

  it("respects the limit", () => {
    expect(promptHistory(seed(), 1)).toHaveLength(1);
  });
});
