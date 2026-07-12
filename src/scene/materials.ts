// Shared scene palette + material factory. ORCHESTRATOR-OWNED CONTRACT:
// prop builders import from here and NEVER create materials inline or add
// colors themselves. If a prop genuinely needs a color that has no close
// match below, use the nearest one and flag it in your report — do not edit
// this file. This is what keeps 14 separately-built props reading as one
// room. M5 (lighting/grading) may retune these values in one place.

import * as THREE from 'three';

export const PALETTE = {
  // room shell
  floor: '#5a4632', // wood-brown floor planks
  wall: '#22333b', // desaturated teal-gray plank walls
  wallDark: '#152026', // ceiling / recessed segments / shadowed wood
  trim: '#2e3f47', // window/door frames, skirting — lighter than wall

  // furniture woods
  desk: '#3e2a1c', // desk + shelf carcass, dark tropical wood
  woodLight: '#6b5138', // chair, crate, lighter worked wood
  woodRed: '#4a2f22', // journal cover, radio cabinet, warm red-brown

  // paper / fabric
  paper: '#d8d0ba', // documents, polaroid frames (scene-dimmed EDE6D2)
  paperShadow: '#a89f88', // paper in shadow, map, cork cards
  cork: '#8a6a45', // corkboard surface
  fabric: '#7a3b2e', // rug, pennant — muted rust red
  plant: '#3f5a38', // palm/plant greens
  plantDark: '#2b3f28',

  // metals / hardware
  metalDark: '#1c2226', // phone body, lamp arm, fan hardware, bakelite
  metalWarm: '#8a6f3c', // brass knobs, clothespins, lamp shade inner

  // emissives / accents
  marker: '#E8B54A', // amber exhibit marker + dial glow (theme amber)
  screenGreen: '#6FCF7E', // laptop terminal glow
  screenDark: '#0E1B14', // laptop screen ground
  lampGlow: '#f0c060', // lamp bulb / warm emissive

  // outside the window
  sky: '#2c5f6f', // dusk sky
  skyHigh: '#1a3d4a', // upper sky, deeper
  sea: '#1f4a56', // sea plane
  seaFoam: '#4f8896', // wave highlights / horizon shimmer
  sand: '#b09a6f', // beach strip
  silhouette: '#0d1a1e', // palms, sailboat, distant shapes
} as const;

export type PaletteKey = keyof typeof PALETTE;

// Cached flat-shaded Lambert materials — one instance per palette key so
// three.js can batch by material state. Props share these; do not clone
// unless you must mutate per-instance (then flag it in your report).
const cache = new Map<string, THREE.MeshLambertMaterial>();

export function flatMat(key: PaletteKey): THREE.MeshLambertMaterial {
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: PALETTE[key] });
    cache.set(key, m);
  }
  return m;
}

// Self-lit backdrop material for the world OUTSIDE the room (sky, sea,
// sand, silhouettes). No room light reaches past the back wall, so lit
// materials render black out there — backdrops must be unlit. Fog still
// applies, which is desired depth cueing.
const backdropCache = new Map<string, THREE.MeshBasicMaterial>();

export function backdropMat(key: PaletteKey): THREE.MeshBasicMaterial {
  let m = backdropCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: PALETTE[key] });
    backdropCache.set(key, m);
  }
  return m;
}

// Emissive variant for glowing surfaces (screen, dial, bulb). Cached per
// key+intensity bucket. Keep intensity in [0.2, 1.5].
const emissiveCache = new Map<string, THREE.MeshLambertMaterial>();

export function emissiveMat(key: PaletteKey, intensity = 0.8): THREE.MeshLambertMaterial {
  const bucket = `${key}:${intensity.toFixed(1)}`;
  let m = emissiveCache.get(bucket);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color: PALETTE[key],
      emissive: PALETTE[key],
      emissiveIntensity: intensity,
    });
    emissiveCache.set(bucket, m);
  }
  return m;
}
