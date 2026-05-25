import { cn } from "@/lib/cn";
import { InfoHint } from "@/components/info-hint";

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
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-panel-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
          {icon}
          <span>{title}</span>
          {info && <InfoHint text={info} />}
        </div>
        {right}
      </header>
      {/* tabIndex makes the scroll region keyboard-reachable (WCAG 2.1.1) for panels
          whose content has no other focusable element. */}
      <div tabIndex={0} className="min-h-0 flex-1 overflow-auto outline-none">
        {children}
      </div>
    </section>
  );
}
