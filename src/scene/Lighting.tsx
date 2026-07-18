// M5 lighting rig for "Case File No. 220" — BRIGHT CARIBBEAN DAY.
// (Redesigned from the original dusk-noir rig on user direction: midday sun
// on a beach shack office, shutters open, light everywhere. Firewatch at
// noon / Monument Valley: saturated flat-shaded surfaces in full light, one
// confident warm sun direction, soft readable blue-gray shadows.)
//
// Three lights: bright hemisphere ambient + warm-white sun key + a
// barely-there lamp accent (kept for its flicker infrastructure — M6 may
// use it). The noir rig's fan spot and shelf fill are deleted: the daylight
// ambient reads the shelf spines and seating area on its own, and fewer
// live lights is a cheaper Lambert shader. Restore them from git history if
// a close-up ever needs help.
//
// Every numeric decision is a named constant below with a one-line note on
// what it does to the image, so feedback rounds stay surgical.
//
// Contract notes:
//  - Only the SUN KEY casts shadows (and only on 'high').
//  - Lamp flicker is driven in useFrame by mutating a ref's .intensity — no
//    per-frame React state, no setInterval. Frozen on 'reduced'.
//  - Tier changes flip props (castShadow, mapSize) and gate the flicker; the
//    lights themselves never unmount, so switching quality is cheap.
//
// Bloom-gate budget (the round-2 lesson, re-run for daylight): sunlit paper
// #EDE6D2 (linear luminance ~0.79) receives key 1.15 x 0.92 x cos(37 deg
// off-normal) ~0.84 plus ambient 1.0 x 0.68 ~0.68 => irradiance ~1.52 =>
// radiance ~1.2 linear => ~0.84 post-ACES, just under the 0.85 bloom gate.
// If you raise AMBIENT_INTENSITY or KEY_INTENSITY, re-run this sum.

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../state/store';

// ---------------------------------------------------------------------------
// 1. DAY AMBIENT (hemisphere) — the single biggest "bright day" lever. High
//    enough that nothing reads murky; shadows settle to soft blue-gray.
// ---------------------------------------------------------------------------
const AMBIENT_SKY_COLOR = '#BFDDE8'; // bright day-sky blue — the tint of every shadowed/upward surface
const AMBIENT_GROUND_COLOR = '#D9C08F'; // warm sand bounce lifting undersides of props
const AMBIENT_INTENSITY = 1.35; // bright: raises the whole room's floor exposure; raise first if anything still reads dark

// ---------------------------------------------------------------------------
// 2. SUN KEY (directional) — late-morning sun through the window, warm-white
//    and steep. The only shadow caster; crisp confident daylight shadows.
// ---------------------------------------------------------------------------
const KEY_COLOR = '#FFF4E0'; // warm-white noon sun (dusk gold retired with the noir grade)
const KEY_INTENSITY = 0.85; // sized against the ambient so sunlit paper stays under the 0.85 bloom gate (budget in header)
const KEY_POSITION: [number, number, number] = [3.0, 7.0, -4.5]; // sun high behind-right (elevation ~53 deg) — late morning
const KEY_TARGET: [number, number, number] = [0.2, 0.5, -0.4]; // aim through the window onto the desk/floor center
const KEY_SHADOW_BIAS = -0.0004; // depth nudge to kill shadow acne on flat Lambert planes
const KEY_SHADOW_NORMAL_BIAS = 0.02; // along-normal acne fix, scaled to the ~2mm texels; raise toward 0.03 if acne, lower if desk feet peter-pan
const KEY_SHADOW_EXTENT = 4.2; // ortho half-extent refit to the NEW sun axis: shadow-relevant set spans u -4.17..+4.05, w -3.09..+3.19 in light space; smaller clips the far floor corners / back wall
const KEY_SHADOW_NEAR = 1.0; // near clip along the light (starts before the room)
const KEY_SHADOW_FAR = 16.0; // far clip along the light (ends past the far wall)
const KEY_SHADOW_MAP_HIGH = 4096; // ~2mm texels — keeps the round-3 fix for grazing-angle staircase edges; one 4096 depth target (~64MB, single caster pass) is fine on desktop 'high' and never allocated on lower tiers
const KEY_SHADOW_MAP_LOW = 1024; // cheaper map if shadows are ever enabled below 'high'

