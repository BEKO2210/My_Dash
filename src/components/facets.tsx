"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { EMPTY_FACETS, facetsActive, type Facets } from "@/lib/facets";

interface FacetValue extends Facets {
  setProject: (p: string) => void;
  setStatus: (s: string) => void;
  clear: () => void;
  active: boolean;
}

const FacetContext = createContext<FacetValue>({
  ...EMPTY_FACETS,
  setProject: () => {},
  setStatus: () => {},
  clear: () => {},
  active: false,
});

const KEY = "mc-facets";
const STATUSES = ["active", "waiting", "ended"];

// Dashboard-wide facets, synced to `?project=` / `?status=` (shareable, local)
// and localStorage. Default empty (render-safe), adopted after hydration.
export function FacetProvider({ children }: { children: React.ReactNode }) {
  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      let project = "";
      let status = "";
      try {
        const q = new URLSearchParams(window.location.search);
        project = q.get("project") ?? "";
        const s = q.get("status") ?? "";
        if (STATUSES.includes(s)) status = s;
      } catch {
        /* ignore */
      }
      if (!project && !status) {
        try {
          const raw = localStorage.getItem(KEY);
          if (raw) {
            const saved = JSON.parse(raw) as Partial<Facets>;
            if (typeof saved.project === "string") project = saved.project;
            if (typeof saved.status === "string" && STATUSES.includes(saved.status)) status = saved.status;
          }
        } catch {
          /* ignore */
        }
      }
      if (project || status) setFacets({ project, status });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const apply = useCallback((next: Facets) => {
    setFacets(next);
    try {
      if (!next.project && !next.status) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    try {
      const url = new URL(window.location.href);
      if (next.project) url.searchParams.set("project", next.project);
      else url.searchParams.delete("project");
      if (next.status) url.searchParams.set("status", next.status);
      else url.searchParams.delete("status");
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<FacetValue>(
    () => ({
      ...facets,
      setProject: (p: string) => apply({ ...facets, project: p }),
      setStatus: (s: string) => apply({ ...facets, status: s }),
      clear: () => apply(EMPTY_FACETS),
      active: facetsActive(facets),
    }),
    [facets, apply],
  );

  return <FacetContext.Provider value={value}>{children}</FacetContext.Provider>;
}

export function useFacets(): FacetValue {
  return useContext(FacetContext);
}
