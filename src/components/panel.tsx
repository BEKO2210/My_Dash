import { cn } from "@/lib/cn";
import { InfoHint } from "@/components/info-hint";
import { ScrollShadow } from "@/components/scroll-shadow";

export function Panel({
  title,
  icon,
  info,
  right,
  className,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  /** Optional short explanation shown via a small ℹ️ next to the title. */
  info?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-panel-border bg-panel/80 shadow-lg shadow-black/30 backdrop-blur transition-colors duration-300 hover:border-accent/20",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-panel-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
          {icon}
          <span>{title}</span>
          {info && <InfoHint text={info} />}
        </div>
        {right}
      </header>
      {/* ScrollShadow adds a top/bottom fade when the body overflows (a visible
          "you can scroll" hint) and keeps the region keyboard-reachable
          (WCAG 2.1.1, tabIndex) for panels whose content has no focusable element. */}
      <ScrollShadow tabIndex={0} className="outline-none">
        {children}
      </ScrollShadow>
    </section>
  );
}
