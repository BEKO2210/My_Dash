import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { getConfig, setConfig } from "@/lib/config";
import { migrate } from "@/lib/migrations";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

describe("config", () => {
  it("returns null for an unset key", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    expect(getConfig(db, "nope")).toBeNull();
  });

  it("sets and upserts a value", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    setConfig(db, "budget.daily", "5");
    expect(getConfig(db, "budget.daily")).toBe("5");
    setConfig(db, "budget.daily", "10");
    expect(getConfig(db, "budget.daily")).toBe("10");
  });
});
