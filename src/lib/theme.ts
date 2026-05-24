// Token-based theming. Mode swaps the CSS-variable token set (dark/light);
// a custom accent overrides --accent inline. Pure (de)serialisation here so the
// validation is unit-testable; the provider applies it to <html>.

export type ThemeMode = "dark" | "light";

export interface Theme {
  mode: ThemeMode;
  accent: string; // #rrggbb
}

export const DEFAULT_ACCENT = "#4f8cff";
export const DEFAULT_THEME: Theme = { mode: "dark", accent: DEFAULT_ACCENT };

export const ACCENT_PRESETS = ["#4f8cff", "#22d3ee", "#34d399", "#a78bfa", "#f472b6", "#f59e0b"];

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function sanitizeTheme(raw: unknown): Theme {
  if (!raw || typeof raw !== "object") return DEFAULT_THEME;
  const o = raw as Record<string, unknown>;
  return {
    mode: o.mode === "light" ? "light" : "dark",
    accent: isHexColor(o.accent) ? o.accent : DEFAULT_ACCENT,
  };
}
