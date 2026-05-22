"use client";

import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { LiveProvider, useLive } from "@/components/live-provider";
import { LockProvider } from "@/components/lock-provider";
import { LockButton } from "@/components/lock-controls";
import { InfoHint } from "@/components/info-hint";
import { WidgetErrorBoundary } from "@/components/error-boundary";
import { widgets } from "@/plugins/registry";

export function Dashboard() {
  return (
    <LockProvider>
      <LiveProvider>
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4 sm:p-6 min-[2560px]:max-w-none min-[2560px]:gap-6 min-[2560px]:p-8 min-[3840px]:gap-8 min-[3840px]:p-12">
        <Header />
        <div className="grid grid-cols-1 gap-4 min-[2560px]:gap-6 min-[3840px]:gap-8 lg:grid-cols-6">
          {widgets.map((w) => (
            <div key={w.id} className={`${w.span} ${w.height}`}>
              <WidgetErrorBoundary label={w.title}>
                <w.component />
              </WidgetErrorBoundary>
            </div>
          ))}
        </div>
        <footer className="pt-2 text-center text-[11px] text-muted/60">
          read-only · Daten aus Hooks → SQLite → UI · die KI rendert dieses Dashboard nie
        </footer>
      </div>
      </LiveProvider>
    </LockProvider>
  );
}

function Header() {
  const { connected, events } = useLive();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString("de-DE"));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="flex items-center justify-between rounded-xl border border-panel-border bg-panel/60 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Radar className="h-5 w-5" />
        </span>
        <div>
          <h1 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
            Claude Mission Control
            <InfoHint
              align="left"
              text="Read-only Live-Dashboard für Claude Code: Aktivität aus Hooks → SQLite → UI. Die KI rendert dieses Dashboard nie. Rechts oben sperrst/entsperrst du die Bedienelemente per PIN."
            />
          </h1>
          <p className="text-[11px] text-muted">Live-Observability für Claude Code</p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="hidden font-mono sm:inline">{clock}</span>
        <span className="hidden sm:inline">{events.length} Events</span>
        <span className="flex items-center gap-1.5">
          <span
            className={`mc-live-dot h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-500"}`}
          />
          {connected ? "verbunden" : "getrennt"}
        </span>
        <LockButton />
      </div>
    </header>
  );
}
