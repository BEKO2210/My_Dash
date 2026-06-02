"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// A scroll container that shows a soft fade at the top/bottom edge whenever there
// is more content to scroll in that direction — a clear "you can scroll" hint that
// works regardless of whether the OS draws a visible scrollbar. Pure presentation:
// it never changes what the widget renders, only signals overflow.
export function ScrollShadow({
  className,
  children,
  tabIndex,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight - clientHeight;
    setEdge({
      top: scrollTop > 2,
      bottom: overflow > 2 && scrollTop < overflow - 2,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    // Recompute when the container or its content resizes (data load, view switch,
    // widget resize) so the hint appears/disappears as overflow changes.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={ref} tabIndex={tabIndex} className={cn("h-full overflow-auto", className)} {...rest}>
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-panel to-transparent transition-opacity duration-200",
          edge.top ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-panel to-transparent transition-opacity duration-200",
          edge.bottom ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
