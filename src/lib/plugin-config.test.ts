import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { getAllPluginConfig, getPluginConfig, setPluginConfig } from "@/lib/plugin-config";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

function fresh(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  return db;
}

describe("plugin-config", () => {
  it("round-trips a config object", () => {
    const db = fresh();
    setPluginConfig(db, "live-stream", { limit: 50, dense: true });
    expect(getPluginConfig(db, "live-stream")).toEqual({ limit: 50, dense: true });
  });

  it("upserts (replaces) on the same plugin id", () => {
    const db = fresh();
    setPluginConfig(db, "x", { a: 1 });
    setPluginConfig(db, "x", { a: 2, b: 3 });
    expect(getPluginConfig(db, "x")).toEqual({ a: 2, b: 3 });
  });

  it("returns {} for unknown ids", () => {
    expect(getPluginConfig(fresh(), "nope")).toEqual({});
  });

  it("collects all configs as a map", () => {
    const db = fresh();
    setPluginConfig(db, "a", { x: 1 });
    setPluginConfig(db, "b", { y: 2 });
    expect(getAllPluginConfig(db)).toEqual({ a: { x: 1 }, b: { y: 2 } });
  });
});
