// Electron shell for Claude Mission Control.
//
// It runs the Next.js standalone server (the same server that exposes the
// /api/ingest write path + the SSE stream) as a child process using Electron's
// bundled Node, then shows it in a window. The server keeps running in the
// background (tray) so Claude Code hooks can forward activity even when the
// window is closed.

const { app, BrowserWindow, Tray, Menu, shell, dialog, Notification } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { isExternallyOpenable, isInternalNavigation } = require("./url-safety");

const PORT = process.env.MC_PORT || "3000";
const HOST = "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;

const isPackaged = app.isPackaged;
// In a packaged build the server + scripts ship under resources/ (extraResources);
// in dev we run straight from the project tree.
const RES = isPackaged ? process.resourcesPath : path.join(__dirname, "..");
const standaloneDir = isPackaged ? path.join(RES, "standalone") : path.join(RES, ".next", "standalone");
const serverJs = path.join(standaloneDir, "server.js");
const installHooksScript = path.join(isPackaged ? path.join(RES, "scripts") : path.join(RES, "scripts"), "install-hooks.mjs");
const trayIconPath = isPackaged ? path.join(RES, "Icon.png") : path.join(RES, "assets", "Icon.png");

const dataDir = path.join(app.getPath("userData"), "data");

let serverProc = null;
let win = null;
let tray = null;
let quitting = false;

// Single instance — the fixed port must not be bound twice.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());
  app.whenReady().then(main);
}

function startServer() {
  fs.mkdirSync(dataDir, { recursive: true });
  serverProc = spawn(process.execPath, [serverJs], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOSTNAME: HOST,
      PORT,
      MC_DATA_DIR: dataDir,
    },
    stdio: "ignore",
  });
  serverProc.on("exit", (code) => {
    if (!quitting && code) {
      dialog.showErrorBox(
        "Claude Mission Control",
        `The dashboard server stopped (exit ${code}). Port ${PORT} may be in use by another app.`,
      );
    }
  });
}

function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(BASE_URL, (res) => {
        res.destroy();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("server did not start in time"));
        else setTimeout(ping, 400);
      });
    };
    ping();
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: "#07090d",
    title: "Claude Mission Control",
    icon: trayIconPath,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(BASE_URL);
  // Open external links in the user's browser, not a new Electron window — but only
  // safe schemes (http/https/mailto); never hand file:/custom protocols to the OS.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternallyOpenable(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  // Keep in-window navigation on the local dashboard origin. Anything else is
  // blocked from loading and opened in the browser instead when it's a safe scheme.
  win.webContents.on("will-navigate", (e, url) => {
    if (!isInternalNavigation(url, BASE_URL)) {
      e.preventDefault();
      if (isExternallyOpenable(url)) shell.openExternal(url);
    }
  });
  // Close hides to tray so the ingest server keeps running in the background.
  win.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function showWindow() {
  if (!win) createWindow();
  else {
    win.show();
    win.focus();
  }
}

// Open the window straight onto the first-run setup wizard (force-opened via the
// ?onboarding=1 query the Onboarding component checks for).
function showOnboarding() {
  if (!win) createWindow();
  win.loadURL(`${BASE_URL}/?onboarding=1`);
  win.show();
  win.focus();
}

function connectClaude() {
  // Reuse the CLI wiring via Electron's bundled Node so no system Node is needed.
  const res = spawnSync(process.execPath, [installHooksScript], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", MC_PORT: PORT },
    encoding: "utf8",
  });
  const ok = res.status === 0;
  if (Notification.isSupported()) {
    new Notification({
      title: "Claude Mission Control",
      body: ok
        ? "Claude Code hooks connected. Restart running Claude Code sessions to see live activity."
        : "Could not wire hooks. See the app log for details.",
    }).show();
  }
  if (!ok) dialog.showErrorBox("Claude Mission Control", res.stderr || "Failed to wire Claude Code hooks.");
}

// Auto-start at login. Electron's setLoginItemSettings covers Windows + macOS;
// Linux uses an XDG autostart entry.
function enableAutostart() {
  try {
    if (process.platform === "linux") {
      const dir = path.join(os.homedir(), ".config", "autostart");
      fs.mkdirSync(dir, { recursive: true });
      const exec = process.env.APPIMAGE || process.execPath;
      fs.writeFileSync(
        path.join(dir, "claude-mission-control.desktop"),
        `[Desktop Entry]\nType=Application\nName=Claude Mission Control\nExec=${exec}\nX-GNOME-Autostart-enabled=true\nTerminal=false\n`,
      );
    } else {
      app.setLoginItemSettings({ openAtLogin: true });
    }
  } catch {
    /* autostart is a nicety — never block launch */
  }
}

function buildTray() {
  tray = new Tray(trayIconPath);
  tray.setToolTip("Claude Mission Control");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open dashboard", click: showWindow },
      { label: "Setup guide", click: showOnboarding },
      { label: "Connect Claude Code (install hooks)", click: connectClaude },
      { label: "Open in browser", click: () => shell.openExternal(BASE_URL) },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", showWindow);
}

async function main() {
  enableAutostart();
  buildTray();
  startServer();
  try {
    await waitForServer();
  } catch {
    dialog.showErrorBox("Claude Mission Control", "The dashboard server did not start.");
  }
  createWindow();

  app.on("activate", showWindow);
  app.on("before-quit", () => {
    quitting = true;
    if (serverProc) serverProc.kill();
  });
}