// ---------------------------------------------------------------------------
// 3. LAMP ACCENT (point) — a desk lamp glowing at midday reads wrong, so it
//    is demoted to a barely-there warm kiss over the journal. The flicker
//    machinery stays live (M6 may use it); set intensity 0 to kill entirely.
// ---------------------------------------------------------------------------
const LAMP_COLOR = '#FFB24D'; // warm amber tungsten
const LAMP_POSITION: [number, number, number] = [-0.25, 1.15, -1.3]; // at the lamp head, shade opening down onto the desk
const LAMP_INTENSITY = 0.6; // barely-there: a faint warm accent on the journal, invisible past the desk (noir value was 3.5)
const LAMP_DISTANCE = 1.6; // tightened from 3.4 — the accent should die at the desk edge in daylight
const LAMP_DECAY = 2.0; // physical inverse-square falloff
const LAMP_FLICKER_AMPLITUDE = 0.08; // ±8% intensity swing — imperceptible at accent level, preserved for M6
const LAMP_FLICKER_F1 = 11.0; // fast jitter component (Hz-ish)
const LAMP_FLICKER_F2 = 7.3; // slow drift component
const LAMP_FLICKER_F3 = 23.0; // fine shimmer component

export default function Lighting() {
  // Reading the tier here re-renders Lighting on quality changes, but the
  // lights keep their identity (same JSX tree), so nothing remounts.
  const qualityTier = useAppStore((s) => s.qualityTier);
  const keyCastsShadow = qualityTier === 'high';
  const shadowMapSize = qualityTier === 'high' ? KEY_SHADOW_MAP_HIGH : KEY_SHADOW_MAP_LOW;
  const flickerFrozen = qualityTier === 'reduced';

  const lampRef = useRef<THREE.PointLight>(null!);
  const keyRef = useRef<THREE.DirectionalLight>(null!);
  const keyTargetRef = useRef<THREE.Object3D>(null!);

  // Wire the sun to its aim target (three needs the target object to live in
  // the scene graph, which the <group> below does).
  useEffect(() => {
    if (keyRef.current && keyTargetRef.current) {
      keyRef.current.target = keyTargetRef.current;
      keyRef.current.target.updateMatrixWorld();
    }
  }, []);

  // Organic lamp flicker: three layered sines summed to ±1, scaled to ±8%.
  // On 'reduced' we pin the lamp to its base intensity (frozen, no motion).
  useFrame(({ clock }) => {
    const lamp = lampRef.current;
    if (!lamp) return;
    if (flickerFrozen) {
      lamp.intensity = LAMP_INTENSITY;
      return;
    }
    const t = clock.elapsedTime;
    const flick =
      Math.sin(t * LAMP_FLICKER_F1) * 0.5 +
      Math.sin(t * LAMP_FLICKER_F2 + 1.3) * 0.3 +
      Math.sin(t * LAMP_FLICKER_F3 + 0.7) * 0.2; // weights sum to 1 → range [-1, 1]
    lamp.intensity = LAMP_INTENSITY * (1 + LAMP_FLICKER_AMPLITUDE * flick);
  });

  return (
    <group name="rig-case-file-220">
      {/* 1. DAY AMBIENT — bright sky blue / sand bounce, nothing reads murky */}
      <hemisphereLight
        color={AMBIENT_SKY_COLOR}
        groundColor={AMBIENT_GROUND_COLOR}
        intensity={AMBIENT_INTENSITY}
      />

      {/* 2. SUN KEY — late-morning sun through the window; only shadow caster */}
      <directionalLight
        ref={keyRef}
        color={KEY_COLOR}
        intensity={KEY_INTENSITY}
        position={KEY_POSITION}
        castShadow={keyCastsShadow}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={KEY_SHADOW_NEAR}
        shadow-camera-far={KEY_SHADOW_FAR}
        shadow-camera-left={-KEY_SHADOW_EXTENT}
        shadow-camera-right={KEY_SHADOW_EXTENT}
        shadow-camera-top={KEY_SHADOW_EXTENT}
        shadow-camera-bottom={-KEY_SHADOW_EXTENT}
        shadow-bias={KEY_SHADOW_BIAS}
        shadow-normalBias={KEY_SHADOW_NORMAL_BIAS}
      />
      <group ref={keyTargetRef} position={KEY_TARGET} />

      {/* 3. LAMP ACCENT — faint warm kiss on the journal, flicker via ref */}
      <pointLight
        ref={lampRef}
        color={LAMP_COLOR}
        intensity={LAMP_INTENSITY}
        position={LAMP_POSITION}
        distance={LAMP_DISTANCE}
        decay={LAMP_DECAY}
      />
    </group>
  );
}
