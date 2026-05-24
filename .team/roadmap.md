# 🗺️ Beta → Release roadmap — exactly 100 items

**Owner of this file: Atlas.** Built in Phase B from `.team/findings/*.md`.
Must contain **exactly 100** items (`#1`–`#100`). Everyone updates the **Status**
of their own claimed rows during Phase C (others: read-only).

**Columns:** `# · Title · Owner · Sev · Status · Acceptance · Deps`
- **Owner:** Atlas / Forge / Prism / Sentinel
- **Sev:** 🔴 critical · 🟠 high · 🟡 medium · 🟢 low
- **Status:** `todo` → `claimed:<Name>` → `done:<Name>` (or `blocked:<why>`)
- **Acceptance:** one concrete, checkable condition
- **Deps:** other item numbers that must finish first (or `—`)

> Phase B checklist (Atlas): merge & dedupe findings → write items #1–#100 →
> balance owners → verify **count == 100** → announce in log → request GATE-B acks.

## Items

<!-- Atlas fills #1–#100 below. Example row format:
| 1 | Fix SSE reconnect backoff resets on every event | Forge | 🟠 | todo | reconnect uses capped exponential backoff; unit test covers it | — |
-->

| # | Title | Owner | Sev | Status | Acceptance | Deps |
|---|-------|-------|:---:|--------|------------|------|
| | _(to be filled in Phase B — exactly 100 rows)_ | | | | | |

---
**Count check:** `0 / 100` (Atlas updates after assembly)
