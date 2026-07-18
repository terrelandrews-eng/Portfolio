// DeskLamp — stylized architect/banker's desk lamp. Group origin is the
// base contact point (sits on the desk surface), so mounting at
// (-0.15, 0.79, -1.35) seats the weighted base flush on the desk top.
// Faces no strong direction on its own; rotationY orients which way the
// arm/shade swings (default swings toward +Z, over the visitor side of the
// desk).
//
// Structure: weighted round base -> short riser post -> pivot knuckle ->
// single angled arm segment -> shade (nested outer/inner shells) opening
// down-and-toward-+Z, with a small emissive bulb disc tucked inside the
// opening. Geometry only — M5 wires the real light source.
//
// Materials: `metalDark` for the body (base/post/knuckle/arm/shade
// exterior), `metalWarm` for the shade interior, `emissiveMat('lampGlow')`
// for the bulb — all from the shared palette (materials.ts). No inline
// colors.
//
// Mesh budget: the 5 `metalDark` body parts (base, post, knuckle, arm,
// outer shade shell) are merged into ONE BufferGeometry — a single draw
// call for the lamp body. The `metalWarm` inner shade and the emissive bulb
// disc keep their own meshes (different materials). 7 meshes -> 3.

import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { flatMat, emissiveMat } from '../materials';

const BASE_RADIUS = 0.1;
const BASE_HEIGHT = 0.025;
const BASE_Y = BASE_HEIGHT / 2;

const POST_RADIUS = 0.015;
const POST_HEIGHT = 0.22;
const POST_Y = BASE_HEIGHT + POST_HEIGHT / 2;
const POST_TOP_Y = BASE_HEIGHT + POST_HEIGHT; // pivot height

const KNUCKLE_RADIUS = 0.025;

// Arm tilts forward (+Z) and up from the knuckle at this angle from
// vertical (rad). See report for the rotation-matrix derivation.
const ARM_ANGLE = 0.7;
const ARM_LEN = 0.22;
const ARM_COS = Math.cos(ARM_ANGLE);
const ARM_SIN = Math.sin(ARM_ANGLE);
const ARM_CENTER: [number, number, number] = [
  0,
  POST_TOP_Y + (ARM_LEN / 2) * ARM_COS,
  (ARM_LEN / 2) * ARM_SIN,
];
const ARM_TOP: [number, number, number] = [
  0,
  POST_TOP_Y + ARM_LEN * ARM_COS,
  ARM_LEN * ARM_SIN,
];

// Shade tilts further so its opening (originally -Y) points down AND
// forward (+Z). Negative X-rotation walks the opening toward +Z.
const SHADE_TILT = -0.5;
const SHADE_POS: [number, number, number] = [ARM_TOP[0], ARM_TOP[1] - 0.05, ARM_TOP[2] + 0.03];

interface PropProps {
  position?: [number, number, number];
  rotationY?: number;
}

export default function DeskLamp({ position = [0, 0, 0], rotationY = 0 }: PropProps) {
  // Merge the 5 `metalDark` body parts (base, post, knuckle, arm, outer
  // shade shell) into one geometry — a single draw call for the lamp body.
  // Each part's local transform is baked into its geometry.
  const body = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const bake = (
      geo: THREE.BufferGeometry,
      pos: [number, number, number],
      rot: [number, number, number] = [0, 0, 0],
    ) => {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(pos[0], pos[1], pos[2]),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
        new THREE.Vector3(1, 1, 1),
      );
      parts.push(geo.applyMatrix4(m));
    };
    bake(new THREE.CylinderGeometry(BASE_RADIUS, BASE_RADIUS * 1.05, BASE_HEIGHT, 12), [0, BASE_Y, 0]);
    bake(new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, POST_HEIGHT, 8), [0, POST_Y, 0]);
    bake(new THREE.SphereGeometry(KNUCKLE_RADIUS, 6, 5), [0, POST_TOP_Y, 0]);
    bake(new THREE.CylinderGeometry(0.012, 0.012, ARM_LEN, 6), ARM_CENTER, [ARM_ANGLE, 0, 0]);
    bake(new THREE.CylinderGeometry(0.02, 0.105, 0.15, 10, 1, true), SHADE_POS, [SHADE_TILT, 0, 0]);
    return mergeGeometries(parts);
  }, []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Merged `metalDark` body: base, post, knuckle, arm, outer shade
          shell — one geometry, one draw call. */}
      <mesh geometry={body} material={flatMat('metalDark')} castShadow receiveShadow />

      {/* Shade — inner surface, nested slightly smaller so it reads through
          the open mouth and from below (the painted-interior look) */}
      <mesh position={SHADE_POS} rotation={[SHADE_TILT, 0, 0]} material={flatMat('metalWarm')}>
        <cylinderGeometry args={[0.017, 0.095, 0.14, 10, 1, true]} />
      </mesh>

      {/* Tiny emissive bulb disc, tucked inside the shade opening */}
      <mesh
        position={[SHADE_POS[0], SHADE_POS[1] - 0.06, SHADE_POS[2] + 0.045]}
        rotation={[SHADE_TILT, 0, 0]}
        material={emissiveMat('lampGlow', 1.2)}
      >
        <cylinderGeometry args={[0.022, 0.022, 0.006, 8]} />
      </mesh>
    </group>
  );
}
