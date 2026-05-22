"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

// Route-level recovery: if a server/render error bubbles up, show a recoverable
// screen instead of a blank page. Per-widget boundaries handle the common cases;
// this is the backstop.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-400/80" />
      <h1 className="text-lg font-semibold text-foreground">Etwas ist schiefgelaufen</h1>
      <p className="max-w-md break-words text-sm text-muted">{error.message || "Unbekannter Fehler"}</p>
      <button
        onClick={reset}
        className="mt-1 rounded-md border border-panel-border px-4 py-2 text-sm text-foreground transition-colors hover:border-accent/50"
      >
        Neu laden
      </button>
    </div>
  );
}
