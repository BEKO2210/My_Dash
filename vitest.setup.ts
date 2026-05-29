import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Give each vitest worker its own throwaway data dir so the singleton db in
// src/lib/db.ts never touches the real ./data file — and so parallel workers
// don't race on the same SQLite file during migrate() (which manifested as
// "duplicate column name" once vitest 4 ran more files in parallel).
// Tests that need their own isolated db (e.g. ingest.test.ts) still override
// MC_DATA_DIR before a dynamic import; this only sets a default when unset.
if (!process.env.MC_DATA_DIR) {
  process.env.MC_DATA_DIR = mkdtempSync(path.join(tmpdir(), "mc-vitest-"));
}
