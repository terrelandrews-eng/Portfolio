// Headless logic check for the CameraRig flight math (src/scene/flight.ts).
//
// flight.ts has zero imports, so compile it standalone and point this file at
// the emitted module:
//
//   OUT=/tmp/flight.mjs
//   npx tsc src/scene/flight.ts --ignoreConfig --outDir "$(dirname "$OUT")" \
//     --target es2022 --module esnext --moduleResolution bundler
//   mv "$(dirname "$OUT")/flight.js" "$OUT"
//   node src/scene/__checks__/flight.check.mjs "$OUT"
//
// (--ignoreConfig is required by the repo's TS 7 native compiler when files are
//  passed on the command line; flight.ts has no imports so this is safe.)
//
// Asserts: monotonic timeline arrival, position overshoot ≤ 2.2%, retarget
// mid-flight continuity (no jump beyond a velocity-bounded frame step), t
// clamping past duration, and no NaN for a degenerate from≈to flight.

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const modPath = process.argv[2];
if (!modPath) {
  console.error('usage: node flight.check.mjs <path-to-compiled-flight.mjs>');
  process.exit(2);
}
const F = await import(pathToFileURL(resolve(modPath)).href);

let failures = 0;
function ok(cond, msg) {
  if (cond) {
    console.log(`  PASS  ${msg}`);
  } else {
    console.error(`  FAIL  ${msg}`);
    failures += 1;
  }
}
const finite3 = (v) => v.every(Number.isFinite);
const dist = (a, b) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const DT = 1 / 60; // 60fps step
const A = [0, 1.45, 2.3];
const ALook = [0, 1.3, -1.5];
const B = [0.736, 1.75, -1.666];
const BLook = [0.9, 1.7, -2.55];
const C = [-2.415, 1.25, -0.518];
const CLook = [-3.0, 1.2, -1.2];

console.log('flight.ts checks:');

// ── 1. flightEase shape: endpoints, overshoot bound, monotonic-until-peak ──
{
  ok(Math.abs(F.flightEase(0)) < 1e-9, 'flightEase(0) === 0');
  ok(Math.abs(F.flightEase(1) - 1) < 1e-9, 'flightEase(1) === 1 exactly (settles, no residual)');
  let maxE = -Infinity;
  let peakT = 0;
  let minE = Infinity;
  let anyNaN = false;
  for (let i = 0; i <= 1000; i++) {
    const t = i / 1000;
    const e = F.flightEase(t);
    if (!Number.isFinite(e)) anyNaN = true;
    if (e > maxE) { maxE = e; peakT = t; }
    if (e < minE) minE = e;
  }
  ok(!anyNaN, 'flightEase finite across [0,1]');
  const overshoot = maxE - 1;
  ok(overshoot > 0.005 && overshoot <= 0.022, `overshoot ${(overshoot * 100).toFixed(3)}% in (0.5%, 2.2%] (peak @ t=${peakT.toFixed(2)})`);
  ok(minE >= -1e-9, `no undershoot at start (min ${minE.toExponential(2)})`);
  // monotonic increasing up to the overshoot peak (no pre-arrival wobble)
  let mono = true;
  let prev = -Infinity;
  for (let i = 0; i <= 1000; i++) {
    const t = i / 1000;
    if (t > peakT) break;
    const e = F.flightEase(t);
    if (e < prev - 1e-12) mono = false;
    prev = e;
  }
  ok(mono, 'flightEase monotonic increasing up to overshoot peak (no wobble)');
}

// ── 2. Timeline monotonic arrival + t clamps past duration ─────────────────
{
  const f = F.makeFlight(A, ALook, 55, B, BLook, 55, F.flightDuration(A, B));
  let prevT = -1;
  let monoT = true;
  let steps = 0;
  const pos = [0, 0, 0];
  while (!F.flightArrived(f) && steps < 100000) {
    F.advance(f, DT);
    const t = F.flightProgress(f);
    if (t < prevT - 1e-12) monoT = false;
    prevT = t;
    steps += 1;
  }
  ok(monoT, 'timeline t monotonic non-decreasing to arrival');
  ok(F.flightArrived(f), 'flight reports arrival');
  ok(Math.abs(F.flightProgress(f) - 1) < 1e-9, 't reaches exactly 1');
  // keep advancing well past duration
  for (let i = 0; i < 500; i++) F.advance(f, DT);
  ok(F.flightProgress(f) === 1, 't clamps at 1 past duration');
  F.samplePos(f, pos);
  ok(dist(pos, B) < 1e-9, 'settled position === target after clamp');
  ok(finite3(pos), 'no NaN in clamped position');
}

