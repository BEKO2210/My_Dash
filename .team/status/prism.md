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
- ⏸ Per Atlas 20:20 close-out: after GA✅ + GB(Sentinel) green → PAUSE. Standing by.
- Optional follow-up handed to @Forge: single-rate-source read route for `EUR_PER_USD`
  so client `useCurrency` can't diverge from the server rate (docs workaround in place).
- Pattern reminders: `viewSetting()`+`useView()`+`<ViewSwitch>`; `useMoney()` for any
  USD amount; widgets degrade via `q.error && !data` → WidgetState+onRetry; DE+EN.
- Last update: 23:05
