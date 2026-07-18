// Chair — simple wooden captain's / writing chair, scenery on the visitor
// side of the desk. Ladderback silhouette: a slab seat, two front legs, two
// rear posts that continue past the seat to frame the back, a top crest rail,
// and three vertical slats. Faces -Z at rotationY = 0 (looking toward the
// desk). Group origin is the floor contact point; seat height ~0.45.
//
// All wood uses the shared `woodLight` palette key (materials.ts). No inline
// colors.
//
// Mesh budget: every part shares `woodLight`, so all 9 static pieces (seat,
// 2 front legs, 2 rear posts, crest rail, 3 back slats) are merged into ONE
// BufferGeometry — the whole chair is a single draw call. 9 meshes -> 1.

import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { flatMat } from '../materials';

const SEAT_Y = 0.45;
const SEAT_W = 0.42;
const SEAT_D = 0.4;
const SEAT_T = 0.05;
const SEAT_UNDER = SEAT_Y - SEAT_T / 2; // 0.425

const LEG_HX = 0.18;
const FRONT_Z = -0.16; // toward the desk
const REAR_Z = 0.16; // backrest side
const BACK_TOP = 0.84; // top of rear posts / crest rail

interface PropProps {
  position?: [number, number, number];
  rotationY?: number;
}

export default function Chair({ position = [0, 0, 0], rotationY = 0 }: PropProps) {
  // Every chair part shares `woodLight`; merge all 9 into one geometry, each
  // part's local transform baked in. One draw call for the whole chair.
  const frame = useMemo(() => {
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

    // Seat slab
    bake(new THREE.BoxGeometry(SEAT_W, SEAT_T, SEAT_D), [0, SEAT_Y, 0]);
    // Two front legs
    [-LEG_HX, LEG_HX].forEach((lx) =>
      bake(new THREE.CylinderGeometry(0.03, 0.022, SEAT_UNDER, 4), [lx, SEAT_UNDER / 2, FRONT_Z], [0, Math.PI / 4, 0]),
    );
    // Two rear posts
    [-LEG_HX, LEG_HX].forEach((lx) =>
      bake(new THREE.CylinderGeometry(0.03, 0.03, BACK_TOP, 4), [lx, BACK_TOP / 2, REAR_Z], [0, Math.PI / 4, 0]),
    );
    // Crest rail
    bake(new THREE.BoxGeometry(SEAT_W, 0.06, 0.04), [0, BACK_TOP - 0.03, REAR_Z]);
    // Three back slats
    [-0.11, 0, 0.11].forEach((sx) => bake(new THREE.BoxGeometry(0.05, 0.34, 0.02), [sx, 0.66, REAR_Z]));

    return mergeGeometries(parts);
  }, []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Whole chair as one merged `woodLight` geometry, one draw call. */}
      <mesh geometry={frame} material={flatMat('woodLight')} castShadow receiveShadow />
    </group>
  );
}
