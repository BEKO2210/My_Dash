"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Clock, Coins, Plug } from "lucide-react";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";
import { relativeTime } from "@/lib/format";
import type { AlertItem } from "@/lib/alerts";

const TYPE_ICON: Record<string, typeof AlertTriangle> = {
  mcp_error: Plug,
  error_spike: AlertTriangle,
  session_long: Clock,
  cost_session: Coins,
};

export function Notifications() {
  const { t, lang } = useT();
  const { tick } = useLive();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const seenMaxId = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/alerts?limit=30")
        .then((r) => r.json())
        .then((d: { alerts: AlertItem[]; unread: number }) => {
          if (cancelled) return;
          setAlerts(d.alerts ?? []);
          setUnread(d.unread ?? 0);
          const maxId = d.alerts?.[0]?.id ?? 0;
          if (seenMaxId.current === null) {
            seenMaxId.current = maxId; // first load: don't toast historical alerts
          } else if (maxId > seenMaxId.current) {
            const newest = d.alerts[0];
            if (newest && !newest.read) {
              setToast(newest.message);
              setTimeout(() => setToast(null), 5000);
            }
            seenMaxId.current = maxId;
          }
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  const markAllRead = () => {
    setUnread(0);
    setAlerts((a) => a.map((x) => ({ ...x, read: 1 })));
    fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  };

  const toggle = () => {
    setOpen((o) => {
      if (!o && unread > 0) markAllRead();
      return !o;
    });
  };

  return (
    <>
      <div className="relative hidden sm:block">
        <button
          type="button"
          onClick={toggle}
          aria-label={t("notif.title")}
          title={t("notif.title")}
          className="relative flex items-center rounded-full border border-panel-border bg-background/40 p-1.5 text-muted transition-colors hover:border-accent/50 hover:text-foreground"
        >
          <Bell className="h-3.5 w-3.5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-lg border border-panel-border bg-panel shadow-2xl shadow-black/50">
            <header className="flex items-center justify-between border-b border-panel-border px-3 py-2 text-sm font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-accent" />
                {t("notif.title")}
              </span>
              <button type="button" onClick={markAllRead} className="text-[11px] font-normal text-muted hover:text-foreground">
                {t("notif.markRead")}
              </button>
            </header>
            {alerts.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted">{t("notif.empty")}</p>
            ) : (
              <ul className="max-h-80 overflow-auto">
                {alerts.map((a) => {
                  const Icon = TYPE_ICON[a.type] ?? AlertTriangle;
                  const row = (
                    <span className="flex items-start gap-2 px-3 py-2">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-foreground">{a.message}</span>
                        <span className="text-[10px] text-muted">{relativeTime(a.created_at, lang)}</span>
                      </span>
                    </span>
                  );
                  return (
                    <li key={a.id} className={a.read ? "" : "bg-accent/[0.06]"}>
                      {a.session_id ? (
                        <Link
                          href={`/session?id=${encodeURIComponent(a.session_id)}`}
                          onClick={() => setOpen(false)}
                          className="block transition-colors hover:bg-white/[0.04]"
                        >
                          {row}
                        </Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
      {toast && (
        <div className="mc-fade-up fixed bottom-4 right-4 z-[90] flex max-w-sm items-start gap-2 rounded-lg border border-amber-400/40 bg-panel px-4 py-3 shadow-2xl shadow-black/50">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-xs font-semibold text-foreground">{t("notif.new")}</p>
            <p className="text-xs text-muted">{toast}</p>
          </div>
        </div>
      )}
    </>
  );
}
