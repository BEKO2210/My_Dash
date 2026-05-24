"use client";

import { Activity, KanbanSquare, Coins, Boxes, Timer, AlertTriangle, ImageIcon, ArrowRight, type LucideIcon } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useT } from "@/lib/i18n";
import { CONTACT } from "@/lib/contact";

type Feat = { icon: LucideIcon; t: string; d: string };

export default function FeaturesPage() {
  const { t } = useT();
  const features: Feat[] = [
    { icon: Activity, t: t("landing.f1t"), d: t("landing.f1d") },
    { icon: KanbanSquare, t: t("landing.f2t"), d: t("landing.f2d") },
    { icon: Coins, t: t("landing.f3t"), d: t("landing.f3d") },
    { icon: Boxes, t: t("landing.f4t"), d: t("landing.f4d") },
    { icon: Timer, t: t("features.f5t"), d: t("features.f5d") },
    { icon: AlertTriangle, t: t("features.f6t"), d: t("features.f6d") },
  ];

  return (
    <PageShell active="/features">
      <div className="mc-fade-up flex flex-col gap-12">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("features.title")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{t("features.lead")}</p>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.t}
              className="group rounded-xl border border-panel-border bg-panel/50 p-5 transition-colors hover:border-accent/30"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent transition-transform group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{f.t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{f.d}</p>
            </article>
          ))}
        </section>

        {/* Gallery — placeholders now; the CI gallery pipeline (Z-Shots) fills these. */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">{t("features.galleryTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("features.galleryLead")}</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-panel-border bg-panel/30 text-muted"
              >
                <span className="flex flex-col items-center gap-2 text-xs">
                  <ImageIcon className="h-6 w-6 opacity-60" />
                  {t("features.shotComing")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-panel-border bg-gradient-to-br from-panel/60 to-background p-8 text-center">
          <p className="text-base font-medium text-foreground">{t("landing.tagline")}</p>
          <a
            href={CONTACT.demo}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {t("features.ctaDemo")}
            <ArrowRight className="h-4 w-4" />
          </a>
        </section>
      </div>
    </PageShell>
  );
}
