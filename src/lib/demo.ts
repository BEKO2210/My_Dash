// Client-side demo engine: simulates endless, realistic Claude Code activity so
// the dashboard animates live on a static site (GitHub Pages) — no server/DB.
// Exposes the same shapes as the real API routes; demo mode patches fetch +
// LiveProvider to read from here. Pure client-safe (no node imports).

import type { EventRow, SessionRow, StreamMessage } from "./types";

export const DEMO =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_MC_DEMO === "1";

const PROJECTS = ["mission-control", "shopify-bot", "api-gateway", "ml-pipeline", "docs-site"];
const PROMPTS = [
  "Fix the login redirect bug",
  "Add a dark-mode toggle",
  "Refactor the payment API",
  "Write tests for the parser",
  "Optimize the slow DB queries",
  "Add i18n (DE/EN) to the UI",
  "Build the 3D tool-call graph",
  "Set up CI on GitHub Actions",
  "Investigate the memory leak",
  "Polish the dashboard UI/UX",
  "Wire the webhook handler",
  "Cache the product listing",
];
const FILES = [
  "src/app/page.tsx",
  "src/lib/ingest.ts",
  "src/components/dashboard.tsx",
  "src/plugins/tool-graph/widget.tsx",
  "src/lib/db.ts",
  "src/api/orders.ts",
  "src/hooks/useCart.ts",
  "lib/auth/session.ts",
  "components/Chart.tsx",
  "server/routes/webhook.ts",
];
const COMMANDS = ["npm run build", "npm test", "git status", "git commit -m wip", "grep -r TODO src", "node scripts/seed.mjs", "npx tsc --noEmit", "npm install", "git push"];
const URLS = ["https://nextjs.org/docs", "https://react.dev/reference", "https://shopify.dev/api", "https://developer.mozilla.org", "https://docs.github.com/actions"];
const PATTERNS = ["TODO", "useEffect", "createOrder", "function ", "export const"];
const TOOLS = ["Read", "Edit", "Write", "Bash", "Grep", "WebFetch", "Task"];

type Kind = "file" | "command" | "url" | "pattern";
interface DTool {
  tool: string;
  key: string;
  label: string;
  kind: Kind;
  full: string;
}
interface DSession {
  id: string;
  project: string;
  title: string;
  status: "active" | "waiting" | "ended";
  first_seen: string;
  last_seen: string;
  ended_at: string | null;
  events: EventRow[];
  tools: DTool[];
  prompts: { text: string; created_at: string }[];
}

const sessions: DSession[] = [];
const allEvents: EventRow[] = [];
const listeners = new Set<(m: StreamMessage) => void>();
let eid = 1;
let started = false;

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const chance = (p: number) => Math.random() < p;
const dbNow = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function programName(cmd: string): string {
  const tok = cmd.trim().split(/\s+/);
  let i = 0;
  while (i < tok.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tok[i])) i++;
  let p = tok[i] || cmd;
  if (p === "cd" && tok[i + 1]) p = tok[i + 1];
  return p.includes("/") ? p.split("/").pop() || p : p;
}

function describeTarget(tool: string): { target: DTool; summary: string } {
  if (tool === "Bash") {
    const full = pick(COMMANDS);
    return { target: { tool, key: `cmd:${programName(full)}`, label: programName(full), kind: "command", full }, summary: clip(full, 60) };
  }
  if (tool === "WebFetch") {
    const full = pick(URLS);
    const host = new URL(full).host;
    return { target: { tool, key: `u:${host}`, label: host, kind: "url", full }, summary: host };
  }
  if (tool === "Grep") {
    const full = pick(PATTERNS);
    return { target: { tool, key: `q:${full}`, label: full, kind: "pattern", full }, summary: full };
  }
  // Read/Edit/Write/Task → a file (Task handled separately for graph prompts)
  const full = pick(FILES);
  const label = full.split("/").slice(-2).join("/");
  return { target: { tool, key: `f:${full}`, label, kind: "file", full }, summary: label };
}

function toRow(s: DSession): SessionRow {
  return {
    id: s.id,
    project_path: `/home/dev/${s.project}`,
    project_name: s.project,
    title: s.title,
    status: s.status,
    source: "demo",
    first_seen: s.first_seen,
    last_seen: s.last_seen,
    ended_at: s.ended_at,
    token_input: s.events.length * 800,
    token_output: s.events.length * 220,
    token_cache: s.events.length * 300,
    cost_usd: +(s.events.length * 0.02).toFixed(3),
    branch: null,
    git_commit: null,
  };
}

function emit(s: DSession, eventType: string, toolName: string | null, summary: string) {
  const ev: EventRow = {
    id: eid++,
    session_id: s.id,
    event_type: eventType,
    tool_name: toolName,
    model: null,
    summary,
    payload_json: "{}",
    created_at: dbNow(),
  };
  s.events.push(ev);
  s.last_seen = ev.created_at;
  allEvents.push(ev);
  if (allEvents.length > 800) allEvents.splice(0, allEvents.length - 800);
  const session = toRow(s);
  for (const l of listeners) l({ event: ev, session });
}

