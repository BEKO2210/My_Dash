import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// Shared centered placeholder for a widget's empty / no-results / loading / error
// states, so every panel looks and behaves the same. Lives inside a Panel's body.
export function WidgetState({
  icon: Icon,
  title,
  description,
  loading = false,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin opacity-60" aria-hidden />
      ) : (
        Icon && <Icon className="h-6 w-6 opacity-50" aria-hidden />
      )}
      <p className="max-w-xs">{title}</p>
      {description && <div className="max-w-xs text-xs">{description}</div>}
    </div>
  );
}
