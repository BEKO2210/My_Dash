#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Claude Mission Control — one-click install & launch.
# Double-click the desktop launcher this creates, or run:  ./install.sh
# It installs deps, wires the Claude Code hooks, builds, starts on 127.0.0.1,
# opens your browser, and drops a desktop launcher for next time.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"
ROOT="$(pwd)"

say() { printf "\033[1;34m›\033[0m %s\n" "$*"; }
ok() { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m✗\033[0m %s\n" "$*"; }

if ! command -v node >/dev/null 2>&1; then
  err "Node.js fehlt. Bitte installieren: https://nodejs.org  (LTS)"
  read -rp "Enter zum Schließen… " _ 2>/dev/null || true
  exit 1
fi

# Load local config (port etc.).
# Default port is 3000 everywhere (next dev/start, electron, hook forwarder) so
# the wired hooks always point at the port the dashboard actually serves; override
# with MC_PORT (env or .env) if 3000 is taken.
if [ -f .env ]; then set -a; . ./.env; set +a; fi
PORT="${MC_PORT:-3000}"

# 1) Dependencies
if [ ! -d node_modules ]; then
  say "Installiere Abhängigkeiten…"; npm install
else
  ok "Abhängigkeiten vorhanden"
fi

# 2) Claude Code hooks → forward activity to this dashboard on the right port
say "Verdrahte Claude-Code-Hooks (Port $PORT)…"
MC_PORT="$PORT" node scripts/install-hooks.mjs || err "Hooks konnten nicht verdrahtet werden (Dashboard läuft trotzdem)."

# 3) Build (only if missing — keeps relaunch fast)
if [ ! -d .next ]; then
  say "Baue…"; npm run build
else
  ok "Build vorhanden (überspringe — für Neubau: npm run build)"
fi

# 4) Start (skip if already running on the port)
if curl -s -o /dev/null "http://127.0.0.1:${PORT}/" 2>/dev/null; then
  ok "Dashboard läuft bereits auf Port $PORT"
else
  say "Starte auf http://127.0.0.1:${PORT} …"
  PORT="$PORT" nohup npm run start >/tmp/mc-dashboard.log 2>&1 &
  for _ in $(seq 1 60); do
    curl -s -o /dev/null "http://127.0.0.1:${PORT}/" 2>/dev/null && break
    sleep 1
  done
fi

# 5) Desktop launcher (idempotent) for one-click relaunch
DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
mkdir -p "$DESKTOP_DIR"
LAUNCHER="$DESKTOP_DIR/Claude Mission Control.desktop"
cat > "$LAUNCHER" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Claude Mission Control
Comment=Local read-only dashboard for Claude Code
Exec=bash -c "'$ROOT/install.sh'"
Icon=$ROOT/assets/logo.svg
Terminal=true
Categories=Development;Utility;
DESKTOP
chmod +x "$LAUNCHER" 2>/dev/null || true
# GNOME: mark as trusted so double-click runs it without the "untrusted" prompt
gio set "$LAUNCHER" metadata::trusted true 2>/dev/null || true
ok "Desktop-Verknüpfung erstellt: $LAUNCHER"

# 6) Open browser
( command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:${PORT}/" ) >/dev/null 2>&1 || true
ok "Läuft → http://127.0.0.1:${PORT}   (Log: /tmp/mc-dashboard.log)"
