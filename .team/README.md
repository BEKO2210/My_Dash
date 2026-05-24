# 🛰️ Team Room — protocol & charter

Four Claude Code terminals work **in this same folder** as a team to take Claude
Mission Control from **beta → release**: find *every* bug, gap and improvement,
author **exactly 100 release items** (real, deduplicated problems — never filler),
and implement them. Extra findings are grouped into an item or moved to the
**post-release backlog**; nothing real is dropped just to hit the number.

You are **one of four agents**. You have **no direct link** to the others — you
coordinate **only through the files in this `.team/` folder**. Read this whole
file before doing anything, then read your role file in `.team/roles/`.

## The team
| Name | Role | Owns (edits only these) |
|------|------|--------------------------|
| 🧭 Atlas | Lead / Architect / Coordinator | `.team/**`, `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `docs/**`, integration, **git push/PR** |
| 🔧 Forge | Backend & Data | `src/app/api/**`, `src/lib/**` (except `i18n.tsx`, `demo.ts`), `src/types/**`, `electron/**`, server parts of `next.config.ts` |
| 🎨 Prism | Frontend & UX | `src/components/**`, `src/plugins/**`, `src/app/**` pages (not API), `src/app/globals.css`, `src/lib/i18n.tsx`, `src/lib/demo.ts`, UI assets in `public/` |
| 🛡️ Sentinel | Quality / Security / Release | `e2e/**`, `playwright.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `.github/workflows/**`, `scripts/**`, `SECURITY.md`, electron-builder block in `package.json` |

**Test rule:** whoever changes a module updates its unit test (`<x>.test.ts`).
Sentinel owns the e2e suite, CI, and the overall green gate.

## Golden rule of the app
Data flows one way: `Hooks → /api/ingest → SQLite → UI`. Never make a widget or
read route write to the DB.

## How to coordinate (the protocol)

1. **Identify & check in.** On start, set your line in `.team/sync.md` (GATE-0 →
   `ready`), create/refresh `.team/status/<you>.md`, and append a check-in to
   `.team/log.md`.
2. **Talk via the log.** Append one line per meaningful action/decision to
   `.team/log.md`: `HH:MM · <You> · message`. Address handoffs: `@Forge: need …`.
   **Append only — never rewrite others' lines.**
3. **Claim before you build.** Set the item's status in `.team/roadmap.md` to
   `claimed:<You>` **and** create `.team/locks/<id>.lock` (file content = your
   name). If a lock already exists, pick another item. Mark `done:<You>` **only
   once its Acceptance is satisfied and provable** (a test, screenshot, CI run,
   audit-log line, or Sentinel check), then delete the lock. Owners set their own
   `done`; **Sentinel validates release risk** at GATE-D before it truly counts as
   release-ready.
4. **Stay in your lane.** Edit only files in your domain (table above). For a
   cross-domain change, post `@Owner: …` in the log and let the owner do it (or
   hand it to them). Atlas arbitrates conflicts.
5. **Commit serially.** Before `git add`/`commit`:
   - Create `.team/locks/git.lock` with your name. If it exists, wait and re-check.
   - **Stage only your own paths** (`git add <your files>`), **never** `git add -A`/`.`.
   - Commit small, message prefixed `[<You>] …`, then **delete `git.lock`**.
   - **Only Atlas pushes** and opens/updates the PR (phase by phase).
6. **Wait at gates.** `.team/sync.md` defines phase gates `GATE-0…GATE-E`. When
   you finish a phase, tick your cell. **Do not start a phase until its required
   gate is ticked by all four.** If you're blocked: set `.team/status/<you>.md`
   to `WAITING for <names>`, note it in the log, and **re-read `.team/sync.md`**
   to poll. (Optionally auto-poll with the `/loop` skill: `/loop 60s re-read
   .team/sync.md and proceed when GATE-X is complete`.)

## Severity (hard meaning — mark consistently)
- 🔴 **critical** — blocks the release, or causes data loss / a security hole. The app is unusable or a core path fails. No release with an open 🔴.
- 🟠 **high** — important bug/feature with **no workaround**; release is possible but risky.
- 🟡 **medium** — quality / UX / test / docs issue that has a workaround; deferrable to a later release.
- 🟢 **low** — polish, cleanup, nice-to-have.

## Release rule
- All 🔴 and 🟠 items must be **done or explicitly waived** (a waiver is a logged reason, owned by Atlas).
- **No item may be marked `done` without satisfying its Acceptance** — provable via test, screenshot, CI, audit-log, or Sentinel check.
- **Blocked** items must state a concrete reason **and** the next action.
- **Ownership of truth:** Atlas owns structure + the exact 100-count; row owners own implementation status; **Sentinel validates release risk**.
- The number is fixed at **100 *release* items** — group related findings into one item, or push extras to the **post-release backlog** (bottom of `roadmap.md`). Never invent filler; never silently drop a real problem.

## The mission flow
- **GATE-0 Kickoff** → everyone `ready`.
- **Phase A — Audit (parallel):** exhaustively audit your domain (bugs, gaps, UX,
  a11y, perf, security, test holes, release blockers). Write candidates with
  severity + proposed fix to `.team/findings/<you>.md`. Tick **GATE-A** when done.
- **Phase B — Roadmap (Atlas leads):** Atlas merges + **deduplicates** findings
  into **exactly 100 release items** in `.team/roadmap.md` (id · title · owner ·
  severity · acceptance · deps), sorted **release-critical first**. Related
  findings are grouped into one item; extras go to the **post-release backlog** —
  no filler, nothing real dropped. Everyone reviews via the log; Atlas verifies
  the count is exactly 100. Tick **GATE-B** (`ratified`) when you agree.
- **Phase C — Build (parallel):** work your items by priority — claim →
  implement → unit test → `npm run lint` + `npm test` locally → commit (with
  lock) → mark `done` **once Acceptance is proven** → log. Respect dependencies
  (wait/handoff).
- **Phase D — Integration & QA (Sentinel):** after each batch, run
  `npm run lint && npm test && npm run build` + e2e, **and validate each item's
  Acceptance** (is the proof there?). Items without proof bounce back to their
  owner; failures become high-prio items. Tick **GATE-C** (all 100 done **and
  verified**) and **GATE-D** (all green; every 🔴/🟠 done or waived).
- **Phase E — Release readiness (Atlas + Sentinel):** changelog, version (1.0.0),
  verify demo/site, sign off (**GATE-E**). The public release/tag stays a human
  step.

## Don't
- Don't edit another agent's domain files or rewrite their log/status lines.
- Don't `git add -A` / `git add .`. Don't commit without `git.lock`. Don't push
  unless you are Atlas.
- Don't pad to 100 with filler or drop real problems — group them or defer to the backlog.
- Don't mark an item `done` without satisfying its Acceptance. Don't skip a gate.
