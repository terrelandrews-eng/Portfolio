// DustMotes — a single THREE.Points cloud of warm-lit dust drifting through
// the window light shaft and over the desk. One draw call, no per-frame
// allocations; base positions are seeded so reloads look identical.
//
// LOCAL-MATERIAL EXCEPTION: same rationale as LightShafts.tsx — materials.ts
// only produces opaque/simple-emissive MeshLambertMaterial via its cached
// factories, none of which support PointsMaterial's sizeAttenuation +
// transparent + additive blend combo this needs. Per the sanctioned
// exception noted in materials.ts, this file builds one local
// THREE.PointsMaterial (color still sourced from PALETTE).
//
// DRIFT APPROACH (chosen deliberately, see also the comment above
// useFrame below): the spec asks for genuine per-particle wandering that
// wraps individual motes back into the volume when they drift out — that
// behavior is only reachable with a stock (non-custom-shader) PointsMaterial
// by mutating the position BufferAttribute directly, since the material has
// no per-vertex "phase" input to drive a shader-side offset. The
// alternative (moving the whole Points object as a rigid body) is cheaper
// per-frame but drifts every particle identically, which reads as one
// swaying cloud rather than independent motes, and can't wrap individuals.
// At N <= 220 the CPU cost of recomputing a Float32Array and flagging
// needsUpdate is a few hundred trig ops and a ~2.6KB buffer upload per
// frame — negligible next to a scene already running a spinning fan and
// other useFrame work — so direct mutation is both the correct choice and
// still effectively free.

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '../materials';
import { useAppStore } from '../../state/store';

// --- Particle counts per quality tier -----------------------------------
const COUNT_HIGH = 160;
const COUNT_MOBILE = 120;
const COUNT_REDUCED = 120; // same count as mobile, but rendered static (no useFrame work)

// --- Volume bounds: shaft + desk region (room-context box) --------------
const BOX_MIN = new THREE.Vector3(-0.6, 0.4, -2.5);
const BOX_MAX = new THREE.Vector3(1.7, 2.2, -0.3);

// --- Window-to-desk diagonal, used to bias particle density -------------
// Approximate endpoints inside the box: near the window opening (upper,
// back) and over the desk (lower, front) — matches the light shaft's path.
const DIAG_START = new THREE.Vector3(1.0, 1.9, -2.3);
const DIAG_END = new THREE.Vector3(0.2, 0.5, -0.5);
const DIAG_BIAS_RATIO = 0.65; // fraction of particles seeded along the diagonal vs uniformly scattered
const DIAG_JITTER = 0.55; // meters of random spread around the diagonal sample point

// --- Appearance -----------------------------------------------------
const PARTICLE_COLOR = PALETTE.marker; // warm amber, sourced from palette (no hardcoded hex)
const PARTICLE_SIZE = 0.009; // meters, low end so motes read as dust, not fireflies
const PARTICLE_OPACITY = 0.22; // faint; the soft sprite reads dimmer than a solid quad, so slightly above the bare-quad 0.16

// --- Soft sprite (fixes hard-square points at close range) ---------------
const SPRITE_SIZE = 32; // px, canvas texture dimension — tiny, motes never fill much screen
const SPRITE_MID_STOP = 0.3; // gradient stop where the bright core starts falling off
const SPRITE_MID_ALPHA = 0.55; // alpha at that mid stop — controls how tight the core reads

// Radial-gradient sprite so each point rasterizes as a soft round glow
// instead of a filled quad (the stock PointsMaterial has no sprite texture,
// which reads as hard squares at exhibit-dolly distances). The sprite is
// pure WHITE with an alpha ramp only — the material's `color`
// (PALETTE.marker) does all tinting via map*color, so no hardcoded color
// enters the scene. Deterministic by construction: same canvas, same
// gradient, every load.
function buildMoteSprite(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d')!;
  const half = SPRITE_SIZE / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); // bright core
  grad.addColorStop(SPRITE_MID_STOP, `rgba(255,255,255,${SPRITE_MID_ALPHA})`);
  grad.addColorStop(1, 'rgba(255,255,255,0)'); // fully transparent rim
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- Drift tuning ---------------------------------------------------
const RISE_SPEED = 0.004; // m/s upward drift (warm air rising near the window) — a few mm/s per spec
const SWAY_AMPLITUDE_X = 0.03; // meters of horizontal sway
const SWAY_AMPLITUDE_Z = 0.02; // meters of depth sway
const SWAY_FREQ_X = 0.15; // Hz-ish, slow lazy sway
const SWAY_FREQ_Z = 0.11;
const SEED = 1337; // fixed seed so reloads look identical

