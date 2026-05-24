"use client";

import Link from "next/link";
import { Mail, Phone, MapPin, ArrowUpRight } from "lucide-react";
import { RadarLogo } from "@/components/radar-logo";
import { GithubMark } from "@/components/github-mark";
import { Avatar } from "@/components/avatar";
import { useT } from "@/lib/i18n";
import { CONTACT } from "@/lib/contact";

function FootLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const cls =
    "group/link inline-flex w-fit items-center gap-1 text-[12px] text-muted transition-colors hover:text-foreground";
  const inner = (
    <>
      <span className="relative">
        {children}
        <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-300 group-hover/link:w-full" />
      </span>
      {external && <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover/link:opacity-100" />}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">{title}</h3>
      {children}
    </div>
  );
}

// Compact, animated site footer. Shared by the dashboard and the standalone pages.
export function SiteFooter() {
  const { t } = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-6 border-t border-panel-border bg-panel/40">
      {/* animated accent sheen on the top hairline */}
      <div aria-hidden className="mc-footer-sheen pointer-events-none absolute inset-x-0 -top-px h-px" />

      <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-x-6 gap-y-7 px-5 py-7 sm:px-6 md:grid-cols-4 lg:grid-cols-[1.6fr_1fr_1fr_1.4fr]">
        {/* Brand */}
        <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
          <Link href="/" className="group flex items-center gap-2 text-foreground">
            <RadarLogo className="h-6 w-6 transition-transform group-hover:scale-110" />
            <span className="text-sm font-semibold tracking-tight">Claude Mission Control</span>
          </Link>
          <p className="max-w-xs text-[12px] leading-relaxed text-muted">{t("footer.tagline")}</p>
          <div className="mt-1 flex items-center gap-2">
            <a
              href={CONTACT.repo}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="GitHub"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-panel-border text-muted transition-colors hover:border-accent/50 hover:text-foreground"
            >
              <GithubMark className="h-4 w-4" />
            </a>
            <a
              href={`mailto:${CONTACT.email}`}
              aria-label={t("contact.emailLabel")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-panel-border text-muted transition-colors hover:border-accent/50 hover:text-foreground"
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Product */}
        <Column title={t("footer.product")}>
          <FootLink href="/">{t("nav.dashboard")}</FootLink>
          <FootLink href="/features">{t("nav.features")}</FootLink>
          <FootLink href={CONTACT.demo} external>
            {t("nav.demo")}
          </FootLink>
          <FootLink href={CONTACT.repo} external>
            {t("nav.github")}
          </FootLink>
        </Column>

        {/* Resources / Legal */}
        <Column title={t("footer.legal")}>
          <FootLink href="/about">{t("nav.about")}</FootLink>
          <FootLink href="/contact">{t("nav.contact")}</FootLink>
          <FootLink href="/legal#impressum">{t("nav.impressum")}</FootLink>
          <FootLink href="/legal#datenschutz">{t("nav.privacy")}</FootLink>
        </Column>

        {/* Author card */}
        <div className="col-span-2 flex items-start gap-3 rounded-xl border border-panel-border bg-background/40 p-3 md:col-span-1">
          <Avatar size={52} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{CONTACT.name}</p>
            <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <span className="mc-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {t("footer.openToWork")}
            </span>
            <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted">
              <a href={`mailto:${CONTACT.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                <Mail className="h-3 w-3" /> {CONTACT.email}
              </a>
              <a href={CONTACT.phoneHref} className="inline-flex items-center gap-1.5 hover:text-foreground">
                <Phone className="h-3 w-3" /> {CONTACT.phone}
              </a>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> {CONTACT.city}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-panel-border/60">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-1.5 px-5 py-3 text-center text-[11px] text-muted sm:flex-row sm:px-6 sm:text-left">
          <span>
            © <span suppressHydrationWarning>{year}</span> {CONTACT.name}. {t("footer.rights")}
          </span>
          <span className="text-muted/80">{t("footer.text")}</span>
        </div>
      </div>
    </footer>
  );
}
