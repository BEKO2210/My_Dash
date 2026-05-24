"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useT } from "@/lib/i18n";
import { asset } from "@/lib/asset";
import { CONTACT } from "@/lib/contact";
import { WIDGET_DOCS, CATEGORY_ORDER, CATEGORY_LABEL, SETTINGS_DOCS } from "@/lib/widget-catalog";

function Shot({ src, label }: { src: string; label: string }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-panel-border bg-background/40">
      <div className="border-b border-panel-border px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted">{label}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="w-full" loading="lazy" />
    </figure>
  );
}

export default function FeaturesPage() {
  const { t, lang } = useT();
  const de = lang !== "en";
  const L = (deStr: string, enStr: string) => (de ? deStr : enStr);

  return (
    <PageShell active="/features">
      <div className="mc-fade-up flex flex-col gap-12">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("features.title")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{t("features.lead")}</p>
          <Link
            href="/docs"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-panel-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-foreground"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {L("Plugins erstellen & API — zur Doku", "Build plugins & the API — see the docs")}
          </Link>
        </header>

        {/* All widgets, grouped by category, each with a real populated + empty screenshot. */}
        <section className="flex flex-col gap-10">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{L("Alle Widgets", "All widgets")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              {L(
                "Echte Screenshots aus dem Dashboard — jedes Widget befüllt und im Leerzustand, mit kurzer Erklärung.",
                "Real screenshots from the dashboard — every widget populated and empty, with a short explanation.",
              )}
            </p>
          </div>

          {CATEGORY_ORDER.map((cat) => {
            const items = WIDGET_DOCS.filter((w) => w.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="flex flex-col gap-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent">
                  {de ? CATEGORY_LABEL[cat].de : CATEGORY_LABEL[cat].en}
                  <span className="text-[11px] font-normal text-muted">({items.length})</span>
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {items.map((w) => (
                    <article key={w.id} className="rounded-xl border border-panel-border bg-panel/40 p-4">
                      <h4 className="text-sm font-semibold text-foreground">{t(w.titleKey)}</h4>
                      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">{t(w.infoKey)}</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Shot src={asset(`/docs/widgets/${w.id}.png`)} label={L("Befüllt", "Populated")} />
                        <Shot src={asset(`/docs/widgets/${w.id}-empty.png`)} label={L("Leerzustand", "Empty state")} />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* Settings */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{L("Einstellungen", "Settings")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              {L(
                "Alles, was du am Dashboard anpassen kannst. Einstellungen werden lokal im Browser gespeichert.",
                "Everything you can tweak on the dashboard. Settings are stored locally in your browser.",
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SETTINGS_DOCS.map((s) => (
              <article key={s.en.name} className="rounded-xl border border-panel-border bg-panel/40 p-4">
                <h4 className="text-sm font-semibold text-foreground">{de ? s.de.name : s.en.name}</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted">{de ? s.de.desc : s.en.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-panel-border bg-gradient-to-br from-panel/60 to-background p-8 text-center">
          <p className="text-base font-medium text-foreground">{t("landing.tagline")}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <a
              href={CONTACT.demo}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {t("features.ctaDemo")}
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center gap-1.5 rounded-lg border border-panel-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent/50"
            >
              <BookOpen className="h-4 w-4" />
              Plugins &amp; API
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
