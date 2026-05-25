"use client";

import { TriangleAlert, Wallet } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { useT } from "@/lib/i18n";
import { useMoney } from "@/components/currency";
import { gaugeTone, type BudgetProjection, type GaugeTone } from "@/lib/budget";

const TONE_BAR: Record<GaugeTone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  over: "bg-red-500",
};

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
  const q = usePluginQuery<BudgetResponse>("/api/budget", { pollMs: 30_000 });
  const data = q.data;

  const hasBudget = !!(data && (data.status.daily.budgetUsd || data.status.monthly.budgetUsd));

  return (
    <Panel title={t("budget.title")} icon={<Wallet className="h-4 w-4 text-accent" />} info={t("budget.info")}>
      {q.error && !data ? (
        <WidgetState icon={Wallet} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : !data ? (
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
  const money = useMoney();
  if (usage.budgetUsd == null) return null;
  const pct = usage.pct ?? 0;
  const shownPct = Math.round(pct * 100);
  const color = TONE_BAR[gaugeTone(pct)];
  const showProjected = proj != null && usage.spentUsd > 0;
  const valueText = `${money(usage.spentUsd)} / ${money(usage.budgetUsd)} · ${shownPct}%`;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="tabular-nums text-muted">{valueText}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.max(0, shownPct))}
        aria-valuetext={valueText}
        className="h-2.5 w-full overflow-hidden rounded-full bg-background/70"
      >
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(pct, 1) * 100}%` }}
        />
      </div>
      {showProjected && (
        <p className={`mt-1 text-[11px] ${proj!.overBudget ? "text-red-400" : "text-muted"}`}>
          {t("budget.projected")}: {money(proj!.projectedUsd)}
        </p>
      )}
    </div>
  );
}
