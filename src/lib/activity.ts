import type Database from "better-sqlite3";

// Hour-granularity rollup of event counts (by type), updated at ingest so the
// heatmap and time-series widgets query the aggregate instead of scanning every
// event. Buckets are intentionally kept even after raw events are pruned.
export interface ActivityBucket {
  bucket: string; // "YYYY-MM-DD HH" (UTC)
  event_type: string;
  count: number;
}

// Reduce a SQLite/ISO timestamp to its UTC hour key.
export function hourBucket(ts: string): string {
  return ts.replace("T", " ").slice(0, 13);
}

export function recentActivity(db: Database.Database, limit: number): ActivityBucket[] {
  return db
    .prepare(
      `SELECT bucket, event_type, count FROM activity_buckets
       ORDER BY bucket DESC, event_type ASC
       LIMIT ?`,
    )
    .all(limit) as ActivityBucket[];
}
