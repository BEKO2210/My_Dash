"use client";

import { useT, type Lang } from "@/lib/i18n";

// Compact, professional DE/EN segmented switch for the header.
export function LangToggle() {
  const { lang, setLang, t } = useT();
  return (
    <div
      className="flex items-center overflow-hidden rounded-full border border-panel-border bg-background/40 text-[11px] font-medium"
      role="group"
      aria-label={t("a11y.language")}
      data-testid="lang-toggle"
    >
      {(["de", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2 py-1 uppercase tracking-wide transition-colors ${
            lang === l ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
