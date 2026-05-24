"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_ACCENT, DEFAULT_THEME, sanitizeTheme, type Theme, type ThemeMode } from "@/lib/theme";

const KEY = "mc-theme";

interface ThemeValue extends Theme {
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: string) => void;
}

const ThemeContext = createContext<ThemeValue>({
  ...DEFAULT_THEME,
  setMode: () => {},
  setAccent: () => {},
});

function applyTheme(t: Theme) {
  const el = document.documentElement;
  el.setAttribute("data-theme", t.mode);
  if (t.accent && t.accent !== DEFAULT_ACCENT) el.style.setProperty("--accent", t.accent);
  else el.style.removeProperty("--accent");
}

// Applies the saved theme to <html> after hydration and persists changes. Default
// (dark + default accent) matches the CSS :root, so the first paint is correct.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      let t = DEFAULT_THEME;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) t = sanitizeTheme(JSON.parse(raw));
      } catch {
        /* ignore */
      }
      setTheme(t);
      applyTheme(t);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const update = useCallback((next: Theme) => {
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      ...theme,
      setMode: (mode) => update({ ...theme, mode }),
      setAccent: (accent) => update({ ...theme, accent }),
    }),
    [theme, update],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
