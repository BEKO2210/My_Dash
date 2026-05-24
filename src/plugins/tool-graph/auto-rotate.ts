// Z-Demo-4 — epic auto-rotation timing for the 3D tool-graph.
//
// The graph idles with a slow, steady (epic) auto-rotation. When the user grabs
// it, rotation stops; once they let go we wait RESUME_DELAY_MS, then ease the
// speed back up over RAMP_MS so it resumes gently (never snaps back to full).
// This module is the pure timing core so it can be unit-tested without WebGL.

export const RESUME_DELAY_MS = 15_000;
export const RAMP_MS = 1_500;
// OrbitControls.autoRotateSpeed: ~75s per orbit — slow and majestic.
export const AUTO_ROTATE_SPEED = 0.8;

// Target auto-rotate speed given how long ago the last manual interaction ended.
// `null` means the user has never touched the graph → idle epic spin. During the
// interaction and the RESUME_DELAY_MS pause the speed is 0; afterwards it eases
// linearly from 0 to full over RAMP_MS.
export function autoRotateSpeed(msSinceInteractionEnd: number | null): number {
  if (msSinceInteractionEnd === null) return AUTO_ROTATE_SPEED;
  if (msSinceInteractionEnd < RESUME_DELAY_MS) return 0;
  const k = Math.min(1, (msSinceInteractionEnd - RESUME_DELAY_MS) / RAMP_MS);
  return +(AUTO_ROTATE_SPEED * k).toFixed(4);
}
