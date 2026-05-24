"use client";

import { useT } from "@/lib/i18n";
import { relativeTime } from "@/lib/format";
import { diffLines, diffStat, type DiffLine } from "@/lib/diff";
import { JsonTree } from "@/components/json-tree";
import type { ToolCallDetail } from "@/lib/errors";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

// Detect an Edit-style change (old_string → new_string).
function editPair(input: unknown): { old: string; next: string } | null {
  const o = asRecord(input);
  if (o && typeof o.old_string === "string" && typeof o.new_string === "string") {
    return { old: o.old_string, next: o.new_string };
  }
  return null;
}

// Detect a Write/NotebookEdit-style full content payload.
function writeContent(input: unknown): string | null {
  const o = asRecord(input);
  if (!o) return null;
  if (typeof o.content === "string") return o.content;
  if (typeof o.new_source === "string") return o.new_source;
  return null;
}

export function ToolCallInspector({ detail }: { detail: ToolCallDetail }) {
  const { t, lang } = useT();
  const edit = editPair(detail.input);
  const write = edit ? null : writeContent(detail.input);
  const diff = edit ? diffLines(edit.old, edit.next) : write != null ? diffLines("", write) : null;

  return (
    <div className="space-y-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
        <span className="font-mono text-foreground">{detail.tool_name}</span>
        {detail.target && (
          <span className="truncate font-mono" title={detail.target}>
            {detail.target}
          </span>
        )}
        <span className={detail.success === 0 ? "text-red-400" : "text-emerald-400"}>
          {detail.success === 0 ? t("inspector.failed") : t("inspector.ok")}
        </span>
        <span className="ml-auto whitespace-nowrap">{relativeTime(detail.created_at, lang)}</span>
      </div>

      {detail.error_text && (
        <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 p-2 font-mono text-red-400/90">
          {detail.error_text}
        </pre>
      )}

      {diff ? (
        <Diff lines={diff} label={edit ? t("inspector.diff") : t("inspector.newContent")} />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Pane label={t("inspector.input")} value={detail.input} />
          <Pane label={t("inspector.output")} value={detail.output} />
        </div>
      )}
    </div>
  );
}

function Pane({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-0.5 uppercase tracking-wide text-muted">{label}</p>
      <div className="max-h-40 overflow-auto rounded bg-black/30 p-2">
        {value && typeof value === "object" ? (
          <JsonTree data={value} />
        ) : (
          <span className="font-mono text-foreground">{value == null ? "—" : String(value)}</span>
        )}
      </div>
    </div>
  );
}

function Diff({ lines, label }: { lines: DiffLine[]; label: string }) {
  const { added, removed } = diffStat(lines);
  return (
    <div>
      <p className="mb-0.5 flex items-center gap-2 uppercase tracking-wide text-muted">
        {label}
        <span className="text-emerald-400">+{added}</span>
        <span className="text-red-400">−{removed}</span>
      </p>
      <pre className="max-h-56 overflow-auto rounded bg-black/30 font-mono leading-relaxed">
        {lines.map((l, i) => (
          <div
            key={i}
            className={
              l.type === "add"
                ? "bg-emerald-500/10 text-emerald-300"
                : l.type === "del"
                  ? "bg-red-500/10 text-red-300"
                  : "text-muted"
            }
          >
            <span className="select-none px-2 text-muted">
              {l.type === "add" ? "+" : l.type === "del" ? "−" : " "}
            </span>
            {l.text || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}
