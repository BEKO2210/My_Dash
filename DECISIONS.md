# Entscheidungs-Journal · Decision Log

Zweck: festhalten **was** geändert wurde und **warum** — menschenlesbar und für Claude
schnell parsebar. Ergänzt (nicht ersetzt) die maschinellen Daten:

- **Prompts & Tool-Aufrufe** werden bereits automatisch in `data/mission-control.db`
  (`events`, `tool_calls`) gespeichert — das ist die Kernfunktion des Dashboards.
- **Persistentes Claude-Wissen** liegt in `~/.claude/projects/<projekt>/memory/`.
- Dieses Journal trägt das **Warum** hinter Entscheidungen nach.

Format pro Eintrag: **Was** · **Warum** · **Dateien**. Neueste oben.

---

## 2026-05-22

### Graph: Prompts, echte Farben, isolierte Knoten weg, gedeckelte Detailkarte
- **Was:** Prompt-Knoten (deine UserPromptSubmit + Claude→Agent-Task-Prompts) mit eigener
  Farbe/Legende; echtes 3D ohne künstliches Licht (flaches Ambient + Bloom, höhere Auflösung,
  durchdachte Palette); isolierte Knoten werden entfernt + Zoom-to-fit; Detailkarte mit
  Maximalhöhe + scrollbaren Lang-Feldern; Befehle nach echtem Programm gruppiert (cd-Präfix
  übersprungen); Legende aus dem Header nach unten-links verschoben.
