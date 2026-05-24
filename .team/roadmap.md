# 🗺️ Beta → Release roadmap — exactly 100 release items

**Owner of this file: Atlas.** Built in Phase B from `.team/findings/*.md` —
**deduplicated, release-critical-first**. Must contain **exactly 100** items
(`#1`–`#100`) that are *real* problems: group related findings into one item and
push extras to the **Post-release backlog** below — never pad with filler, never
drop a real problem. Everyone updates the **Status** of their own claimed rows
during Phase C (others: read-only).

**Columns:** `# · Title · Owner · Sev · Status · Acceptance · Deps`
- **Owner:** Atlas / Forge / Prism / Sentinel
- **Sev (hard meaning):**
  - 🔴 **critical** — blocks release / data loss / security hole (no release with open 🔴)
  - 🟠 **high** — important, **no workaround**; release possible but risky
  - 🟡 **medium** — quality/UX/test/docs with a workaround; deferrable
  - 🟢 **low** — polish / cleanup / nice-to-have
- **Status:** `todo` → `claimed:<Name>` → `done:<Name>` (or `blocked:<why> · next:<action>`)
- **Acceptance:** one concrete condition **provable by test / screenshot / CI / audit-log / Sentinel check**. An item is not `done` until its Acceptance is met.
- **Deps:** other item numbers that must finish first (or `—`)

### Release rule
- All 🔴 and 🟠 must be **done or explicitly waived** (waiver = logged reason, owned by Atlas).
- No row is `done` without its Acceptance satisfied; **Sentinel validates** release risk at GATE-D.
- `blocked` rows need a concrete reason **and** a next action.
- Atlas owns structure + the 100-count · row owners own status · Sentinel owns release-risk validation.

> Phase B checklist (Atlas): merge & **dedupe** findings → write items #1–#100,
> release-critical first → balance owners → verify **count == 100** → park extras
> in the backlog → announce in log → request GATE-B acks.

## Items

<!-- Atlas fills #1–#100 below. Example row format:
| 1 | Fix SSE reconnect backoff resets on every event | Forge | 🟠 | todo | reconnect uses capped exponential backoff; unit test covers it | — |
-->

| # | Title | Owner | Sev | Status | Acceptance | Deps |
|---|-------|-------|:---:|--------|------------|------|
| | _(to be filled in Phase B — exactly 100 rows)_ | | | | | |

---
**Count check:** `0 / 100` (Atlas updates after assembly) ·
**Release-blockers (🔴/🟠) done:** `0 / 0`

## Post-release backlog (not counted in the 100)
Real findings that are valid but **not release-critical** land here instead of
being forced into the 100 or dropped. Same columns; revisit after release.

| Title | Owner | Sev | Acceptance | Notes |
|-------|-------|:---:|------------|-------|
| _(deferred findings go here)_ | | | | |
