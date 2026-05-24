// Dashboard-wide facet filter (project + session status). Read-only over the
// data — widgets narrow what they render. Pure matcher kept here so it's testable;
// the context owns URL/storage and which controls are shown.

export interface Facets {
  project: string; // "" = any
  status: string; // "" = any (active | waiting | ended)
}

export const EMPTY_FACETS: Facets = { project: "", status: "" };

export function facetsActive(f: Facets): boolean {
  return Boolean(f.project || f.status);
}

export function sessionMatchesFacets(
  session: { project_name: string | null; status: string },
  f: Facets,
): boolean {
  if (f.project && (session.project_name ?? "") !== f.project) return false;
  if (f.status && session.status !== f.status) return false;
  return true;
}
