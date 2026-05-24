import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { ftsQuery, searchFts } from "@/lib/search-index";

describe("ftsQuery", () => {
  it("builds AND-ed quoted prefix terms", () => {
    expect(ftsQuery("ingest pipeline")).toBe('"ingest"* "pipeline"*');
  });

  it("strips punctuation that would break MATCH", () => {
    expect(ftsQuery('foo: "bar" (baz)')).toBe('"foo"* "bar"* "baz"*');
  });

  it("returns null when nothing is searchable", () => {
    expect(ftsQuery("")).toBeNull();
    expect(ftsQuery("!!! ??? ...")).toBeNull();
  });
});

describe("searchFts", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
  });

  function seed(): Database.Database {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const ins = db.prepare(
      `INSERT INTO search_fts (text, kind, ref_id, session_id) VALUES (?, ?, ?, ?)`,
    );
    ins.run("Refactor the ingest pipeline", "event", 1, "s1");
    ins.run("Fix the sankey chart colors", "event", 2, "s2");
    ins.run("add retention tests", "prompt", 3, "s1");
    return db;
  }

  it("matches by prefix across sources", () => {
    const hits = searchFts(seed(), "ingest");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: "event", session_id: "s1" });
  });

  it("requires all terms (AND)", () => {
    expect(searchFts(seed(), "sankey colors")).toHaveLength(1);
    expect(searchFts(seed(), "sankey ingest")).toHaveLength(0);
  });

  it("returns nothing for an empty or junk query", () => {
    expect(searchFts(seed(), "")).toEqual([]);
    expect(searchFts(seed(), "@@@")).toEqual([]);
  });
});
