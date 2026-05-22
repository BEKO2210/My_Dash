"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

// Soft lock for the dashboard controls. The dashboard stays fully viewable; only
// the controls that *change* something (filters, fullscreen, mode, graph clicks)
// are gated behind a PIN. Default is UNLOCKED — you opt into protection by
// clicking the lock; unlocking again needs the PIN.
// This is a local-only convenience guard against accidental changes — NOT real
// security (the PIN lives client-side).
const PIN = (process.env.NEXT_PUBLIC_MC_PIN || "0000").trim();
const STORAGE_KEY = "mc-locked";

// Tiny external store over sessionStorage so the lock state is hydration-safe
// (unlocked on the server + first client render) and reacts to same-tab and
// cross-tab changes without setState-in-effect.
const listeners = new Set<() => void>();

function readLocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocked(value: boolean) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

interface LockValue {
  locked: boolean;
  /** Returns true on success (correct PIN). */
  unlock: (pin: string) => boolean;
  lock: () => void;
}

const LockContext = createContext<LockValue>({
  locked: false,
  unlock: () => false,
  lock: () => {},
});

export function LockProvider({ children }: { children: React.ReactNode }) {
  const locked = useSyncExternalStore(subscribe, readLocked, () => false);

  const unlock = useCallback((pin: string) => {
    if (pin.trim() === PIN) {
      writeLocked(false);
      return true;
    }
    return false;
  }, []);

  const lock = useCallback(() => writeLocked(true), []);

  return <LockContext.Provider value={{ locked, unlock, lock }}>{children}</LockContext.Provider>;
}

export function useLock(): LockValue {
  return useContext(LockContext);
}