function newSession() {
  const project = pick(PROJECTS);
  const title = pick(PROMPTS);
  const now = dbNow();
  const s: DSession = {
    id: "demo-" + Math.random().toString(36).slice(2, 10),
    project,
    title,
    status: "active",
    first_seen: now,
    last_seen: now,
    ended_at: null,
    events: [],
    tools: [],
    prompts: [],
  };
  sessions.push(s);
  while (sessions.length > 7) sessions.shift();
  emit(s, "SessionStart", null, "Session started (demo)");
  s.prompts.push({ text: title, created_at: now });
  emit(s, "UserPromptSubmit", null, "Prompt: " + clip(title, 70));
}

function step() {
  const live = sessions.filter((s) => s.status !== "ended");
  if (live.length < 3 || chance(0.14)) {
    newSession();
    return;
  }
  const s = pick(live);
  const r = Math.random();
  if (r < 0.68) {
    const tool = pick(TOOLS);
    if (tool === "Task") {
      const text = "Subagent: " + pick(PROMPTS);
      emit(s, "PreToolUse", "Task", "Task: " + clip(text, 60));
      emit(s, "PostToolUse", "Task", "Task ✓ " + clip(text, 60));
      s.tools.push({ tool: "Task", key: `pa:${s.id}:${eid}`, label: clip(text, 32), kind: "file", full: text });
    } else {
      const { target, summary } = describeTarget(tool);
      emit(s, "PreToolUse", tool, `${tool}: ${summary}`);
      emit(s, "PostToolUse", tool, `${tool} ✓ ${summary}`);
      s.tools.push(target);
    }
    s.status = "active";
  } else if (r < 0.8) {
    emit(s, "Stop", null, "Response complete — waiting for input");
    s.status = "waiting";
  } else if (r < 0.87) {
    emit(s, "SessionEnd", null, "Session ended (clear)");
    s.status = "ended";
    s.ended_at = dbNow();
  } else {
    const text = pick(PROMPTS);
    s.prompts.push({ text, created_at: dbNow() });
    emit(s, "UserPromptSubmit", null, "Prompt: " + clip(text, 70));
    s.status = "active";
  }
}

export function startDemo() {
  if (started) return;
  started = true;
  for (let i = 0; i < 4; i++) newSession();
  for (let i = 0; i < 30; i++) step(); // pre-warm so the graph isn't empty
  setInterval(step, 1100);
}

// ── API-shaped getters ───────────────────────────────────────────────────────

export function demoSessions() {
  return sessions
    .slice()
    .reverse()
    .map((s) => ({
      ...toRow(s),
      event_count: s.events.length,
      tool_count: s.tools.length,
      stale: false,
    }));
}

export function demoEvents(limit = 100, sessionId?: string) {
  const src = sessionId ? allEvents.filter((e) => e.session_id === sessionId) : allEvents;
  return src.slice(-limit).reverse();
}

export function demoGraph() {
  type Node = { id: string; label: string; type: string; val: number; meta?: Record<string, unknown> };
  const nodes = new Map<string, Node>();
  const links: { source: string; target: string }[] = [];
  const seen = new Set<string>();
  const link = (a: string, b: string) => {
    const k = `${a}->${b}`;
    if (seen.has(k)) return;
    seen.add(k);
    links.push({ source: a, target: b });
  };
  const add = (id: string, label: string, type: string, meta?: Record<string, unknown>) => {
    const n = nodes.get(id);
    if (n) {
      n.val += 1;
      if (n.meta) n.meta.calls = ((n.meta.calls as number) ?? 1) + 1;
    } else nodes.set(id, { id, label, type, val: 1, meta: { ...meta, calls: 1 } });
  };

  for (const s of sessions) {
    const sid = `s:${s.id}`;
    nodes.set(sid, {
      id: sid,
      label: s.title,
      type: "session",
      val: 3,
      meta: { sessionId: s.id, project: s.project, status: s.status, lastSeen: s.last_seen },
    });
    s.prompts.forEach((p, i) => {
      const pid = `p:${s.id}:${i}`;
      nodes.set(pid, { id: pid, label: clip(p.text, 32), type: "prompt", val: 1.8, meta: { role: "user", text: p.text, lastSeen: p.created_at } });
      link(sid, pid);
    });
    for (const tc of s.tools) {
      const tid = `t:${s.id}:${tc.tool}`;
      add(tid, tc.tool, "tool");
      link(sid, tid);
      if (tc.tool === "Task") {
        add(tc.key, tc.label, "prompt", { role: "agent", text: tc.full });
        link(tid, tc.key);
      } else {
        add(tc.key, tc.label, "file", { path: tc.full, kind: tc.kind });
        link(tid, tc.key);
      }
    }
  }
  const linked = new Set<string>();
  for (const l of links) {
    linked.add(l.source);
    linked.add(l.target);
  }
  return { nodes: [...nodes.values()].filter((n) => linked.has(n.id)), links };
}

