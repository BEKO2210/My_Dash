"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { GithubMark } from "@/components/github-mark";
import { Avatar } from "@/components/avatar";
import { useT } from "@/lib/i18n";
import { CONTACT } from "@/lib/contact";

const SKILLS = [
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Tailwind CSS",
  "Three.js",
  "SQLite",
  "Playwright",
  "Vitest",
  "CI/CD",
  "REST APIs",
  "UI/UX",
];

export default function AboutPage() {
  const { t } = useT();
  return (
    <PageShell active="/about">
      <div className="mc-fade-up flex flex-col gap-10">
        {/* Hero */}
        <section className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Avatar size={120} className="ring-2" />
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
              <span className="mc-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {t("footer.openToWork")}
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{CONTACT.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{t("about.lead")}</p>
          </div>
        </section>

        {/* Skills */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/80">{t("about.skillsTitle")}</h2>
          <ul className="flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <li
                key={s}
                className="rounded-full border border-panel-border bg-panel/60 px-3 py-1 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-foreground"
              >
                {s}
              </li>
            ))}
          </ul>
        </section>

        {/* Background + project */}
        <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-panel-border bg-panel/40 p-5">
            <h2 className="mb-2 text-base font-semibold text-foreground">{t("about.backgroundTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted">{t("about.backgroundBody")}</p>
          </article>
          <article className="rounded-xl border border-panel-border bg-panel/40 p-5">
            <h2 className="mb-2 text-base font-semibold text-foreground">{t("about.projectTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted">{t("about.projectBody")}</p>
          </article>
        </section>

        {/* CTAs */}
        <section className="flex flex-wrap gap-3">
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {t("about.ctaContact")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href={CONTACT.repo}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-lg border border-panel-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/50"
          >
            <GithubMark className="h-4 w-4" />
            {t("about.ctaProject")}
          </a>
        </section>
      </div>
    </PageShell>
  );
}