// ── 3. Retarget mid-flight: continuity + velocity-bounded frame step ──────
{
  const f = F.makeFlight(A, ALook, 55, B, BLook, 55, F.flightDuration(A, B));
  // advance partway
  for (let i = 0; i < 30; i++) F.advance(f, DT);
  const posBefore = [0, 0, 0];
  const lookBefore = [0, 0, 0];
  F.samplePos(f, posBefore);
  F.sampleLook(f, lookBefore);

  // rebuild flight from the CURRENT pose toward a new target (what the rig does)
  const g = F.makeFlight(posBefore, lookBefore, 55, C, CLook, 55, F.flightDuration(posBefore, C));
  const posAfter = [0, 0, 0];
  F.samplePos(g, posAfter); // at t=0 of new flight
  const jumpAtRetarget = dist(posBefore, posAfter);
  ok(jumpAtRetarget < 1e-9, `no positional jump at retarget instant (${jumpAtRetarget.toExponential(2)})`);

  // one frame later the move must be bounded by a sane per-frame velocity.
  // Peak speed of a quintInOut over `dur` ~ 1.875 * span / dur; add overshoot
  // slack and a safety factor.
  F.advance(g, DT);
  const posNext = [0, 0, 0];
  F.samplePos(g, posNext);
  const span = dist(posBefore, C);
  const bound = (1.9 * span / F.flightDuration(posBefore, C)) * DT * 1.5 + 1e-6;
  const step = dist(posAfter, posNext);
  ok(step <= bound, `first post-retarget step ${step.toExponential(2)} ≤ bound ${bound.toExponential(2)}`);
  ok(finite3(posNext), 'no NaN after retarget');
}

// ── 4. ESC-spam style rapid retargets never NaN / never diverge ───────────
{
  const targets = [B, C, A, B, C, A, B];
  const looks = [BLook, CLook, ALook, BLook, CLook, ALook, BLook];
  let f = F.makeFlight(A, ALook, 55, B, BLook, 55, F.flightDuration(A, B));
  const cur = [0, 0, 0];
  const curLook = [0, 0, 0];
  let bad = false;
  for (let r = 0; r < targets.length; r++) {
    // a few frames then retarget
    for (let i = 0; i < 3; i++) F.advance(f, DT);
    F.samplePos(f, cur);
    F.sampleLook(f, curLook);
    if (!finite3(cur) || !finite3(curLook)) bad = true;
    f = F.makeFlight(cur, curLook, 55, targets[r], looks[r], 55, F.flightDuration(cur, targets[r]));
    F.samplePos(f, cur);
    if (!finite3(cur)) bad = true;
    // camera stays inside a generous room bound
    if (Math.hypot(cur[0], cur[1], cur[2]) > 20) bad = true;
  }
  ok(!bad, 'rapid retarget storm stays finite and bounded (no divergence)');
}

// ── 5. Degenerate from≈to produces no NaN ─────────────────────────────────
{
  const p = [1.3, 0.78, -1.0];
  const f = F.makeFlight(p, p, 55, p, p, 55, F.flightDuration(p, p));
  const pos = [0, 0, 0];
  const look = [0, 0, 0];
  let anyNaN = false;
  for (let i = 0; i <= 20; i++) {
    F.advance(f, DT);
    F.samplePos(f, pos);
    F.sampleLook(f, look);
    if (!finite3(pos) || !finite3(look) || !Number.isFinite(F.sampleFov(f))) anyNaN = true;
  }
  ok(!anyNaN, 'degenerate from≈to flight never NaNs');
}

// ── 6. Instant (reduced-motion) flight arrives immediately, snaps to target ─
{
  const f = F.makeFlight(A, ALook, 55, B, BLook, 60, 1.4, /* instant */ true);
  ok(F.flightProgress(f) === 1, 'instant flight progress === 1 at t=0');
  ok(F.flightArrived(f), 'instant flight arrived immediately');
  const pos = [0, 0, 0];
  F.samplePos(f, pos);
  ok(dist(pos, B) < 1e-9, 'instant flight snaps to target pose');
  ok(Math.abs(F.sampleFov(f) - 60) < 1e-9, 'instant flight snaps fov');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
