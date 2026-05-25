import { Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// Shared centered placeholder for a widget's empty / no-results / loading / error
// states, so every panel looks and behaves the same. Lives inside a Panel's body.
// Pass `onRetry` to render the error variant (icon + message + a retry button).
export function WidgetState({
  icon: Icon,
  title,
  description,
  loading = false,
  onRetry,
  retryLabel,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  loading?: boolean;
  /** When set, renders a retry button — used by the fetch-error state. */
  onRetry?: () => void;
  /** Accessible label/text for the retry button (i18n: `common.retry`). */
  retryLabel?: string;
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
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label={retryLabel}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-panel-border px-2.5 py-1 text-xs text-foreground transition-colors hover:border-accent/50 hover:text-accent"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
