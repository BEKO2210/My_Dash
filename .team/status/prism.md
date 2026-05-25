# Status — Prism 🎨

▶ **AUTOPILOT ON** — on `status` (or any nudge), follow `.team/AUTOPILOT.md`: re-read
state, then continue autonomously (don't just report — build the next item).

- Phase: **Phase G** (team debug sweep). FC widget rollout ✅ (all 16) + foundation done.
- ✅ **Currency-consistency pass DONE** (this session): `src/components/currency.tsx`
  (`useCurrency`/`useMoney`/`<CurrencyToggle>`, shared localStorage pref, default USD)
  wired across all 10 money sites + token-chart refactor (dropped local EUR state +
  dup SYMBOL). i18n `a11y.currency` DE+EN. lint·parity 494/494·build·542 unit all green.
  @Atlas to cherry-pick (needs Forge 3050847 `formatCurrency`); @Sentinel to rebaseline
  money visuals + EUR↔USD e2e.
- ✅ **Phase-G sweep batch 1 DONE:** read-API resilience — fixed 7 widgets that
  infinite-spun on fetch failure (streak, git-correlation, mcp-servers, token-burn,
  session-duration, anomaly, reliability) → now degrade to `common.loadError` + retry.
  a11y — token-chart range+mode toggles gained `aria-pressed`. lint·build·542 unit green.
- 🏁 **GA: Prism ✅ ticked (Phase G DONE — Prism).** Domain sweep complete across
  currency consistency + read-API resilience + toggle a11y; visual dimension covered by
  Sentinel F17 (30/30 e2e). No open 🔴/🟠 in components/plugins/pages/i18n.
- ✅ **@Forge handoff DONE:** `useCurrency` now consumes Forge's `GET /api/rate`
  (new `useEurRate()`, fetch-once shared store, fallback 0.92) → client EUR matches
  server costEur exactly (closes the rate divergence at the source). `format.ts eurRate()`
  now dead in client code → flagged to @Forge for removal. lint·build·543 unit green.
- 🟢 **Prism domain fully closed — no open work, no open @Prism handoffs.** Standing by
  for full Phase-G closeout (Forge GA + Sentinel GA/GB). On `status` once board is fully
  closed (all 4 GA ✅ + GB green) → one-line pause reply per Atlas 20:22 standing rule.
- ⏸ Per Atlas 20:20 close-out: after GA✅ + GB(Sentinel) green → PAUSE.
- (Earlier optional follow-up to @Forge — single-rate-source route — now DONE, see above.)
  so client `useCurrency` can't diverge from the server rate (docs workaround in place).
- Pattern reminders: `viewSetting()`+`useView()`+`<ViewSwitch>`; `useMoney()` for any
  USD amount; widgets degrade via `q.error && !data` → WidgetState+onRetry; DE+EN.
- Last update: 23:05
