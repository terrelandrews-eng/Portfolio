// CeilingFan — small stylized low-poly ceiling fan. Group origin is the
// CEILING mount point (the fan hangs downward from y=0 in local space), so
// mounting at (0, 3.0, -0.8) seats the downrod flush against the ceiling.
// Faces no particular direction (rotationally symmetric hub), rotationY
// only matters for blade phase at rest.
//
// Structure: short downrod + motor hub (static) with 5 blades (spinning
// group) radiating out with a slight pitch. The blade group spins slowly
// around Y via useFrame and freezes when qualityTier === 'reduced' (perf
// tier), matching the store's quality-scaling contract.
//
// Materials: `metalDark` for rod + hub, `woodLight` for blades — both from
// the shared palette (materials.ts). No inline colors.
//
// Mesh budget: the static rod + hub (both `metalDark`) are merged into one
// geometry, and the 5 `woodLight` blades are merged into one geometry that
// lives INSIDE the spinning group (they all spin together as one group, so
// merging them is safe and keeps the fan animating). 7 meshes -> 2.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { flatMat } from '../materials';
import { useAppStore } from '../../state/store';

// Compose a TRS matrix from plain-array pos/rotation/scale (Euler XYZ, to
// match r3f's default) so a mesh's JSX transform can be baked into geometry.
function composeM(
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  scl: [number, number, number] = [1, 1, 1],
) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
    new THREE.Vector3(scl[0], scl[1], scl[2]),
  );
}

const ROD_LEN = 0.16;
const ROD_Y = -ROD_LEN / 2; // rod center, hangs from ceiling (y=0) downward

const HUB_RADIUS = 0.09;
const HUB_HEIGHT = 0.08;
const HUB_Y = -ROD_LEN - HUB_HEIGHT / 2; // hub sits just below the rod

const BLADE_COUNT = 5;
const BLADE_LEN = 0.5;
const BLADE_W = 0.12;
const BLADE_T = 0.02;
const BLADE_PITCH = 0.16; // slight tilt so blades read as angled, not flat
const BLADE_RADIUS_OFFSET = HUB_RADIUS + BLADE_LEN / 2 - 0.03; // overlap into hub slightly

const SPIN_SPEED = 0.9; // rad/s

interface PropProps {
  position?: [number, number, number];
  rotationY?: number;
}

export default function CeilingFan({ position = [0, 0, 0], rotationY = 0 }: PropProps) {
  const bladeGroupRef = useRef<THREE.Group>(null);
  const qualityTier = useAppStore((s) => s.qualityTier);

  useFrame((_, delta) => {
    if (qualityTier === 'reduced') return; // frozen on the reduced perf tier
    if (bladeGroupRef.current) {
      bladeGroupRef.current.rotation.y += delta * SPIN_SPEED;
    }
  });

  // Static rod + hub (both metalDark) merged into one geometry.
  const mountGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [
      new THREE.CylinderGeometry(0.02, 0.02, ROD_LEN, 6).translate(0, ROD_Y, 0),
      new THREE.CylinderGeometry(HUB_RADIUS, HUB_RADIUS * 0.9, HUB_HEIGHT, 8).translate(0, HUB_Y, 0),
    ];
    return mergeGeometries(parts);
  }, []);

  // The 5 blades merged into one geometry, authored in the spinning group's
  // local space (each blade's angle + radial offset + pitch baked in). The
  // group's own position offset and animated Y-spin stay on the group.
  const bladesGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < BLADE_COUNT; i++) {
      const angle = (i * (Math.PI * 2)) / BLADE_COUNT;
      const m = composeM([0, 0, 0], [0, angle, 0]).multiply(
        composeM([BLADE_RADIUS_OFFSET, 0, 0], [0, 0, BLADE_PITCH]),
      );
      parts.push(new THREE.BoxGeometry(BLADE_LEN, BLADE_T, BLADE_W).applyMatrix4(m));
    }
    return mergeGeometries(parts);
  }, []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Downrod + motor hub, merged metalDark — one static draw call */}
      <mesh geometry={mountGeo} material={flatMat('metalDark')} castShadow />

      {/* Spinning blade group — all 5 blades merged into one geometry that
          spins as a unit */}
      <group ref={bladeGroupRef} position={[0, HUB_Y, 0]}>
        <mesh geometry={bladesGeo} material={flatMat('woodLight')} castShadow />
      </group>
    </group>
  );
}
