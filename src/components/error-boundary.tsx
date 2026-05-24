"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Shown in the fallback so the user knows which panel failed. */
  label?: string;
  /** Translated strings (this is a class component → can't use the i18n hook). */
  couldNotLoad?: string;
  genericText?: string;
  retryLabel?: string;
  /** "Disable this widget" — hides a repeatedly-crashing plugin from the grid. */
  disableLabel?: string;
  onDisable?: () => void;
}
interface State {
  error: Error | null;
}

// Isolates each widget: a crash in one (e.g. WebGL/3D unavailable, a bad render)
// shows a local fallback instead of blanking the whole dashboard.
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Local-only tool: console is the log sink.
    console.error("Widget crashed:", error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-panel-border bg-panel/80 p-6 text-center text-sm text-muted">
          <AlertTriangle className="h-6 w-6 text-amber-400/80" />
          <p className="text-foreground">
            {this.props.label
              ? `${this.props.label} — ${this.props.couldNotLoad ?? "konnte nicht geladen werden."}`
              : (this.props.genericText ?? "Widget-Fehler.")}
          </p>
          <p className="max-w-[90%] break-words text-[11px] text-muted">{this.state.error.message}</p>
          <div className="mt-1 flex items-center gap-2">
            <button
              onClick={this.reset}
              className="rounded-md border border-panel-border px-3 py-1 text-xs text-foreground transition-colors hover:border-accent/50"
            >
              {this.props.retryLabel ?? "Erneut versuchen"}
            </button>
            {this.props.onDisable && (
              <button
                onClick={this.props.onDisable}
                className="rounded-md border border-panel-border px-3 py-1 text-xs text-muted transition-colors hover:border-red-400/50 hover:text-red-400"
              >
                {this.props.disableLabel ?? "Deaktivieren"}
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
