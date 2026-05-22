import { cn } from "@/lib/cn";

export function Panel({
  title,
  icon,
  right,
  className,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
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
        </div>
        {right}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}
