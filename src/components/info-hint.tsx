"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

// Small, unobtrusive info affordance: a muted ℹ️ icon that reveals a short
// explanation on hover or keyboard focus. Pure CSS (no state) so it's cheap to
// sprinkle everywhere; pointer-events-none on the bubble avoids flicker.
export function InfoHint({
  text,
  align = "left",
  className,
}: {
  text: string;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <span className={cn("group/info relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label="Info"
        className="text-muted/50 outline-none transition-colors hover:text-muted focus-visible:text-accent"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full z-50 mt-1.5 w-56 rounded-md border border-panel-border bg-panel/95 px-3 py-2 text-[11px] font-normal leading-relaxed text-muted opacity-0 shadow-xl shadow-black/40 backdrop-blur transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {text}
      </span>
    </span>
  );
}
