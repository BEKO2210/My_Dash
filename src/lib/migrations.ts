import type Database from "better-sqlite3";
import { MIGRATIONS } from "./migrations-sql.mjs";

// The ordered, append-only schema lives in migrations-sql.mjs (plain JS) so the
// backfill script can share it. The (1-based) position of a migration is the
// schema version it brings the database to, tracked via SQLite's user_version.
export { MIGRATIONS };

// Apply any migrations the database hasn't seen yet. Each runs in a transaction
// together with the version bump, so a failure rolls back cleanly and leaves the
// version untouched. Returns the resulting schema version. Safe to call on boot.
export function migrate(db: Database.Database): number {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    const sql = MIGRATIONS[v];
    db.transaction(() => {
      db.exec(sql);
      // user_version takes a literal, not a bound parameter; v is a controlled index.
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  return MIGRATIONS.length;
}
