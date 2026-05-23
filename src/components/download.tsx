"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { WindowsIcon, AppleIcon, LinuxIcon } from "@/components/os-icons";
import { useT } from "@/lib/i18n";

const REPO = "https://github.com/BEKO2210/My_Dash";
const ALL_RELEASES = `${REPO}/releases`;

// Pinned to the published v0.1.0 release assets (verified live). The v0.1.0 tag
// predates the stable artifactName config, so its filenames are version-stamped;
// once a release is cut from main as a normal (non-prerelease) release, these can
// move to the stable `releases/latest/download/Claude-Mission-Control*` form.
const TAG = "v0.1.0";
const DL = `${REPO}/releases/download/${TAG}`;
const URLS = {
  windows: `${DL}/Claude.Mission.Control.Setup.0.1.0.exe`,
  mac: `${DL}/Claude.Mission.Control-0.1.0-arm64.dmg`,
  linuxAppImage: `${DL}/Claude.Mission.Control-0.1.0.AppImage`,
  linuxDeb: `${DL}/claude-mission-control_0.1.0_amd64.deb`,
};

type OS = "windows" | "mac" | "linux";

/** Best-effort desktop OS from the user agent; null for mobile/unknown (no desktop build). */
function detectOS(): OS | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return null; // Android mobile — no desktop build
  if (/iPhone|iPad|iPod/i.test(ua)) return null; // iOS mobile — no desktop build
  if (/Windows|Win32|Win64|WOW64/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Linux|X11/i.test(ua)) return "linux";
  return null;
}

/** Landing-page download block: detects the visitor's OS and offers per-platform installers. */
export function DownloadSection() {
  const { t } = useT();
  const [os, setOs] = useState<OS | null>(null);

  // Detect on the client only, deferred a frame so SSR/hydration output matches.
  useEffect(() => {
    const id = requestAnimationFrame(() => setOs(detectOS()));
    return () => cancelAnimationFrame(id);
  }, []);

  const cards = [
    { id: "windows" as const, Icon: WindowsIcon, name: "Windows", file: t("download.winFile"), primary: URLS.windows, extra: [] as { label: string; url: string }[] },
    { id: "mac" as const, Icon: AppleIcon, name: "macOS", file: t("download.macFile"), primary: URLS.mac, extra: [] },
    { id: "linux" as const, Icon: LinuxIcon, name: "Linux", file: t("download.linuxFile"), primary: URLS.linuxAppImage, extra: [{ label: ".deb", url: URLS.linuxDeb }] },
  ];
  const detected = cards.find((c) => c.id === os) ?? null;

  return (
    <section id="download" className="mt-12 scroll-mt-6">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t("download.title")}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted">{t("download.subtitle")}</p>

      {detected && (
        <div className="mt-5 flex flex-col items-center gap-1.5">
          <a
            href={detected.primary}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-transform hover:-translate-y-0.5"
          >
            <Download className="h-4 w-4" />
            {t("download.for")} {detected.name}
          </a>
          <span className="text-[11px] text-muted">{detected.file}</span>
        </div>
      )}

      <div className="mx-auto mt-7 grid max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
        {cards.map((c) => {
          const isDetected = detected?.id === c.id;
          return (
            <div
              key={c.id}
              className={`relative flex flex-col items-center rounded-xl border bg-panel/60 p-5 text-center transition-colors ${
                isDetected ? "border-accent/60 ring-1 ring-accent/40" : "border-panel-border hover:border-accent/30"
              }`}
            >
              {isDetected && (
                <span className="absolute right-2 top-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                  {t("download.detected")}
                </span>
              )}
              <c.Icon className="h-9 w-9 text-foreground" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">{c.name}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{c.file}</p>
              <a
                href={c.primary}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent/50 hover:text-accent"
              >
                <Download className="h-3.5 w-3.5" />
                {t("download.download")}
              </a>
              {c.extra.length > 0 && (
                <div className="mt-2 flex gap-2 text-[11px]">
                  {c.extra.map((e) => (
                    <a key={e.url} href={e.url} className="text-muted underline-offset-2 hover:text-accent hover:underline">
                      {e.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-muted/80">{t("download.unsigned")}</p>
      <p className="mt-1 text-[11px]">
        <a href={ALL_RELEASES} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          {t("download.allReleases")}
        </a>
      </p>
    </section>
  );
}
