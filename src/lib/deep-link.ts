// Helpers for URL-addressable (deep-linkable) dashboard state. Pure so the
// param-merging logic is unit-testable; providers call setParam to keep their
// slice of the query string in sync without clobbering the others.

// Return a query string (with leading "?", or "" when empty) where `key` is set
// to `value`, or removed when `value` is falsy.
export function setParam(search: string, key: string, value: string): string {
  const params = new URLSearchParams(search);
  if (value) params.set(key, value);
  else params.delete(key);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function getParam(search: string, key: string): string {
  return new URLSearchParams(search).get(key) ?? "";
}
