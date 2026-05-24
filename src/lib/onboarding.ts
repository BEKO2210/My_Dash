// First-run onboarding state. A single localStorage flag marks the wizard as seen;
// a ?onboarding=1 query param (used by the Electron tray "Setup guide") force-opens it.

export const ONBOARDED_KEY = "mc-onboarded";

export function shouldShowOnboarding(opts: { dismissed: boolean; forced: boolean }): boolean {
  return opts.forced || !opts.dismissed;
}
