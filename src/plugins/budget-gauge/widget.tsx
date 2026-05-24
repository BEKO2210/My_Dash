"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, Wallet } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import type { BudgetProjection } from "@/lib/budget";

interface BudgetUsage {
  budgetUsd: number | null;
  spentUsd: number;
  pct: number | null;
}
interface BudgetResponse {
  budgets: { dailyUsd: number | null; monthlyUsd: number | null };
  status: { daily: BudgetUsage; monthly: BudgetUsage };
  projection?: { daily: BudgetProjection; monthly: BudgetProjection };
}

export function BudgetGauge() {
  const { t } = useT();
  const [data, setData] = useState<BudgetResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/budget")
        .then((r) => r.json())
        .then((d: BudgetResponse) => {
          if (!cancelled) setData(d);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  const hasBudget = !!(data && (data.status.daily.budgetUsd || data.status.monthly.budgetUsd));

  return (
    <Panel title={t("budget.title")} icon={<Wallet className="h-4 w-4 text-accent" />} info={t("budget.info")}>
      {!data ? (
        <WidgetState icon={Wallet} title={t("common.loading")} loading />
      ) : !hasBudget ? (
        <WidgetState
          icon={Wallet}
          title={t("budget.none")}
          description={<code className="text-accent">MC_BUDGET_DAILY</code>}
        />
      ) : (
        <div className="flex h-full flex-col justify-center gap-5 p-5">
          {(data.projection?.daily.overBudget || data.projection?.monthly.overBudget) && (
            <div className="flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              <span>{t("budget.alarm")}</span>
            </div>
          )}
          <Gauge label={t("budget.daily")} usage={data.status.daily} proj={data.projection?.daily ?? null} />
          <Gauge label={t("budget.monthly")} usage={data.status.monthly} proj={data.projection?.monthly ?? null} />
        </div>
      )}
    </Panel>
  );
}

function Gauge({
  label,
  usage,
  proj,
}: {
  label: string;
  usage: BudgetUsage;
  proj: BudgetProjection | null;
}) {
  const { t } = useT();
  if (usage.budgetUsd == null) return null;
  const pct = usage.pct ?? 0;
  const color = pct >= 1 ? "bg-red-500" : pct >= 0.75 ? "bg-amber-500" : "bg-emerald-500";
  const showProjected = proj != null && usage.spentUsd > 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="tabular-nums text-muted">
          {formatMoney(usage.spentUsd, "USD")} / {formatMoney(usage.budgetUsd, "USD")} ·{" "}
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-background/70">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(pct, 1) * 100}%` }}
        />
      </div>
      {showProjected && (
        <p className={`mt-1 text-[11px] ${proj!.overBudget ? "text-red-400" : "text-muted"}`}>
          {t("budget.projected")}: {formatMoney(proj!.projectedUsd, "USD")}
        </p>
      )}
    </div>
  );
}
