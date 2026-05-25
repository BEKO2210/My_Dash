"use client";

import { useSyncExternalStore } from "react";
import { formatCurrency, usdToEur } from "@/lib/format";
import { useT } from "@/lib/i18n";

// One shared display-currency preference for the whole dashboard (Phase G money
// consistency). Mirrors the i18n lang store: an external store over localStorage,
// no provider — every money site reads the same value. Default USD (ccusage's
// native/source-of-truth currency); EUR converts via usdToEur() at the server rate
// (GET /api/rate — same EUR_PER_USD the server used for costEur, see useEurRate).

export type Currency = "USD" | "EUR";
const KEY = "mc-currency";
const listeners = new Set<() => void>();

function readCurrency(): Currency {
  if (typeof localStorage === "undefined") return "USD";
  return localStorage.getItem(KEY) === "EUR" ? "EUR" : "USD";
}

function writeCurrency(c: Currency) {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    /* ignore */
  }
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useCurrency(): { currency: Currency; setCurrency: (c: Currency) => void } {
  const currency = useSyncExternalStore(subscribe, readCurrency, () => "USD" as Currency);
  return { currency, setCurrency: writeCurrency };
}

// EUR/USD rate — single source of truth = the SERVER's EUR_PER_USD via GET /api/rate
// (Forge). Fetched once, shared across every useMoney consumer, so client-side USD→EUR
// conversion uses the exact rate the server used for costEur (no divergence). Falls back
// to 0.92 until the fetch resolves / on error. Lazy: the first subscriber triggers it.
const RATE_FALLBACK = 0.92;
let rateValue = RATE_FALLBACK;
let rateFetchStarted = false;
const rateListeners = new Set<() => void>();

function subscribeRate(cb: () => void) {
  rateListeners.add(cb);
  if (!rateFetchStarted) {
    rateFetchStarted = true;
    fetch("/api/rate")
      .then((r) => (r.ok ? (r.json() as Promise<{ eurPerUsd?: number }>) : Promise.reject(new Error("bad status"))))
      .then((d) => {
        if (typeof d.eurPerUsd === "number" && Number.isFinite(d.eurPerUsd) && d.eurPerUsd > 0) {
          rateValue = d.eurPerUsd;
          rateListeners.forEach((f) => f());
        }
      })
      .catch(() => {
        /* keep fallback */
      });
  }
  return () => {
    rateListeners.delete(cb);
  };
}

export function useEurRate(): number {
  return useSyncExternalStore(subscribeRate, () => rateValue, () => RATE_FALLBACK);
}

/**
 * Format a **USD** amount in the active display currency + language. Converts to
 * EUR (via the client rate) when the preference is EUR. This is what every money
 * widget should use so the whole dashboard renders one consistent currency.
 */
export function useMoney(): (usd: number) => string {
  const { currency } = useCurrency();
  const { lang } = useT();
  const rate = useEurRate();
  return (usd: number) =>
    formatCurrency(currency === "EUR" ? usdToEur(usd, rate) : usd, currency, lang);
}

// Compact segmented $ / € switch for the header (sibling of LangToggle).
export function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency();
  const { t } = useT();
  return (
    <div
      className="flex items-center overflow-hidden rounded-full border border-panel-border bg-background/40 text-[11px] font-medium"
      role="group"
      aria-label={t("a11y.currency")}
    >
      {(["USD", "EUR"] as Currency[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setCurrency(c)}
          aria-pressed={currency === c}
          className={`px-2 py-1 tabular-nums transition-colors ${
            currency === c ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          {c === "USD" ? "$" : "€"}
        </button>
      ))}
    </div>
  );
}
