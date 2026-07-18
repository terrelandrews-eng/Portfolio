// LightShafts — two soft, angled volumetric-looking quads standing in for
// dusk sunlight pouring through the back-wall window and landing on/behind
// the desk. Seen mostly from the side/front (camera sits at +z looking
// toward -z), so each shaft is a single tapered trapezoid oriented along
// the actual window-to-desk light direction rather than a flat billboard.
//
// LOCAL-MATERIAL EXCEPTION: materials.ts's factories (flatMat/emissiveMat/
// backdropMat) all produce opaque or simple-emissive MeshLambertMaterial —
// none support the transparent + additive-blended + fog-disabled combo a
// volumetric light shaft needs, and caching one here would pollute the
// shared cache with a one-off blend mode other props never want. Per the
// sanctioned exception in materials.ts's header comment, this file builds
// its own local MeshBasicMaterial instances (still sourcing color from
// PALETTE, never a hardcoded hex).
//
// Mesh budget: 2 meshes (one quad per window half, split at the mullion),
// 2 triangles each = 4 triangles total. Well under the 3-mesh / 50-tri cap.

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '../materials';
import { useAppStore } from '../../state/store';

// --- Window opening (back wall, z = -2.6) -----------------------------
const WINDOW_CENTER_X = 0.9; // window opening center, matches room context
const WINDOW_CENTER_Y = 1.7;
const WINDOW_Z = -2.6; // back wall plane
const WINDOW_WIDTH = 1.6;
const WINDOW_HEIGHT = 1.1;
const MULLION_GAP = 0.12; // width of the central mullion the two shafts avoid
const HALF_WIDTH = (WINDOW_WIDTH - MULLION_GAP) / 2; // width of one window half

// The two shaft origins: left half and right half of the window, each
// offset from center by a quarter of the window width so they sit centered
// in their own half.
const SHAFT_ORIGIN_X = [
  WINDOW_CENTER_X - WINDOW_WIDTH / 4,
  WINDOW_CENTER_X + WINDOW_WIDTH / 4,
] as const;

// --- Light direction: window opening -> desk --------------------------
// Dusk sun enters the window and lands roughly on/behind the desk at
// (0.3, 0, -1.2). This vector is shared by both shafts (parallel rays).
const DESK_TARGET = new THREE.Vector3(0.3, 0, -1.2);
const WINDOW_ORIGIN = new THREE.Vector3(WINDOW_CENTER_X, WINDOW_CENTER_Y, WINDOW_Z);
const LIGHT_DIR = DESK_TARGET.clone().sub(WINDOW_ORIGIN).normalize();

// --- Shaft shape --------------------------------------------------------
const SHAFT_LENGTH = 2.1; // meters along the light direction (spec range 1.5-2.5)
const START_WIDTH = HALF_WIDTH; // width at the window opening (narrow end)
const END_WIDTH = HALF_WIDTH * 1.35; // width at the far end — slight spread/taper
const Z_EPSILON = 0.04; // nudges the quad off the wall plane to avoid z-fighting

// --- Appearance -----------------------------------------------------
const SHAFT_COLOR = PALETTE.lampGlow; // warm dusk tone, sourced from palette
const BASE_OPACITY = 0.06; // within spec's 0.04-0.08 range
const BREATH_AMPLITUDE = 0.2; // +/-20% opacity breathing
const BREATH_PERIOD = 7; // seconds for one full breathing cycle

// World up, used to derive a horizontal "width" axis perpendicular to the
// light direction (so the quad's width tracks the window's x-extent).
const WORLD_UP = new THREE.Vector3(0, 1, 0);

// Build the local basis (width axis, length axis, normal axis) once — both
// shafts share the same light direction, so the same basis/quaternion
// applies to each, only the origin (window half) differs.
function buildShaftBasisQuaternion(): THREE.Quaternion {
  const widthAxis = new THREE.Vector3().crossVectors(LIGHT_DIR, WORLD_UP).normalize();
  const normalAxis = new THREE.Vector3().crossVectors(widthAxis, LIGHT_DIR).normalize();
  const basis = new THREE.Matrix4().makeBasis(widthAxis, LIGHT_DIR, normalAxis);
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

// A tapered trapezoid quad in local space: local Y runs 0 (window, narrow)
// -> SHAFT_LENGTH (far end, wider), local X is the width axis, local Z is
// the (unused) thickness/normal axis. Two triangles, four vertices.
function buildShaftGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    -START_WIDTH / 2, 0, 0, // near-left (window)
    START_WIDTH / 2, 0, 0, // near-right (window)
    END_WIDTH / 2, SHAFT_LENGTH, 0, // far-right (desk end)
    -END_WIDTH / 2, SHAFT_LENGTH, 0, // far-left (desk end)
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  return geo;
}

export default function LightShafts() {
  const qualityTier = useAppStore((s) => s.qualityTier);

  const geometry = useMemo(() => buildShaftGeometry(), []);
  const quaternion = useMemo(() => buildShaftBasisQuaternion(), []);

  // Two independent MeshBasicMaterial instances (not shared/cached) since
  // each shaft breathes on its own phase offset. Stable across re-renders
  // (empty deps), so useFrame below can close over this array directly
  // without a ref indirection.
  const materials = useMemo(
    () =>
      SHAFT_ORIGIN_X.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: SHAFT_COLOR,
            transparent: true,
            opacity: BASE_OPACITY,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false,
          }),
      ),
    [],
  );

  useFrame(({ clock }) => {
    if (qualityTier === 'reduced') return; // frozen on the reduced perf tier
    const t = clock.elapsedTime;
    materials.forEach((mat, i) => {
      // Slight phase offset per shaft so they don't breathe in lockstep.
      const phase = (i * Math.PI) / 2;
      const wave = Math.sin((t / BREATH_PERIOD) * Math.PI * 2 + phase);
      mat.opacity = BASE_OPACITY * (1 + wave * BREATH_AMPLITUDE);
    });
  });

  return (
    <group>
      {SHAFT_ORIGIN_X.map((x, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={materials[i]}
          position={[x, WINDOW_CENTER_Y, WINDOW_Z + Z_EPSILON]}
          quaternion={quaternion}
        />
      ))}
    </group>
  );
}
