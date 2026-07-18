// Pure flight math for the CameraRig — no three.js, no React, no DOM.
// Everything here operates on plain [x,y,z] tuples and scalars so it can be
// unit-tested headlessly under node (see src/scene/__checks__/flight.check.mjs).
//
// A "flight" is a parametric dolly from one camera pose to another. The rig
// owns a single mutable Flight at a time and rebuilds it (from the CURRENT
// pose) on every retarget, which is what makes mid-flight redirects continuous
// instead of snapping.
//
// Motion feel:
//   - position follows `flightEase`: quintic ease-in-out (smooth accelerate,
//     smooth decelerate) plus a small, bounded overshoot bump so the camera
//     drifts ~1.6% past the target and settles back — physical, no wobble.
//   - the look target and fov follow plain quintic ease-in-out (no overshoot),
//     so the AIM never oscillates even while the position gently overshoots.

export type V3 = [number, number, number];

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Quintic ease-in-out. Monotonic 0->1, zero velocity at both ends. */
export function quintInOut(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

// Overshoot bump: t^4 * (1 - t), normalized so its peak (at t = 0.8) equals 1.
//   peak value of t^4*(1-t) = 0.8^4 * 0.2 = 0.08192
const BUMP_PEAK = 0.08192;
export function overshootBump(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  return (t * t * t * t * (1 - t)) / BUMP_PEAK;
}

/** Peak overshoot amplitude added to the eased position curve. */
export const OVERSHOOT = 0.018;

/**
 * Position easing with a small terminal overshoot. flightEase(0)=0,
 * flightEase(1)=1 exactly (the bump is 0 at both ends), and the curve peaks a
 * little above 1 near t≈0.86 before settling. Because quintInOut(t) < 1 where
 * the bump peaks, the realized overshoot is strictly less than OVERSHOOT.
 */
export function flightEase(t: number): number {
  const c = clamp01(t);
  return quintInOut(c) + OVERSHOOT * overshootBump(c);
}

export interface Flight {
  from: V3;
  fromLook: V3;
  to: V3;
  toLook: V3;
  fromFov: number;
  toFov: number;
  /** seconds elapsed since this flight began */
  elapsed: number;
  /** total seconds; 0 means an instant cut (reduced motion) */
  duration: number;
  /** true for reduced-motion instant cuts */
  instant: boolean;
}

/** Distance-scaled flight duration, clamped to a pleasant window. */
export function flightDuration(
  from: V3,
  to: V3,
  base = 1.15,
  perMeter = 0.22,
  min = 1.2,
  max = 1.6,
): number {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const dur = base + d * perMeter;
  return dur < min ? min : dur > max ? max : dur;
}

/**
 * Build a fresh flight. `from`/`fromLook` are COPIED, so callers pass the live
 * (current) pose and the flight is decoupled from later mutation of it. When
 * `instant` is true the duration collapses to 0 (a cut).
 */
export function makeFlight(
  from: V3,
  fromLook: V3,
  fromFov: number,
  to: V3,
  toLook: V3,
  toFov: number,
  duration: number,
  instant = false,
): Flight {
  return {
    from: [from[0], from[1], from[2]],
    fromLook: [fromLook[0], fromLook[1], fromLook[2]],
    to: [to[0], to[1], to[2]],
    toLook: [toLook[0], toLook[1], toLook[2]],
    fromFov,
    toFov,
    elapsed: 0,
    duration: instant ? 0 : duration,
    instant,
  };
}

export function advance(f: Flight, dt: number): void {
  f.elapsed += dt;
}

/** Clamped normalized progress in [0,1]. */
export function flightProgress(f: Flight): number {
  if (f.duration <= 0) return 1;
  return clamp01(f.elapsed / f.duration);
}

/** True once the flight has run its full duration (t clamps at 1). */
export function flightArrived(f: Flight): boolean {
  return f.elapsed >= f.duration;
}

/** Sample the (overshooting) position into `out`. */
export function samplePos(f: Flight, out: V3): void {
  const e = flightEase(flightProgress(f));
  out[0] = f.from[0] + (f.to[0] - f.from[0]) * e;
  out[1] = f.from[1] + (f.to[1] - f.from[1]) * e;
  out[2] = f.from[2] + (f.to[2] - f.from[2]) * e;
}

/** Sample the (non-overshooting) look target into `out`. */
export function sampleLook(f: Flight, out: V3): void {
  const e = quintInOut(flightProgress(f));
  out[0] = f.fromLook[0] + (f.toLook[0] - f.fromLook[0]) * e;
  out[1] = f.fromLook[1] + (f.toLook[1] - f.fromLook[1]) * e;
  out[2] = f.fromLook[2] + (f.toLook[2] - f.fromLook[2]) * e;
}

/** Sample the eased fov. */
export function sampleFov(f: Flight): number {
  const e = quintInOut(flightProgress(f));
  return f.fromFov + (f.toFov - f.fromFov) * e;
}
