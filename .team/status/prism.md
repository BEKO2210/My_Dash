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
- ▶ **NEXT (Phase G GA, Prism domain):** systematic widget sweep — every widget ×
  both view variants × light/dark × DE/EN × mobile→UHD: console/React warnings,
  clipping/overflow, empty/loading/error states, a11y (axe/keyboard/focus), demo realism.
  Find→fix→test→commit→log; 🔴/🟠 first; keep gate green.
- Pattern reminders: `viewSetting()`+`useView()`+`<ViewSwitch>`; `useMoney()` for any
  USD amount; default===today's look; light/dark; DE+EN; per-fix green commit via `git.lock`.
- ⚠️ Layout note: on col-span-2 widgets place tested header controls clear of the hover
  WidgetToolbar (pointer-events-none on its pill).
- Last update: 22:40