- **Warum:** Nutzer wollte Prompts im Graph (seine + Claudes), schönere/echte 3D-Optik, und
  der einzelne fremde Session-Knoten („Schreibtisch", 0 Tools/Prompts) trieb die Kamera weit
  weg. Lange Befehle bliesen die Detailkarte auf. 7 Legenden-Einträge überfüllten den Header.
- **Dateien:** `src/app/api/graph/route.ts`, `plugins/tool-graph/widget.tsx`.
- **Ehrliche Grenze:** Claudes *freie* Antworten erfassen die Hooks nicht (kein Hook dafür) —
  nur Prompts + Aktionen. Visueller Pixel-Test nicht möglich (kein Headless-Browser hier).

### Export-Log + Entscheidungs-Journal
- **Was:** `npm run export-log` (Prompts/Tools → lesbares Markdown), `DECISIONS.md` (dieses Journal).
- **Warum:** Nutzer wollte „alle Gedanken/Prompts speichern". Prompts/Tools liegen ohnehin in
  SQLite; das *Warum* fehlte → Journal. Reasoning kann nicht 1:1 auto-persistiert werden.
- **Dateien:** `scripts/export-log.mjs`, `DECISIONS.md`, `package.json`.

### System-Schutz gegen versehentliches Kaputtmachen (Guard-Hook)
- **Was:** PreToolUse-Hook (`.claude/settings.json` → `scripts/protect-guard.mjs`), der
  Edit/Write/NotebookEdit/Bash-Schreibzugriffe auf Aussehen/Config-Dateien blockt, wenn
  `.mc-protect` existiert. Toggle: `npm run protect` / `npm run unprotect` (PIN 0000).
  Standard: AUS.
- **Warum:** Nutzer wollte verhindern, dass das System (v.a. Farben/Config) — besonders
  durch Claude in anderen Runs — kaputtgeht. Ein Browser-PIN kann das nicht; Schutz muss
  auf Claude-Code-Ebene (Hook) sitzen. Lesen bleibt frei, damit normale Arbeit weiterläuft.
- **Dateien:** `scripts/protect-guard.mjs`, `scripts/protect.mjs`, `.claude/settings.json`,
  `package.json`, `.gitignore`.

### PIN-View-Lock — gebaut und wieder verworfen
- **Was:** Erst einen PIN-Lock gebaut, der die *Bedienelemente* (Filter, Vollbild,
  Graph-Klicks) sperrt; dann komplett entfernt.
- **Warum:** Missverständnis. Nutzer wollte das *System* vor Änderungen schützen, nicht die
  *Ansicht* sperren. Die View-Sperre behinderte nur (Vollbild/Klicks gingen nicht mehr) →
  ersetzt durch den Guard-Hook oben.
- **Dateien:** (entfernt) `src/components/lock-provider.tsx`, `lock-controls.tsx`.

### Info-Hinweise überall
- **Was:** Dezente ℹ️ (Hover/Fokus) an jedem Panel + Header; `InfoHint`-Komponente,
  `Panel` bekam `info`-Prop.
- **Warum:** Nutzer wünschte kleine, professionelle Erklärungen, was was ist.
- **Dateien:** `src/components/info-hint.tsx`, `panel.tsx`, alle vier Widgets, `dashboard.tsx`.

### Großbild-/4K-Skalierung, randlos
- **Was:** Ab 2560px kein Breitenlimit (`max-w-none`), Root-Schrift 20px (QHD) / 24px (4K),
  größere Panels/Abstände. HD (≤1920px) unverändert.
- **Warum:** Auf dem 4K-Schirm wirkte alles klein und als Insel mittig; Nutzer musste manuell
  zoomen. Erst zu zaghaft gedeckelt → dann randlos + kräftiger.
- **Dateien:** `src/app/globals.css`, `dashboard.tsx`, `plugins/registry.ts`.

### Graph-Labels Claude-first optimiert
- **Was:** Ziel-Knoten mit explizitem `kind` (file/command/url/pattern), kompakte Labels
  (Bash nach Programm gruppiert, Dateien als kurzer Pfad, URLs als Host), Farbe/Substantiv/
  dynamische Legende.
- **Warum:** Lange, einmalige Kommandozeilen als „Datei"-Knoten waren unleserlich; Labels
  sollten für Claude schnell parsebar und für Menschen verständlich sein.
- **Dateien:** `src/app/api/graph/route.ts`, `plugins/tool-graph/widget.tsx`.

### Härtung (Stabilität)
- **Was:** Error-Boundary pro Widget + `app/error.tsx`/`global-error.tsx`; API-Routen
  (sessions/graph/events) mit try/catch + sicherem Fallback; SSE-Reconnect mit Backoff +
  Backlog; Ingest-Body-Limit (413); diverse Guards (NaN, ResizeObserver).
- **Warum:** Nutzer wollte, dass nichts durch andere Runs kaputtgeht — ein Fehler darf nicht
  das ganze Dashboard reißen, DB-Hänger nur ein Widget degradieren.
- **Dateien:** `src/components/error-boundary.tsx`, `app/error.tsx`, `app/global-error.tsx`,
  `live-provider.tsx`, API-Routen, `lib/format.ts`.

### DB-Backup
- **Was:** `npm run backup` → konsistenter SQLite-Snapshot nach `backups/` (neueste 14).
- **Warum:** „Alles speichern" — sichere, wiederherstellbare Kopien, auch bei laufendem Server.
- **Dateien:** `scripts/backup.mjs`, `package.json`, `.gitignore`.

### 3D-Graph interaktiv + Glühen
- **Was:** Knoten anklickbar (Kamera-Fokus + Detailkarte), Vollbild-Button, aktive Sessions
  glühen sanft (UnrealBloom + dezenter Puls), aktive Linien leuchten, inaktive sichtbar gedimmt.
- **Warum:** Nutzer wollte Klick-für-Details, Vollbild, bessere Darstellung und aufleuchtende
  aktive Knoten — professionell/dezent.
- **Dateien:** `plugins/tool-graph/widget.tsx`, `force-graph.tsx`, `api/graph/route.ts`,
  `three` als Dependency.

### Stale-Sessions (kein ewiges „Wartet")
- **Was:** Sessions ohne Aktivität seit >30 min (nicht beendet) werden als beendet geführt
  (`MC_STALE_MINUTES`).
- **Warum:** Sessions hingen ewig in „Wartet"; `waiting` ist korrekt nach jedem Turn, aber
  ohne Auto-Idle füllte die Spalte sich endlos.
- **Dateien:** `api/sessions/route.ts`, `plugins/kanban/widget.tsx`.

### Port-3001-Fix (Ursache „keine Sessions")
- **Was:** Hooks in `~/.claude/settings.json` von Port 3000 → 3001 umgebogen; `.env` MC_PORT=3001.
- **Warum:** Dashboard lief auf 3001 (3000 belegt), Hooks sendeten an 3000 → DB blieb leer.
- **Dateien:** `~/.claude/settings.json` (außerhalb Repo), `.env`.
