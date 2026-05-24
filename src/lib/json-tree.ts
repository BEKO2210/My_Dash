// Pure helpers for the collapsible JSON tree viewer: classify a value and render
// a short summary (collapsed containers show their size; primitives render inline).

export type JsonKind = "object" | "array" | "string" | "number" | "boolean" | "null";

export function valueKind(value: unknown): JsonKind {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "object") return "object";
  if (t === "number") return "number";
  if (t === "boolean") return "boolean";
  return "string";
}

export function isExpandable(value: unknown): boolean {
  const k = valueKind(value);
  if (k === "array") return (value as unknown[]).length > 0;
  if (k === "object") return Object.keys(value as object).length > 0;
  return false;
}

// Collapsed-container summary ("{3}", "[5]") or a short primitive rendering.
export function nodeSummary(value: unknown): string {
  const k = valueKind(value);
  if (k === "array") return `[${(value as unknown[]).length}]`;
  if (k === "object") return `{${Object.keys(value as object).length}}`;
  if (k === "string") return JSON.stringify(value);
  if (k === "null") return value === undefined ? "undefined" : "null";
  return String(value);
}
