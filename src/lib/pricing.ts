// Approximate per-model pricing (USD per million tokens) for an offline cost
// estimate from transcript usage. This is a best-effort figure; ccusage remains
// the source of truth and reconciles it in a later run.

export interface ModelPrice {
  input: number;
  output: number;
  cacheWrite: number; // cache creation
  cacheRead: number;
}

const SONNET: ModelPrice = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };

const TABLE: { match: RegExp; price: ModelPrice }[] = [
  { match: /opus/i, price: { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 } },
  { match: /haiku/i, price: { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 } },
  { match: /sonnet/i, price: SONNET },
];

// Match a model id to a price; Sonnet pricing is the sensible default.
export function priceFor(model: string | null | undefined): ModelPrice {
  if (model) {
    for (const { match, price } of TABLE) if (match.test(model)) return price;
  }
  return SONNET;
}

export interface UsageTokens {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model?: string | null;
}

export function estimateCostUsd(u: UsageTokens): number {
  const p = priceFor(u.model);
  return (
    (u.inputTokens * p.input +
      u.outputTokens * p.output +
      u.cacheCreationTokens * p.cacheWrite +
      u.cacheReadTokens * p.cacheRead) /
    1_000_000
  );
}