// Deterministic PRNG (mulberry32) — same seed always produces the same
// sequence, so base particle positions are stable across reloads.
function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

interface ParticleData {
  positions: Float32Array; // live buffer, mutated per-frame (x,y,z per particle)
  basePositions: Float32Array; // immutable seed positions, drift is computed relative to these
  phases: Float32Array; // per-particle phase offset so sway/rise desync
}

// Build the seeded base positions once. A DIAG_BIAS_RATIO fraction cluster
// around the window-to-desk diagonal (jittered), the rest scatter uniformly
// through the box, so the cloud reads as "denser along the light path" but
// still fills the whole desk/shaft region.
function buildParticles(count: number): ParticleData {
  const rand = mulberry32(SEED);
  const positions = new Float32Array(count * 3);
  const basePositions = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    let z: number;

    if (rand() < DIAG_BIAS_RATIO) {
      const t = rand();
      x = THREE.MathUtils.lerp(DIAG_START.x, DIAG_END.x, t) + (rand() - 0.5) * DIAG_JITTER;
      y = THREE.MathUtils.lerp(DIAG_START.y, DIAG_END.y, t) + (rand() - 0.5) * DIAG_JITTER;
      z = THREE.MathUtils.lerp(DIAG_START.z, DIAG_END.z, t) + (rand() - 0.5) * DIAG_JITTER;
    } else {
      x = THREE.MathUtils.lerp(BOX_MIN.x, BOX_MAX.x, rand());
      y = THREE.MathUtils.lerp(BOX_MIN.y, BOX_MAX.y, rand());
      z = THREE.MathUtils.lerp(BOX_MIN.z, BOX_MAX.z, rand());
    }

    x = clamp(x, BOX_MIN.x, BOX_MAX.x);
    y = clamp(y, BOX_MIN.y, BOX_MAX.y);
    z = clamp(z, BOX_MIN.z, BOX_MAX.z);

    const idx = i * 3;
    basePositions[idx] = x;
    basePositions[idx + 1] = y;
    basePositions[idx + 2] = z;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
    phases[i] = rand() * Math.PI * 2;
  }

  return { positions, basePositions, phases };
}

export default function DustMotes() {
  const qualityTier = useAppStore((s) => s.qualityTier);

  const count = qualityTier === 'high' ? COUNT_HIGH : qualityTier === 'mobile' ? COUNT_MOBILE : COUNT_REDUCED;

  // Rebuilding only when the particle count (i.e. quality tier bucket)
  // changes — same seed, so the shared portion of the sequence stays
  // visually consistent across tiers.
  const { positions, basePositions, phases } = useMemo(() => buildParticles(count), [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  // Sprite built once per mount; deterministic (same gradient every load).
  const sprite = useMemo(() => buildMoteSprite(), []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: PARTICLE_COLOR,
        map: sprite, // soft radial-glow sprite — see buildMoteSprite
        size: PARTICLE_SIZE,
        sizeAttenuation: true,
        transparent: true,
        opacity: PARTICLE_OPACITY,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    [sprite],
  );

  useFrame(({ clock }) => {
    if (qualityTier === 'reduced') return; // frozen (and already the low static count) on the reduced perf tier

    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    const yRange = BOX_MAX.y - BOX_MIN.y;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const phase = phases[i];

      // Slow upward drift wrapped back to the bottom of the volume once a
      // particle exits the top — this is the per-particle "wrap back into
      // the volume when they exit" behavior from the spec.
      const risen = t * RISE_SPEED + phase * 0.01; // tiny phase-scaled offset so particles don't wrap in unison
      const yLocal = (((basePositions[idx + 1] - BOX_MIN.y + risen) % yRange) + yRange) % yRange;
      positions[idx + 1] = BOX_MIN.y + yLocal;

      // Gentle horizontal/depth sway layered on top, desynced per particle.
      positions[idx] = basePositions[idx] + Math.sin(t * SWAY_FREQ_X + phase) * SWAY_AMPLITUDE_X;
      positions[idx + 2] = basePositions[idx + 2] + Math.sin(t * SWAY_FREQ_Z + phase * 1.3) * SWAY_AMPLITUDE_Z;
    }

    attr.needsUpdate = true;
  });

  return <points geometry={geometry} material={material} />;
}
