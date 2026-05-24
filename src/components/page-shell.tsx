"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RadarLogo } from "@/components/radar-logo";
import { LangToggle } from "@/components/lang-toggle";
import { SiteFooter } from "@/components/site-footer";
import { useT } from "@/lib/i18n";

const NAV = [
  { href: "/features", key: "nav.features" },
  { href: "/docs", key: "nav.docs" },
  { href: "/about", key: "nav.about" },
  { href: "/contact", key: "nav.contact" },
] as const;

// Chrome for the standalone marketing/legal pages: a sticky top bar with brand +
// nav + language toggle, the page content, and the shared site footer.
export function PageShell({ active, children }: { active?: string; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-panel-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <Link href="/" className="group flex items-center gap-2 text-foreground">
            <RadarLogo className="h-6 w-6 transition-transform group-hover:scale-110" />
            <span className="text-sm font-semibold tracking-tight">Claude Mission Control</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-md px-2.5 py-1 text-[12px] transition-colors hover:text-foreground ${
                  active === n.href ? "text-foreground" : "text-muted"
                }`}
              >
                {t(n.key)}
              </Link>
            ))}
            <span className="mx-1 hidden h-4 w-px bg-panel-border sm:block" />
            <LangToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-10 sm:px-6 sm:py-14">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("nav.backHome")}
        </Link>
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
