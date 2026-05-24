# Changelog

All notable changes to Claude Mission Control are documented here. This project
adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0-beta] — 2026-05-24

First public beta — local-first, read-only observability for Claude Code, plus a
polished in-browser demo. Unsigned installers for Windows, macOS and Linux.

### Highlights
- **Read-only dashboard** over the stable data contract `Hooks → /api/ingest → SQLite → UI`.
- **30 widgets** via a plugin registry: live event stream, session kanban, token/cost
  charts, 3D tool-call graph, latency, error/incidents, budgets, anomalies, streaks,
  calendar heatmap, MCP servers, compaction timeline, and more.
- **Desktop app** (Electron) with a tray, hook installer and background ingest server.
- **Light & dark themes** with selectable accent colours, drag-and-drop layout,
  global search, and full **DE/EN** i18n.

### Demo website (the public showcase)
- **Deterministic, seedable demo engine** — reproducible across reloads (no jitter).
- **Persistent sessions & monotonic economy** — ended sessions stay; cost/tokens only
  ever climb in small steps.
- **Calmer cadence** — slower tick, values carried forward instead of re-rolled.
- **Epic 3D graph** — slow auto-rotation that pauses on interaction and eases back.
- **Standalone pages** (About, Features, Contact, Imprint & Privacy) and a compact,
  animated site footer.
- **Screenshot gallery** generated deterministically by `scripts/gallery.mjs`.

### Quality
- Unit tests (Vitest) and an end-to-end Playwright suite (per-widget, multi-viewport,
  light/dark, accessibility) gating CI.

### Notes
- Installers are **unsigned** — see the README for the per-OS first-run steps.
