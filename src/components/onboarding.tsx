"use client";

import { useCallback, useEffect, useState } from "react";
import { Rocket, Plug, Database, Compass, CheckCircle2, X } from "lucide-react";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";
import { ONBOARDED_KEY, shouldShowOnboarding } from "@/lib/onboarding";

const STEP_ICONS = [Rocket, Plug, Database, Compass, CheckCircle2];
const LAST = STEP_ICONS.length - 1;

function Cmd({ children }: { children: string }) {
  return <code className="rounded bg-background/70 px-1.5 py-0.5 text-[12px] text-accent">{children}</code>;
}

export function Onboarding() {
  const { t } = useT();
  const { connected, events } = useLive();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const finish = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  // First-run check (deferred a frame so it's hydration-safe), plus the
  // ?onboarding=1 force-open used by the Electron tray "Setup guide".
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(ONBOARDED_KEY) === "1";
      } catch {
        /* ignore */
      }
      const forced = new URLSearchParams(window.location.search).get("onboarding") === "1";
      if (shouldShowOnboarding({ dismissed, forced })) setOpen(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Re-open on demand (command palette dispatches this event).
  useEffect(() => {
    const reopen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("mc:open-onboarding", reopen);
    return () => window.removeEventListener("mc:open-onboarding", reopen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open) return null;

  const Icon = STEP_ICONS[step];
  const hasActivity = events.length > 0;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("onb.title")}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-panel-border bg-panel shadow-2xl shadow-black/50"
      >
        <header className="flex items-center justify-between border-b border-panel-border px-5 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon className="h-4 w-4 text-accent" />
            {t("onb.title")}
          </span>
          <button
            type="button"
            onClick={finish}
            aria-label={t("onb.skip")}
            className="rounded p-0.5 text-muted transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-[200px] px-5 py-5 text-sm text-foreground">
          {step === 0 && (
            <div className="space-y-2">
              <h2 className="text-base font-semibold">{t("onb.welcomeTitle")}</h2>
              <p className="text-muted">{t("onb.welcomeBody")}</p>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-2">
              <h2 className="text-base font-semibold">{t("onb.hooksTitle")}</h2>
              <p className="text-muted">{t("onb.hooksBody")}</p>
              <p>
                <Cmd>npm run install-hooks</Cmd>
              </p>
              <p className="flex items-center gap-1.5 text-[12px]">
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-500"}`} />
                {connected ? t("onb.connected") : t("onb.disconnected")}
              </p>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-2">
              <h2 className="text-base font-semibold">{t("onb.dataTitle")}</h2>
              <p className="text-muted">{t("onb.dataBody")}</p>
              <p className="flex flex-col gap-1">
                <Cmd>npm run seed</Cmd>
                <Cmd>npm run import-history</Cmd>
              </p>
              <p className="flex items-center gap-1.5 text-[12px]">
                {hasActivity ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    {events.length} {t("onb.events")}
                  </>
                ) : (
                  <span className="text-muted">{t("onb.waiting")}</span>
                )}
              </p>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-2">
              <h2 className="text-base font-semibold">{t("onb.tourTitle")}</h2>
              <ul className="space-y-1.5 text-muted">
                <li>• {t("onb.tour1")}</li>
                <li>• {t("onb.tour2")}</li>
                <li>• {t("onb.tour3")}</li>
                <li>• {t("onb.tour4")}</li>
              </ul>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-2">
              <h2 className="text-base font-semibold">{t("onb.doneTitle")}</h2>
              <p className="text-muted">{t("onb.doneBody")}</p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-panel-border px-5 py-3">
          <span className="flex items-center gap-1.5" aria-hidden>
            {STEP_ICONS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${i === step ? "bg-accent" : "bg-panel-border"}`}
              />
            ))}
          </span>
          <span className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-md px-3 py-1 text-[12px] text-muted transition-colors hover:text-foreground"
              >
                {t("onb.back")}
              </button>
            )}
            {step < LAST ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(LAST, s + 1))}
                className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-[12px] text-accent transition-colors hover:bg-accent/20"
              >
                {t("onb.next")}
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-[12px] text-accent transition-colors hover:bg-accent/20"
              >
                {t("onb.finish")}
              </button>
            )}
          </span>
        </footer>
      </div>
    </div>
  );
}
