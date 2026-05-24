"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getParam, setParam } from "@/lib/deep-link";

interface SearchValue {
  query: string;
  setQuery: (q: string) => void;
}

const SearchContext = createContext<SearchValue>({ query: "", setQuery: () => {} });

// Dashboard-wide free-text filter. Widgets read `query` to narrow what they show;
// the header owns the input. Read-only — it only filters the view, never the data.
// The query is URL-addressable (?q=) so a filtered view is shareable/deep-linkable.
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQueryState] = useState("");

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const q = getParam(window.location.search, "q");
        if (q) setQueryState(q);
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    try {
      const next = setParam(window.location.search, "q", q.trim());
      window.history.replaceState(null, "", `${window.location.pathname}${next}`);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ query, setQuery }), [query, setQuery]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchValue {
  return useContext(SearchContext);
}

// Shared matcher so every widget filters identically (case-insensitive substring).
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}
