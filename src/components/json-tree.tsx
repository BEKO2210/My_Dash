"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isExpandable, nodeSummary, valueKind, type JsonKind } from "@/lib/json-tree";

const COLOR: Record<JsonKind, string> = {
  string: "text-emerald-400",
  number: "text-sky-400",
  boolean: "text-amber-400",
  null: "text-muted",
  object: "text-foreground",
  array: "text-foreground",
};

// Collapsible JSON viewer. Containers lazily render children only when open;
// each node is type-coloured. `defaultDepth` controls how deep it starts open.
export function JsonTree({ data, defaultDepth = 1 }: { data: unknown; defaultDepth?: number }) {
  return (
    <div className="font-mono text-[11px] leading-relaxed">
      <JsonNode value={data} name={null} depth={0} defaultDepth={defaultDepth} />
    </div>
  );
}

function JsonNode({
  value,
  name,
  depth,
  defaultDepth,
}: {
  value: unknown;
  name: string | null;
  depth: number;
  defaultDepth: number;
}) {
  const [open, setOpen] = useState(depth < defaultDepth);
  const kind = valueKind(value);
  const key = name !== null ? <span className="text-violet-300">{name}: </span> : null;

  if (!isExpandable(value)) {
    return (
      <div className="py-px" style={{ paddingLeft: depth * 12 + 16 }}>
        {key}
        <span className={COLOR[kind]}>{nodeSummary(value)}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 py-px text-left transition-colors hover:bg-white/[0.03]"
        style={{ paddingLeft: depth * 12 }}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted" />
        )}
        {key}
        <span className="text-muted">{nodeSummary(value)}</span>
      </button>
      {open &&
        entries.map(([k, v]) => (
          <JsonNode key={k} value={v} name={k} depth={depth + 1} defaultDepth={defaultDepth} />
        ))}
    </div>
  );
}
