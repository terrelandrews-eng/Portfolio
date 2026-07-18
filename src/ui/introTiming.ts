// Intro-sequence timings (M6.1) — the ONE place these live. Shared by
// IntroOverlay.tsx (phase timers + overlay fade), CameraRig.tsx (the fly-in
// dolly duration), and HudRoot.tsx (HUD fade-in lead). Keep every intro
// duration here so the sequence stays in sync across those three consumers.
//
// Total budget ~3.2s: HOLD (1.0s) + FLY-IN (2.2s) ≈ 3.2s. The reduced-motion
// path collapses to a single static hold (0.4s) then straight to 'done'. The
// failsafe (4.5s from mount) forces 'done' no matter what.

export const INTRO_TIMING = {
  /**
   * 'hold' phase: title card on the near-black overlay, camera parked. Long
   * enough for the title's typewriter (finishes ~720ms after mount) to fully
   * land and hold a beat before the fly-in begins and the curtain fades.
   */
  holdMs: 1000,
  /** 'flyin' phase: camera dollies from the desk to the seat. */
  flyinMs: 2200,
  /** Overlay fade-out at the START of the fly-in (first beat of flyin). */
  overlayFadeMs: 800,
  /** HUD begins fading in this many ms before the fly-in ends (last beat). */
  hudFadeLeadMs: 600,
  /** Reduced motion: static hold of the card, opacity cut, then 'done'. */
  reducedHoldMs: 400,
  /** Hard failsafe from overlay mount — forces 'done' regardless of state. */
  failsafeMs: 4500,
} as const;
