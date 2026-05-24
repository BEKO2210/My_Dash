"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useFacets } from "@/components/facets";
import { useTimeRange } from "@/components/time-range";
import { filterCommands, type CommandItem } from "@/lib/command-palette";
import { TIME_RANGES } from "@/lib/time-range";
import { widgets } from "@/plugins/registry";
import type { SessionRow } from "@/lib/types";

interface RunCommand extends CommandItem {
  run: () => void;
}

export function CommandPalette({
  onResetLayout,
  onOpenGallery,
}: {
  onResetLayout: () => void;
  onOpenGallery: () => void;
}) {
  const { t, lang, setLang } = useT();
  const { setStatus, clear } = useFacets();
  const { setRange } = useTimeRange();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const reset = () => {
      setQuery("");
      setIndex(0);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        reset();
      }
    };
    const onOpenEvent = () => {
      setOpen(true);
      reset();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mc:open-command", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mc:open-command", onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    let cancelled = false;
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d: { sessions: SessionRow[] }) => {
        if (!cancelled) setSessions(d.sessions ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const commands = useMemo<RunCommand[]>(() => {
    const close = () => setOpen(false);
    const list: RunCommand[] = [];
    for (const r of TIME_RANGES) {
      list.push({
        id: `range-${r}`,
        group: t("cmd.range"),
        label: `${t("cmd.setRange")}: ${t(`range.${r}`)}`,
        keywords: "time zeit range zeitraum",
        run: () => {
          setRange(r);
          close();
        },
      });
    }
    for (const s of ["active", "waiting", "ended"]) {
      list.push({
        id: `status-${s}`,
        group: t("cmd.status"),
        label: `${t("cmd.setStatus")}: ${t(`status.${s}`)}`,
        run: () => {
          setStatus(s);
          close();
        },
      });
    }
    list.push({ id: "facet-clear", group: t("cmd.status"), label: t("facets.clear"), run: () => { clear(); close(); } });
    const openDigest = (period: "day" | "week") => {
      window.open(`/api/digest?period=${period}`, "_blank", "noopener");
      close();
    };
    list.push({ id: "digest-day", group: t("cmd.actions"), label: t("cmd.digestDay"), keywords: "report summary", run: () => openDigest("day") });
    list.push({ id: "digest-week", group: t("cmd.actions"), label: t("cmd.digestWeek"), keywords: "report summary", run: () => openDigest("week") });
    const openExport = (query: string) => {
      window.open(`/api/export${query}`, "_blank", "noopener");
      close();
    };
    list.push({ id: "export-json", group: t("cmd.actions"), label: t("cmd.exportJson"), keywords: "export download backup json", run: () => openExport("") });
    list.push({ id: "export-sessions-csv", group: t("cmd.actions"), label: t("cmd.exportSessionsCsv"), keywords: "export download csv sessions", run: () => openExport("?table=sessions&format=csv") });
    list.push({ id: "export-events-csv", group: t("cmd.actions"), label: t("cmd.exportEventsCsv"), keywords: "export download csv events", run: () => openExport("?table=events&format=csv") });
    list.push({ id: "reset", group: t("cmd.actions"), label: t("layout.reset"), run: () => { onResetLayout(); close(); } });
    list.push({ id: "gallery", group: t("cmd.actions"), label: t("gallery.title"), run: () => { onOpenGallery(); close(); } });
    list.push({
      id: "lang",
      group: t("cmd.actions"),
      label: lang === "de" ? "Language: English" : "Sprache: Deutsch",
      keywords: "language sprache locale",
      run: () => {
        setLang(lang === "de" ? "en" : "de");
        close();
      },
    });
    for (const w of widgets) {
      list.push({
        id: `widget-${w.id}`,
        group: t("cmd.widgets"),
        label: `${t("cmd.goto")}: ${w.title}`,
        run: () => {
          document.getElementById(`mc-widget-${w.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          close();
        },
      });
    }
    for (const s of sessions.slice(0, 30)) {
      list.push({
        id: `session-${s.id}`,
        group: t("cmd.sessions"),
        label: s.title || s.id.slice(0, 8),
        keywords: `${s.project_name ?? ""} ${s.id}`,
        run: () => {
          router.push(`/session?id=${encodeURIComponent(s.id)}`);
          close();
        },
      });
    }
    return list;
  }, [t, lang, setLang, setRange, setStatus, clear, onResetLayout, onOpenGallery, sessions, router]);

  const filtered = filterCommands(commands, query);
  const sel = filtered.length ? Math.min(index, filtered.length - 1) : 0;

  if (!open) return null;

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[sel]?.run();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t("cmd.title")} className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
      <div className="relative z-10 flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-panel-border bg-panel shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2 border-b border-panel-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={onInputKey}
            placeholder={t("cmd.placeholder")}
            aria-label={t("cmd.title")}
            className="w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted"
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-auto p-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted">{t("cmd.empty")}</li>
          ) : (
            filtered.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => c.run()}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === sel ? "bg-accent/15 text-foreground" : "text-foreground hover:bg-white/[0.04]"}`}
                >
                  <span className="truncate">{c.label}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wide text-muted">{c.group}</span>
                    {i === sel && <CornerDownLeft className="h-3 w-3 text-accent" />}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
