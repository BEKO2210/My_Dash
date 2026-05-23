import type { UsageModel } from "./ccusage";

// Donut slices for per-model token/cost share. Keeps the top models and groups the
// rest into "Other" (donuts read best with <= ~6 slices).
export const OTHER = "__other__";

export interface ModelSlice {
  name: string; // shortened model id (or OTHER)
  full: string; // original model id (or OTHER)
  value: number;
  pct: number; // 0..1
}

export function shortModel(model: string): string {
  return model.replace(/^claude-/, "") || model;
}

export function modelShare(
  models: UsageModel[],
  mode: "cost" | "tokens",
  max = 6,
): { slices: ModelSlice[]; total: number } {
  const vals = models
    .map((m) => ({ full: m.model, value: mode === "cost" ? m.costUsd : m.totalTokens }))
    .filter((v) => v.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = vals.reduce((a, v) => a + v.value, 0);

  let top = vals;
  if (vals.length > max) {
    const rest = vals.slice(max - 1).reduce((a, v) => a + v.value, 0);
    top = [...vals.slice(0, max - 1), { full: OTHER, value: rest }];
  }

  const slices = top.map((v) => ({
    name: v.full === OTHER ? OTHER : shortModel(v.full),
    full: v.full,
    value: v.value,
    pct: total ? v.value / total : 0,
  }));
  return { slices, total };
}
