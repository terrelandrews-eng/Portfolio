// Desk — worn wooden writing desk, the hero surface of the office (five
// exhibits sit on its top). Stylized low-poly noir: a chunky slab top with a
// slight overhang, four tapered square legs, a back modesty panel, and one
// visitor-facing drawer with a brass knob. Group origin is the floor contact
// point, so mounting at y=0 sits it on the floor; the top surface finishes at
// exactly y = 0.79.
//
// Materials come from the shared palette (materials.ts): carcass = `desk`,
// knob = `metalWarm`, drawer recess = `wallDark`. No inline colors.
//
// Mesh budget: the 8 static `desk`-material parts (slab top, 4 legs, front
// apron, back modesty panel, drawer face) are merged into ONE BufferGeometry
// so the whole carcass is a single draw call. The `wallDark` drawer recess
// and the `metalWarm` knob keep their own meshes (different materials). Net:
// 10 meshes -> 3 meshes.

import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { flatMat } from '../materials';

// --- Key dimensions (meters) ------------------------------------------------
const TOP_W = 1.9;
const TOP_D = 0.8;
const TOP_T = 0.06;
const SURFACE_Y = 0.79; // finished top surface height
const TOP_CY = SURFACE_Y - TOP_T / 2; // 0.76 slab center
const UNDER_TOP = TOP_CY - TOP_T / 2; // 0.73 underside of slab

// Legs inset from the top edges to give the slab its overhang.
const LEG_HX = TOP_W / 2 - 0.1; // 0.85
const LEG_HZ = TOP_D / 2 - 0.09; // 0.31
const LEG_H = UNDER_TOP; // floor -> underside of top

interface PropProps {
  position?: [number, number, number];
  rotationY?: number;
}

export default function Desk({ position = [0, 0, 0], rotationY = 0 }: PropProps) {
  // Merge every static `desk`-material part (slab, 4 legs, apron, back
  // panel, drawer face) into a single geometry — one draw call for the
  // whole carcass. Each part's local transform is baked into its geometry.
  const carcass = useMemo(() => {
    const legPositions: [number, number][] = [
      [-LEG_HX, -LEG_HZ],
      [LEG_HX, -LEG_HZ],
      [-LEG_HX, LEG_HZ],
      [LEG_HX, LEG_HZ],
    ];
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

    bake(new THREE.BoxGeometry(TOP_W, TOP_T, TOP_D), [0, TOP_CY, 0]);
    legPositions.forEach(([lx, lz]) =>
      bake(new THREE.CylinderGeometry(0.06, 0.042, LEG_H, 4), [lx, LEG_H / 2, lz], [0, Math.PI / 4, 0]),
    );
    bake(new THREE.BoxGeometry(1.66, 0.14, 0.05), [0, 0.66, 0.335]);
    bake(new THREE.BoxGeometry(1.66, 0.3, 0.035), [0, 0.58, -0.33]);
    bake(new THREE.BoxGeometry(0.42, 0.095, 0.02), [0, 0.66, 0.372]);

    return mergeGeometries(parts);
  }, []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Merged `desk` carcass: slab top, 4 legs, apron, back panel, drawer
          face — one geometry, one draw call. */}
      <mesh geometry={carcass} material={flatMat('desk')} castShadow receiveShadow />

      {/* Drawer recess — dark inset frame reading as shadow */}
      <mesh position={[0, 0.66, 0.362]} material={flatMat('wallDark')}>
        <boxGeometry args={[0.46, 0.115, 0.02]} />
      </mesh>

      {/* Brass knob */}
      <mesh position={[0, 0.66, 0.392]} rotation={[Math.PI / 2, 0, 0]} material={flatMat('metalWarm')}>
        <cylinderGeometry args={[0.02, 0.02, 0.05, 12]} />
      </mesh>
    </group>
  );
}
