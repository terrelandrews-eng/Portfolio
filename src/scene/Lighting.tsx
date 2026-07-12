// M5 lighting rig for "Case File No. 220" — dusk noir detective office.
// A four-light rig (cool ambient + warm window key + amber lamp pool + fan
// downspot), plus one dim fill dedicated to the bookshelf. Every numeric
// decision is a named constant below with a one-line note on what it does to
// the image, so visual-feedback rounds can be surgical: find the constant
// named for the thing you want to change, nudge it, re-screenshot.
//
// Contract notes:
//  - Only the WINDOW KEY casts shadows (and only on 'high').
//  - Lamp flicker is driven in useFrame by mutating a ref's .intensity — no
//    per-frame React state, no setInterval.
//  - Tier changes flip props (castShadow, mapSize) and gate the flicker; the
//    lights themselves never unmount, so switching quality is cheap.
//
// EXTERNAL PREREQUISITES (orchestrator must do these — this file cannot):
//  - SceneRoot.tsx <Canvas shadows={false}> must become shadows enabled
//    (e.g. shadows or shadows="soft"), or castShadow is a no-op.
//  - Room shell meshes need receiveShadow (see report): floor, back-wall
//    segments, left wall. Props already carry cast/receive flags.

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../state/store';

// ---------------------------------------------------------------------------
// 1. COOL AMBIENT (hemisphere) — floor of the exposure. Sets the color the
//    darkest corners settle to, so nothing crushes to pure black.
// ---------------------------------------------------------------------------
const AMBIENT_SKY_COLOR = '#2b5561'; // deep blue-teal — the tint of shadowed corners / upper walls
const AMBIENT_GROUND_COLOR = '#3a2a1a'; // warm bounce coming back up into undersides of props
const AMBIENT_INTENSITY = 0.45; // low: enough to read form in shadow, not enough to flatten the key

// ---------------------------------------------------------------------------
// 2. WINDOW KEY (directional) — dusk sun through the back-wall opening. The
//    dominant modeling light and the ONLY shadow caster.
// ---------------------------------------------------------------------------
const KEY_COLOR = '#FFC27A'; // dusk gold — warm bias that reads as low Caribbean sun
const KEY_INTENSITY = 2.4; // dominant: how hard the sun models the room; raise for more contrast
const KEY_POSITION: [number, number, number] = [3.4, 3.8, -6.2]; // sun: right + high + behind the back wall
const KEY_TARGET: [number, number, number] = [0.2, 0.5, -0.4]; // aim the beam down onto the desk/floor center
const KEY_SHADOW_BIAS = -0.0004; // depth nudge to kill shadow acne on flat Lambert planes
const KEY_SHADOW_NORMAL_BIAS = 0.03; // along-normal offset — the primary acne fix on big flat walls/floor
const KEY_SHADOW_EXTENT = 5.5; // half-size of the orthographic shadow frustum — fits the whole room, no wasted texels
const KEY_SHADOW_NEAR = 1.0; // near clip along the light (starts before the room)
const KEY_SHADOW_FAR = 16.0; // far clip along the light (ends past the far wall)
const KEY_SHADOW_MAP_HIGH = 2048; // crisp shadow edges on 'high'
const KEY_SHADOW_MAP_LOW = 1024; // cheaper map if shadows are ever enabled below 'high'

// ---------------------------------------------------------------------------
// 3. LAMP POOL (point) — amber desk light where the readable clutter lives
//    (journal, laptop, phone, radio, mug). Gently flickers.
// ---------------------------------------------------------------------------
const LAMP_COLOR = '#FFB24D'; // warm amber tungsten
const LAMP_POSITION: [number, number, number] = [-0.25, 1.15, -1.3]; // at the lamp head, shade opening down onto the desk
const LAMP_INTENSITY = 3.5; // base brightness of the desk pool — 7.0 clipped the journal pages white at the close-up dolly
const LAMP_DISTANCE = 3.4; // falloff radius — bumped from 3.0 so the dimmer bulb still reads as a pool at seat distance
const LAMP_DECAY = 2.0; // physical inverse-square falloff
const LAMP_FLICKER_AMPLITUDE = 0.08; // ±8% intensity swing — lived-in bulb, not a horror strobe
const LAMP_FLICKER_F1 = 11.0; // fast jitter component (Hz-ish)
const LAMP_FLICKER_F2 = 7.3; // slow drift component
const LAMP_FLICKER_F3 = 23.0; // fine shimmer component

