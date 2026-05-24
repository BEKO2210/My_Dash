"use client";

import { Mail, Phone, MapPin, BadgeCheck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { GithubMark } from "@/components/github-mark";
import { Avatar } from "@/components/avatar";
import { useT } from "@/lib/i18n";
import { CONTACT } from "@/lib/contact";

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <div className="flex items-center gap-3 rounded-xl border border-panel-border bg-panel/40 p-4 transition-colors hover:border-accent/40">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
        <p className="truncate text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer noopener" className="block">
      {body}
    </a>
  ) : (
    body
  );
}

export default function ContactPage() {
  const { t } = useT();
  return (
    <PageShell active="/contact">
      <div className="mc-fade-up flex flex-col gap-8">
        <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar size={84} />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("contact.title")}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{t("contact.lead")}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ContactRow icon={Mail} label={t("contact.emailLabel")} value={CONTACT.email} href={`mailto:${CONTACT.email}`} />
          <ContactRow icon={Phone} label={t("contact.phoneLabel")} value={CONTACT.phone} href={CONTACT.phoneHref} />
          <ContactRow icon={MapPin} label={t("contact.locationLabel")} value={`${CONTACT.city}, ${CONTACT.country}`} />
          <ContactRow icon={GithubMark} label={t("contact.githubLabel")} value="BEKO2210" href={CONTACT.github} />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
          <BadgeCheck className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-emerald-400/90">{t("contact.statusLabel")}</p>
            <p className="text-sm text-foreground">{t("about.status")}</p>
          </div>
        </div>

        <p className="text-xs text-muted">{t("contact.note")}</p>
      </div>
    </PageShell>
  );
}
