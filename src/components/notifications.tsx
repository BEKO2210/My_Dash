"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, BellRing, Clock, Coins, MoonStar, Plug, Webhook } from "lucide-react";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";
import { relativeTime } from "@/lib/format";
import { inQuietHours, isCritical, type QuietConfig } from "@/lib/quiet";
import type { AlertItem } from "@/lib/alerts";

const DESKTOP_KEY = "mc-desktop-notif";

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
  const [desktop, setDesktop] = useState(false);
  const seenMaxId = useRef<number | null>(null);
  const desktopRef = useRef(false);
  const quietRef = useRef<QuietConfig>({ enabled: false, start: "22:00", end: "07:00" });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/alerts/quiet")
      .then((r) => r.json())
      .then((d: QuietConfig) => {
        quietRef.current = d;
      })
      .catch(() => {});
  }, [tick]);

  useEffect(() => {
    desktopRef.current = desktop;
  }, [desktop]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        if (
          localStorage.getItem(DESKTOP_KEY) === "1" &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          setDesktop(true);
        }
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

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
            const q = quietRef.current;
            const suppressed =
              !!newest &&
              q.enabled &&
              !isCritical(newest.type) &&
              inQuietHours(q.start, q.end, new Date());
            if (newest && !newest.read && !suppressed) {
              setToast(newest.message);
              setTimeout(() => setToast(null), 5000);
              // Bridge to a native (Electron/OS) notification when enabled.
              if (desktopRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
                try {
                  new Notification("Claude Mission Control", { body: newest.message });
                } catch {
                  /* notifications unavailable */
                }
              }
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

  const toggleDesktop = () => {
    if (desktop) {
      setDesktop(false);
      try {
        localStorage.removeItem(DESKTOP_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission().then((p) => {
      if (p === "granted") {
        setDesktop(true);
        try {
          localStorage.setItem(DESKTOP_KEY, "1");
        } catch {
          /* ignore */
        }
      }
    });
  };

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

  // While the dropdown is open: close on Esc / outside click, move focus into the
  // panel, and return focus to the bell when it closes.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const close = () => {
      setOpen(false);
      btnRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !btnRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <>
      <div className="relative hidden sm:block">
        <button
          ref={btnRef}
          type="button"
          onClick={toggle}
          aria-label={t("notif.title")}
          aria-haspopup="dialog"
          aria-expanded={open}
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
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("notif.title")}
            tabIndex={-1}
            className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-lg border border-panel-border bg-panel shadow-2xl shadow-black/50 outline-none"
          >
            <header className="flex items-center justify-between border-b border-panel-border px-3 py-2 text-sm font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-accent" />
                {t("notif.title")}
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleDesktop}
                  aria-pressed={desktop}
                  aria-label={t("notif.desktop")}
                  title={t("notif.desktop")}
                  className={`transition-colors ${desktop ? "text-accent" : "text-muted hover:text-foreground"}`}
                >
                  <BellRing className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={markAllRead} className="text-[11px] font-normal text-muted hover:text-foreground">
                  {t("notif.markRead")}
                </button>
              </span>
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
            <QuietConfig t={t} />
            <WebhookConfig t={t} />
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

function QuietConfig({ t }: { t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [start, setStart] = useState("22:00");
  const [end, setEnd] = useState("07:00");
  const [saved, setSaved] = useState(false);

  const openConfig = () => {
    setOpen((o) => !o);
    if (!open) {
      fetch("/api/alerts/quiet")
        .then((r) => r.json())
        .then((d: QuietConfig) => {
          setEnabled(Boolean(d.enabled));
          setStart(d.start ?? "22:00");
          setEnd(d.end ?? "07:00");
        })
        .catch(() => {});
    }
  };

  const save = () => {
    fetch("/api/alerts/quiet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, start, end }),
    })
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div className="border-t border-panel-border">
      <button
        type="button"
        onClick={openConfig}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[11px] text-muted transition-colors hover:text-foreground"
      >
        <MoonStar className="h-3.5 w-3.5" />
        {t("quiet.title")}
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          <label className="flex items-center gap-2 text-[11px] text-foreground">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-accent)]" />
            {t("quiet.enable")}
          </label>
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-1.5 text-[11px] text-muted">
              {t("quiet.start")}
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                aria-label={t("quiet.start")}
                className="w-full rounded-md border border-panel-border bg-background/40 px-2 py-1 text-[11px] text-foreground outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-1 items-center gap-1.5 text-[11px] text-muted">
              {t("quiet.end")}
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                aria-label={t("quiet.end")}
                className="w-full rounded-md border border-panel-border bg-background/40 px-2 py-1 text-[11px] text-foreground outline-none focus:border-accent"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={save}
            className="w-full rounded-md border border-accent/40 bg-accent/10 py-1 text-[11px] text-accent transition-colors hover:bg-accent/20"
          >
            {saved ? t("quiet.saved") : t("quiet.save")}
          </button>
          <p className="text-[10px] text-muted">{t("quiet.hint")}</p>
        </div>
      )}
    </div>
  );
}

function WebhookConfig({ t }: { t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);

  const openConfig = () => {
    setOpen((o) => !o);
    if (!open) {
      fetch("/api/alerts/webhook")
        .then((r) => r.json())
        .then((d: { url: string; enabled: boolean }) => {
          setUrl(d.url ?? "");
          setEnabled(Boolean(d.enabled));
        })
        .catch(() => {});
    }
  };

  const save = () => {
    fetch("/api/alerts/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim(), enabled }),
    })
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div className="border-t border-panel-border">
      <button
        type="button"
        onClick={openConfig}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[11px] text-muted transition-colors hover:text-foreground"
      >
        <Webhook className="h-3.5 w-3.5" />
        {t("webhook.title")}
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("webhook.placeholder")}
            aria-label={t("webhook.title")}
            className="w-full rounded-md border border-panel-border bg-background/40 px-2 py-1 text-[11px] text-foreground outline-none focus:border-accent"
          />
          <label className="flex items-center gap-2 text-[11px] text-foreground">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-accent)]" />
            {t("webhook.enable")}
          </label>
          <button
            type="button"
            onClick={save}
            className="w-full rounded-md border border-accent/40 bg-accent/10 py-1 text-[11px] text-accent transition-colors hover:bg-accent/20"
          >
            {saved ? t("webhook.saved") : t("webhook.save")}
          </button>
          <p className="text-[10px] text-muted">{t("webhook.hint")}</p>
        </div>
      )}
    </div>
  );
}
