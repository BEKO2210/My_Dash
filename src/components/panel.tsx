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
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-panel-border bg-panel/80 shadow-lg shadow-black/30 backdrop-blur",
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
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}
