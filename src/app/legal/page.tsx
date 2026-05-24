"use client";

import { useT } from "@/lib/i18n";
import { PageShell } from "@/components/page-shell";
import { CONTACT } from "@/lib/contact";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-panel-border bg-panel/40 p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function LegalPage() {
  const { t } = useT();
  return (
    <PageShell>
      <div className="mc-fade-up flex flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("legal.title")}</h1>

        <Section id="impressum" title={t("legal.impressumTitle")}>
          <p className="text-xs uppercase tracking-wide text-muted/80">{t("legal.impressumIntro")}</p>
          <p className="pt-1 font-medium text-foreground">{t("legal.responsible")}</p>
          <p>{CONTACT.name}</p>
          <p>
            {CONTACT.city}, {CONTACT.country}
          </p>
          <p className="pt-2 font-medium text-foreground">{t("legal.contactTitle")}</p>
          <p>
            <a href={`mailto:${CONTACT.email}`} className="hover:text-foreground">
              {CONTACT.email}
            </a>
          </p>
          <p>
            <a href={CONTACT.phoneHref} className="hover:text-foreground">
              {CONTACT.phone}
            </a>
          </p>
        </Section>

        <Section id="datenschutz" title={t("legal.privacyTitle")}>
          <p>{t("legal.privacyIntro")}</p>
          <p>{t("legal.privacyClient")}</p>
          <p>{t("legal.privacyHosting")}</p>
        </Section>

        <Section id="haftung" title={t("legal.disclaimerTitle")}>
          <p>{t("legal.disclaimerBody")}</p>
        </Section>
      </div>
    </PageShell>
  );
}
