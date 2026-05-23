import type Database from "better-sqlite3";

// Generic key/value app config (e.g. budget limits). Plugin settings live in their
// own table later; this is for first-class app settings.
export function getConfig(db: Database.Database, key: string): string | null {
  const row = db.prepare(`SELECT value FROM config WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

export function setConfig(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO config (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}
