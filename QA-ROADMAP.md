# QA & Debug Roadmap

Ziel: Vor der Veröffentlichung **alles** durchtesten und debuggen — nicht in einem
Rutsch, sondern in **12 fokussierten Runs**. Jeder Run: Screenshots/Tests →
Findings → Fix → Re-Verify → abhaken.

Werkzeuge: `node scripts/qa-shots.mjs` (Playwright/Chromium-Screenshots nach
`/tmp/qa/`), `npm run build` / `lint`, curl gegen die API, direkte DB-Checks.

Legende: ⬜ offen · 🔄 in Arbeit · ✅ fertig

---

- ✅ **Run 1 — Baseline Visual QA**
  Screenshots in HD/QHD/4K, Konsolen-/Page-Errors sammeln. Gesamteindruck,
  offensichtliche Layout-/Render-Fehler.

- ✅ **Run 2 — Fullscreen 3D-Graph**
  Vollbild muss den ganzen Viewport füllen (Bug: `position:fixed` unter
  `transform`-Vorfahr). Esc schließt, kein WebGL-Remount/Blank.

- ✅ **Run 3 — 3D-Graph Rendering**
  Glow-Level (premium, dezent), Kollision/keine Überlappung, Farben/Legende,
  Prompt-Knoten, Detailkarte (lange Inhalte scrollen), Auto-Zoom, Orbit/Zoom.

- ✅ **Run 4 — i18n DE/EN**
  Umschalter, alle Texte übersetzt, relative Zeiten, Persistenz über Reload,
  kein Layout-Bruch in EN.

- ✅ **Run 5 — Live-Stream & SSE**
  Events live, Reihenfolge, Einblende-Animation, Reconnect nach Server-Neustart,
  Dedup, Puffer-Cap (300).

- ✅ **Run 6 — Sessions/Kanban**
  active/waiting/ended, Stale-Auto-Ende (30 min), Projektfilter, Zähler,
  Card-Hover.

- ✅ **Run 7 — Tokens & Kosten**
  Tages-Chart, Tokens/Kosten-Umschalter, Tooltips, Empty-States. Optional:
  24h-Ansicht (ccusage `blocks`, 5h-Schritte).

- ✅ **Run 8 — API & Robustheit**
  Alle Endpunkte 200, ingest 413/400/ok, Error-Boundaries, DB-Fallbacks,
  fehlerhafte Payloads.

- ✅ **Run 9 — Responsive/4K**
  Breakpoints 1920/2560/3840, randlos, kein Overflow/Overlap, Schrift-Skalierung.

- ✅ **Run 10 — A11y & Motion**
  prefers-reduced-motion, focus-visible, Tooltips bei Fokus, Tastatur (Esc),
  Kontrast.

- ✅ **Run 11 — Performance/Stabilität**
  Viele Knoten, lange Session, Speicher, SSE unter Last, Change-Detection greift.

- ✅ **Run 12 — Release-Vorbereitung**
  **Echte Screenshots ins README** + Video-Platzhalter; **Ein-Klick-Starter/
  Installer** (ausführbares `install.sh` + `.desktop`-Datei zum Doppelklicken:
  installiert Deps, Hooks, baut, startet, öffnet Browser); alle Scripts laufen
  (backup/export-log/protect/seed/import-history); Build/Lint sauber;
  Schutz-Hook; finaler Durchlauf; PR fertig.

---

## Findings-Log

### Run 1 (2026-05-22)
- ✅ Gesamtbild HD sehr gut: Header, Kanban, Live-Stream, Token-Chart, 3D-Graph
  rendern sauber (WebGL via SwiftShader sichtbar).
- ❌ **Vollbild des 3D-Graphen wird kleiner statt größer** → Run 2.

### Run 2 ✅
- Fix: Graph-Kachel ohne `transform` (Opacity-Einblendung statt `mc-fade-up`) →
  `position:fixed` wieder viewport-relativ. Per Screenshot bestätigt: Vollbild
  füllt jetzt den ganzen Viewport. (Vorher: Portal-Versuch → WebGL-Remount/Blank,
  verworfen.)

### Run 4 ✅ (vorgezogen)
- EN-Screenshot bestätigt: komplette Übersetzung, relative Zeiten, Legende,
  Umschalter — kein Layout-Bruch.

### Konsolen-/Page-Errors: keine (Playwright-Lauf sauber).
