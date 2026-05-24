// Shared dashboard time range. Widgets that aggregate over a window read the
// active range (via the TimeRange context) and pass its `days` to their API.
// Kept pure here so the mapping is unit-testable; the context owns URL/storage.

export type TimeRange = "24h" | "7d" | "30d" | "90d" | "all";

export const TIME_RANGES: TimeRange[] = ["24h", "7d", "30d", "90d", "all"];

export function isTimeRange(value: unknown): value is TimeRange {
  return typeof value === "string" && (TIME_RANGES as string[]).includes(value);
}

// Days the range spans; "all" is a large bound that API routes clamp as needed.
export function rangeToDays(range: TimeRange): number {
  switch (range) {
    case "24h":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "all":
      return 3650;
  }
}

// Inclusive lower bound as a SQLite-style UTC timestamp, or null for "all".
export function rangeSinceIso(range: TimeRange, now: Date = new Date()): string | null {
  if (range === "all") return null;
  const ms = now.getTime() - rangeToDays(range) * 86_400_000;
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}
