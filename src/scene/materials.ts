// Shared scene palette + material factory. ORCHESTRATOR-OWNED CONTRACT:
// prop builders import from here and NEVER create materials inline or add
// colors themselves. If a prop genuinely needs a color that has no close
// match below, use the nearest one and flag it in your report — do not edit
// this file. This is what keeps 14 separately-built props reading as one
// room. M5 (lighting/grading) may retune these values in one place.

import * as THREE from 'three';

// BRIGHT-DAY GRADE (2026-07-12): scene direction changed from dusk noir
// to a bright Caribbean day. Interior woods lifted toward sun-warmed
// tones, paper back to full brightness, and the outside-the-window group
// regraded to daylight (turquoise sea, high blue sky, green palms).
export const PALETTE = {
  // room shell
  floor: '#8a6e4b', // sun-warmed wood floor planks
  wall: '#4e6d76', // driftwood teal plank walls, daylight
  wallDark: '#4a656e', // ceiling / recessed segments / shadowed wood
  trim: '#6a8893', // window/door frames, skirting — lighter than wall

  // furniture woods
  desk: '#5e4025', // desk + shelf carcass, tropical wood in daylight
  woodLight: '#96754e', // chair, crate, lighter worked wood
  woodRed: '#7a4a33', // journal cover, radio cabinet, warm red-brown

  // paper / fabric
  paper: '#EDE6D2', // documents, polaroid frames (full theme paper)
  paperShadow: '#c4baa2', // paper in shadow, map, cork cards
  cork: '#b08a58', // corkboard surface
  fabric: '#a04d3a', // rug, pennant — rust red in daylight
  plant: '#5d8452', // palm/plant greens
  plantDark: '#3f5c3a',

  // metals / hardware
  metalDark: '#2a3238', // phone body, lamp arm, fan hardware, bakelite
  metalWarm: '#b3904e', // brass knobs, clothespins, lamp shade inner

  // emissives / accents
  marker: '#E8B54A', // amber exhibit marker + dial glow (theme amber)
  screenGreen: '#6FCF7E', // laptop terminal glow
  screenDark: '#0E1B14', // laptop screen ground
  lampGlow: '#f0c060', // lamp bulb / warm emissive

  // outside the window — bright day
  sky: '#9FDCEC', // horizon sky, hazy bright blue
  skyHigh: '#4FA8D8', // upper sky, saturated day blue
  sea: '#1FA3B8', // turquoise Caribbean sea
  seaFoam: '#D8F4F4', // wave highlights / foam, near-white
  sand: '#EBDCA8', // bright beach strip
  silhouette: '#2f6b52', // palms and distant shapes — deep green, not black
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
