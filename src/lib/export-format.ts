// Pure serializers for the data-export feature: JSON and RFC 4180 CSV. Kept free of
// any DB or browser dependency so they're trivially testable and reusable by the
// /api/export route and the export scripts.

export function toJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  // Objects/arrays are serialized as JSON so a cell never breaks the row shape.
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Quote when the value contains a comma, quote, CR or LF; escape quotes by doubling.
  if (/[",\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

// Serialize an array of records to CSV. Columns default to the union of keys across
// rows (first-seen order), so heterogeneous rows still line up. Always ends with a
// trailing newline; an empty input yields just the header (or "" when no columns).
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? inferColumns(rows);
  if (cols.length === 0) return "";
  const header = cols.map(csvCell).join(",");
  const body = rows.map((row) => cols.map((c) => csvCell(row[c])).join(","));
  return [header, ...body].join("\r\n") + "\r\n";
}

function inferColumns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const k of Object.keys(row)) seen.add(k);
  return [...seen];
}