// ---------------------------------------------------------------------------
// 4. FAN SPOT (spotlight) — soft warm downlight through the ceiling-fan hub
//    onto the seating area. Cheap: castShadow FALSE.
// ---------------------------------------------------------------------------
const FAN_SPOT_COLOR = '#FFE0B0'; // warm-neutral, a touch cooler than the lamp so they don't merge
const FAN_SPOT_POSITION: [number, number, number] = [0, 2.9, -0.8]; // just above the spinning blades at the fan hub
const FAN_SPOT_TARGET: [number, number, number] = [0, 0, -0.4]; // straight down toward the seating/floor
const FAN_SPOT_INTENSITY = 5.0; // low: a soft grounding pool, not a second key
const FAN_SPOT_ANGLE = 0.6; // cone half-angle (rad) — pool roughly the fan's footprint
const FAN_SPOT_PENUMBRA = 0.6; // soft cone edge
const FAN_SPOT_DISTANCE = 5.0; // reaches the floor and fades
const FAN_SPOT_DECAY = 2.0; // physical falloff

// ---------------------------------------------------------------------------
// 5. SHELF FILL (point) — the rig's one allowed fill, now dedicated to the
//    bookshelf. Floats in front of the shelf opening (+X side) so the 28
//    instanced spines read their vertex colors at the shelf dolly. The old
//    room-center placement contributed ~0.2 effective at 3m (inverse-square)
//    — invisible on the books. Brightness reference: spines should sit a
//    notch BELOW the brass trophy's read.
// ---------------------------------------------------------------------------
const FILL_COLOR = '#E9C58A'; // faint warm — matches the room's dusk cast
const FILL_POSITION: [number, number, number] = [-2.0, 1.6, -1.2]; // ~0.9m in front of the spines, square to the +X opening
const FILL_INTENSITY = 1.8; // dim warm wash on the spines — raise toward 2.4 if they still read muddy
const FILL_DISTANCE = 2.2; // tight cutoff: reaches the shelf, dies before the desk/rug
const FILL_DECAY = 2.0; // physical falloff

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
  const spotRef = useRef<THREE.SpotLight>(null!);
  const spotTargetRef = useRef<THREE.Object3D>(null!);

  // Wire directional + spot lights to their aim targets (three needs the
  // target object to live in the scene graph, which the <group>s below do).
  useEffect(() => {
    if (keyRef.current && keyTargetRef.current) {
      keyRef.current.target = keyTargetRef.current;
      keyRef.current.target.updateMatrixWorld();
    }
    if (spotRef.current && spotTargetRef.current) {
      spotRef.current.target = spotTargetRef.current;
      spotRef.current.target.updateMatrixWorld();
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
      {/* 1. COOL AMBIENT — blue-teal sky / warm ground, keeps corners lit */}
      <hemisphereLight
        color={AMBIENT_SKY_COLOR}
        groundColor={AMBIENT_GROUND_COLOR}
        intensity={AMBIENT_INTENSITY}
      />

      {/* 2. WINDOW KEY — dusk sun through the opening; only shadow caster */}
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

      {/* 3. LAMP POOL — amber desk light, flickers via lampRef in useFrame */}
      <pointLight
        ref={lampRef}
        color={LAMP_COLOR}
        intensity={LAMP_INTENSITY}
        position={LAMP_POSITION}
        distance={LAMP_DISTANCE}
        decay={LAMP_DECAY}
      />

      {/* 4. FAN SPOT — soft warm downlight the blades chop; no shadow */}
      <spotLight
        ref={spotRef}
        color={FAN_SPOT_COLOR}
        intensity={FAN_SPOT_INTENSITY}
        position={FAN_SPOT_POSITION}
        angle={FAN_SPOT_ANGLE}
        penumbra={FAN_SPOT_PENUMBRA}
        distance={FAN_SPOT_DISTANCE}
        decay={FAN_SPOT_DECAY}
        castShadow={false}
      />
      <group ref={spotTargetRef} position={FAN_SPOT_TARGET} />

      {/* 5. SHELF FILL — dim warm wash on the bookshelf spines only */}
      <pointLight
        color={FILL_COLOR}
        intensity={FILL_INTENSITY}
        position={FILL_POSITION}
        distance={FILL_DISTANCE}
        decay={FILL_DECAY}
      />
    </group>
  );
}
