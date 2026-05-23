"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface SearchValue {
  query: string;
  setQuery: (q: string) => void;
}

const SearchContext = createContext<SearchValue>({ query: "", setQuery: () => {} });

// Dashboard-wide free-text filter. Widgets read `query` to narrow what they show;
// the header owns the input. Read-only — it only filters the view, never the data.
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
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