export function demoUsage() {
  const rate = 0.92;
  const day = (date: string, scale: number) => {
    const input = Math.round(20000 * scale + Math.random() * 8000);
    const output = Math.round(60000 * scale + Math.random() * 20000);
    const cacheTokens = Math.round(3_000_000 * scale + Math.random() * 2_000_000);
    const totalTokens = input + output + cacheTokens;
    const costUsd = +(2 + scale * 5 + Math.random() * 3).toFixed(2);
    return { date, inputTokens: input, outputTokens: output, cacheTokens, totalTokens, costUsd, costEur: +(costUsd * rate).toFixed(2) };
  };
  const today = new Date();
  const d = (off: number) => new Date(today.getTime() - off * 86400000).toISOString().slice(0, 10);
  const days = [day(d(2), 0.7), day(d(1), 1), day(d(0), 1.3)];

  const blocks = [0, 1, 2, 3].map((i) => {
    const start = new Date(today.getTime() - (3 - i) * 5 * 3600000).toISOString();
    const base = day("", 0.4 + i * 0.4);
    return {
      start,
      isActive: i === 3,
      inputTokens: base.inputTokens,
      outputTokens: base.outputTokens,
      cacheTokens: base.cacheTokens,
      totalTokens: base.totalTokens,
      costUsd: base.costUsd,
      costEur: base.costEur,
    };
  });

  const totals = days.reduce(
    (a, x) => {
      a.inputTokens += x.inputTokens;
      a.outputTokens += x.outputTokens;
      a.cacheTokens += x.cacheTokens;
      a.totalTokens += x.totalTokens;
      a.costUsd += x.costUsd;
      a.costEur += x.costEur;
      return a;
    },
    { inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, costEur: 0 },
  );
  const models = [
    { model: "claude-opus-4-7", share: 0.7 },
    { model: "claude-sonnet-4-6", share: 0.3 },
  ].map((m) => ({
    model: m.model,
    inputTokens: Math.round(totals.inputTokens * m.share),
    outputTokens: Math.round(totals.outputTokens * m.share),
    cacheTokens: Math.round(totals.cacheTokens * m.share),
    totalTokens: Math.round(totals.totalTokens * m.share),
    costUsd: +(totals.costUsd * m.share).toFixed(2),
    costEur: +(totals.costEur * m.share).toFixed(2),
  }));

  const months = [2, 1, 0].map((off) => {
    const m = new Date(today.getFullYear(), today.getMonth() - off, 1);
    const base = day("", 6 + off);
    return { ...base, date: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}` };
  });

  const burn = {
    tokensPerMinute: 1800,
    costPerHour: 4.5,
    projectedCostUsd: 9,
    projectedCostEur: +(9 * rate).toFixed(2),
    remainingMinutes: 95,
  };

  return { days, months, blocks, burn, models, totals, available: true };
}

export function demoBudget() {
  const u = demoUsage();
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const dSpent = u.days.find((d) => d.date === today)?.costUsd ?? 0;
  const mSpent = u.months.find((m) => m.date === month)?.costUsd ?? 0;
  const dailyUsd = 15;
  const monthlyUsd = 300;
  const gauge = (spentUsd: number, budgetUsd: number) => ({ budgetUsd, spentUsd, pct: spentUsd / budgetUsd });
  return {
    budgets: { dailyUsd, monthlyUsd },
    status: { daily: gauge(dSpent, dailyUsd), monthly: gauge(mSpent, monthlyUsd) },
  };
}

export function demoSubscribe(fn: (m: StreamMessage) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// In demo mode, start the engine and serve /api/* from it via a fetch patch, so
// the unmodified widgets work without any server.
let patched = false;
export function installDemoBackend() {
  if (!DEMO || typeof window === "undefined" || patched) return;
  patched = true;
  startDemo();
  const orig = window.fetch.bind(window);
  const json = (data: unknown) =>
    new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let path = raw;
    try {
      path = new URL(raw, window.location.href).pathname;
    } catch {
      /* keep raw */
    }
    if (path.endsWith("/api/sessions")) return json({ sessions: demoSessions() });
    if (path.endsWith("/api/graph")) return json(demoGraph());
    if (path.endsWith("/api/usage")) return json(demoUsage());
    if (path.endsWith("/api/budget")) return json(demoBudget());
    if (path.includes("/api/events")) {
      const u = new URL(raw, window.location.href);
      const limit = Number(u.searchParams.get("limit")) || 100;
      const sid = u.searchParams.get("session") || undefined;
      return json({ events: demoEvents(limit, sid) });
    }
    return orig(input, init);
  };
}
