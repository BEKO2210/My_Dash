"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Shown in the fallback so the user knows which panel failed. */
  label?: string;
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
            {this.props.label ? `„${this.props.label}" konnte nicht geladen werden.` : "Widget-Fehler."}
          </p>
          <p className="max-w-[90%] break-words text-[11px] text-muted/70">{this.state.error.message}</p>
          <button
            onClick={this.reset}
            className="mt-1 rounded-md border border-panel-border px-3 py-1 text-xs text-foreground transition-colors hover:border-accent/50"
          >
            Erneut versuchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
