"use client";

import { Activity, KanbanSquare, Coins, Boxes } from "lucide-react";
import { RadarLogo } from "@/components/radar-logo";
import { LangToggle } from "@/components/lang-toggle";
import { DownloadSection } from "@/components/download";
import { useT } from "@/lib/i18n";

const GITHUB = "https://github.com/BEKO2210/My_Dash";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

// Hero/landing shown above the live demo on the public site.
export function Landing() {
  const { t } = useT();
  const features = [
    { icon: Activity, title: t("landing.f1t"), desc: t("landing.f1d") },
    { icon: KanbanSquare, title: t("landing.f2t"), desc: t("landing.f2d") },
    { icon: Coins, title: t("landing.f3t"), desc: t("landing.f3d") },
    { icon: Boxes, title: t("landing.f4t"), desc: t("landing.f4d") },
  ];

  return (
    <section className="relative overflow-hidden border-b border-panel-border">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_72%_-12%,rgba(79,140,255,0.14),transparent_60%)]" />

      <div className="relative mx-auto max-w-[1100px] px-6 py-12 text-center sm:py-16">
        <div className="absolute right-5 top-5 flex items-center gap-2">
          <LangToggle />
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-panel-border bg-background/40 px-3 py-1 text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-foreground"
          >
            <GithubMark className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("landing.github")}</span>
          </a>
        </div>

        <span className="mc-fade-in inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
          <span className="mc-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {t("landing.badge")}
        </span>

        <div className="mx-auto mt-6 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-background ring-1 ring-accent/25">
          <RadarLogo className="h-12 w-12" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Claude Mission Control</h1>
        <p className="mt-3 text-base text-accent sm:text-lg">{t("landing.tagline")}</p>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          {t("landing.lead")}
        </p>

        <DownloadSection />

        <div className="mt-12 grid grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-panel-border bg-panel/60 p-4 transition-colors hover:border-accent/30"
            >
              <f.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-9 max-w-2xl text-xs leading-relaxed text-muted/80">{t("landing.how")}</p>
        <p className="mt-2 text-xs text-accent">{t("landing.demoNote")}</p>
        <p className="mt-7 text-[11px] uppercase tracking-[0.3em] text-muted/80">{t("landing.scroll")}</p>
      </div>
    </section>
  );
}
