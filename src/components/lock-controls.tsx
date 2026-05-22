"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Unlock, X } from "lucide-react";
import { useLock } from "@/components/lock-provider";

// Header chip + PIN modal. Locked: shows "Gesperrt", click opens the PIN dialog.
// Unlocked: shows "Entsperrt", click re-locks immediately.
export function LockButton() {
  const { locked, unlock, lock } = useLock();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => (locked ? setOpen(true) : lock())}
        title={locked ? "Zum Ändern entsperren (PIN)" : "Wieder sperren"}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
          locked
            ? "border-amber-500/30 text-amber-400 hover:border-amber-500/60"
            : "border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60"
        }`}
      >
        {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{locked ? "Gesperrt" : "Entsperrt"}</span>
      </button>
      {open && <PinDialog onClose={() => setOpen(false)} onSubmit={unlock} />}
    </>
  );
}

function PinDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (pin: string) => boolean;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (onSubmit(pin)) onClose();
    else {
      setError(true);
      setPin("");
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-xl border border-panel-border bg-panel p-5 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lock className="h-4 w-4 text-amber-400" /> PIN eingeben
          </span>
          <button onClick={onClose} className="text-muted hover:text-foreground" title="Schließen">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
            setError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="••••"
          className={`w-full rounded-md border bg-background px-3 py-2 text-center font-mono text-lg tracking-[0.5em] text-foreground outline-none ${
            error ? "border-red-500" : "border-panel-border focus:border-accent"
          }`}
        />
        {error && <p className="mt-2 text-center text-xs text-red-400">Falscher PIN</p>}

        <button
          onClick={submit}
          className="mt-4 w-full rounded-md bg-accent/20 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/30"
        >
          Entsperren
        </button>
        <p className="mt-3 text-center text-[10px] text-muted/60">
          Lokaler Schutz vor versehentlichem Ändern — keine echte Sicherheit.
        </p>
      </div>
    </div>
  );
}
