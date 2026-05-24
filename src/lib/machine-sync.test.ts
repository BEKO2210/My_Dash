import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { mergeSessions, readSessionsForSync } from "@/lib/machine-sync";
import { migrate } from "@/lib/migrations";

let primary: Database.Database | null = null;
let secondary: Database.Database | null = null;
afterEach(() => {
  primary?.close();
  secondary?.close();
  primary = secondary = null;
});

function fresh(): Database.Database {
  const db = new Database(":memory:");
  migrate(db);
  return db;
}

function insertSession(db: Database.Database, id: string, over: Record<string, unknown> = {}) {
  const row = {
    id,
    project_path: "/p",
    project_name: "proj",
    title: `t-${id}`,
    status: "ended",
    source: "demo",
    first_seen: "2026-05-24 10:00:00",
    last_seen: "2026-05-24 11:00:00",
    ended_at: "2026-05-24 11:00:00",
    token_input: 100,
    token_output: 50,
    token_cache: 10,
    cost_usd: 0.5,
    ...over,
  };
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO sessions (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(
    ...cols.map((c) => (row as Record<string, unknown>)[c]),
  );
}

describe("machine sync", () => {
  it("reads sessions from a source DB", () => {
    secondary = fresh();
    insertSession(secondary, "a");
    insertSession(secondary, "b");
    const rows = readSessionsForSync(secondary);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("merges source sessions in, tagged with the machine label", () => {
    primary = fresh();
    secondary = fresh();
    insertSession(primary, "local-1"); // local row stays NULL machine
    insertSession(secondary, "remote-1", { cost_usd: 2 });
    insertSession(secondary, "remote-2");

    const res = mergeSessions(primary, readSessionsForSync(secondary), "laptop");
    expect(res).toEqual({ inserted: 2, updated: 0 });

    const tagged = primary.prepare(`SELECT id, machine, cost_usd FROM sessions ORDER BY id`).all() as {
      id: string;
      machine: string | null;
      cost_usd: number;
    }[];
    expect(tagged).toEqual([
      { id: "local-1", machine: null, cost_usd: 0.5 },
      { id: "remote-1", machine: "laptop", cost_usd: 2 },
      { id: "remote-2", machine: "laptop", cost_usd: 0.5 },
    ]);
  });

  it("is idempotent: re-syncing updates instead of duplicating", () => {
    primary = fresh();
    secondary = fresh();
    insertSession(secondary, "remote-1", { cost_usd: 1 });
    mergeSessions(primary, readSessionsForSync(secondary), "laptop");

    // Source row changes, sync again.
    secondary.prepare(`UPDATE sessions SET cost_usd = 9 WHERE id = 'remote-1'`).run();
    const res = mergeSessions(primary, readSessionsForSync(secondary), "laptop");
    expect(res).toEqual({ inserted: 0, updated: 1 });

    const n = primary.prepare(`SELECT COUNT(*) AS n FROM sessions`).get() as { n: number };
    expect(n.n).toBe(1);
    const cost = primary.prepare(`SELECT cost_usd FROM sessions WHERE id = 'remote-1'`).get() as { cost_usd: number };
    expect(cost.cost_usd).toBe(9);
  });
});
