"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { LiveProvider, useLive } from "@/components/live-provider";
import { RadarLogo } from "@/components/radar-logo";
import { LangToggle } from "@/components/lang-toggle";
import { InfoHint } from "@/components/info-hint";
import { WidgetErrorBoundary } from "@/components/error-boundary";
import { Landing } from "@/components/landing";
import { useT } from "@/lib/i18n";
import { DEMO, installDemoBackend } from "@/lib/demo";
import { widgets } from "@/plugins/registry";

// In the static demo build, start the in-browser engine + patch fetch before any
// widget mounts. No-op in the real (server-backed) app.
if (DEMO) installDemoBackend();

export function Dashboard() {
  const { t } = useT();
  return (
    <LiveProvider>
      {DEMO && <Landing />}
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4 sm:p-6 min-[2560px]:max-w-none min-[2560px]:gap-6 min-[2560px]:p-8 min-[3840px]:gap-8 min-[3840px]:p-12">
        <Header />
        <div className="grid grid-cols-1 gap-4 min-[2560px]:gap-6 min-[3840px]:gap-8 lg:grid-cols-6">
          {widgets.map((w, i) => (
            <div
              key={w.id}
              // The 3D graph goes fullscreen via position:fixed, which breaks if an
              // ancestor has a transform. So its cell uses an opacity-only entrance
              // (no transform) while the others keep the subtle rise.
              className={`${w.id === "tool-graph" ? "mc-fade-in" : "mc-fade-up"} ${w.span} ${w.height}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <WidgetErrorBoundary
                label={w.title}
                couldNotLoad={t("error.couldNotLoad")}
                genericText={t("error.generic")}
                retryLabel={t("common.retry")}
              >
                <w.component />
              </WidgetErrorBoundary>
            </div>
          ))}
        </div>
        <footer className="pt-2 text-center text-[11px] text-muted/60">
          {t("footer.text")} · <span className="text-muted">by Belkis Aslani</span>
        </footer>
      </div>
    </LiveProvider>
  );
}

function Header() {
  const { connected, events } = useLive();
  const { t, lang } = useT();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString(lang === "en" ? "en-GB" : "de-DE"));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lang]);

  return (
    <header className="mc-fade-in flex items-center justify-between rounded-xl border border-panel-border bg-panel/60 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/80 ring-1 ring-accent/25">
          <RadarLogo className="h-7 w-7" />
        </span>
        <div>
          <h1 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
            Claude Mission Control
            <InfoHint align="left" text={t("header.info")} />
          </h1>
          <p className="text-[11px] text-muted">{t("header.subtitle")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted sm:gap-2.5">
        <LangToggle />
        <span className="hidden font-mono tabular-nums sm:inline">{clock}</span>
        <span className="hidden items-center gap-1 rounded-full border border-panel-border bg-background/40 px-2.5 py-1 tabular-nums sm:flex">
          <Activity className="h-3 w-3 text-accent" />
          {events.length}
          <InfoHint text={t("header.eventsInfo")} align="right" />
        </span>
        <span
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors ${
            connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          <span
            className={`mc-live-dot h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-500"}`}
          />
          {connected ? t("header.connected") : t("header.disconnected")}
        </span>
      </div>
    </header>
  );
}
