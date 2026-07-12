// Clutter — a set of small dressing props scattered around the room: rug,
// potted palm, wall pennant, loose desk papers, and a floor crate with a
// bottle. Unlike the other props in this folder, this is a SET component:
// its own group mounts at the room origin (0,0,0) and every item below is
// positioned internally using absolute world coordinates (per the M4 prop
// brief), not relative to a single object anchor. `position`/`rotationY`
// are still accepted for contract consistency (defaulting to identity, so
// the orchestrator can mount it plainly at the room origin).
//
// Materials, all from the shared palette (materials.ts), no inline colors:
//   rug        -> `fabric`
//   pot        -> `woodRed`
//   stem       -> `plantDark`
//   fronds     -> alternating `plant` / `plantDark`
//   pennant    -> `fabric` (flag), `metalDark` (rod)
//   papers     -> `paper`
//   crate      -> `woodLight`
//   bottle     -> `plantDark`

// Mesh budget: same-material static items are merged so each material draws
// once — the 3 `paper` desk sheets, the `plantDark` set (palm stem + its 2
// plantDark fronds + the floor bottle, baked to the room group), and the 3
// `plant` fronds. The pot (woodRed), crate (woodLight), rug (fabric), and
// pennant rod/flag stay their own meshes. The rug + flag are NOT merged: the
// flag is a bespoke non-indexed, UV-less BufferGeometry, so it can't merge
// with the rug's box geometry. 15 meshes -> 8.

import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { flatMat } from '../materials';

// Compose a TRS matrix from plain-array pos/rotation/scale (Euler XYZ, to
// match r3f's default) so nested group + mesh transforms can be baked into
// geometry and merged.
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

interface PropProps {
  position?: [number, number, number];
  rotationY?: number;
}

// --- (a) Rug — flat jute rug under the desk area -----------------------
const RUG_POS: [number, number, number] = [0.3, 0.005, -1.0];
const RUG_W = 2.4;
const RUG_D = 1.6;

// --- (b) Potted palm — near the bookshelf -------------------------------
const PLANT_BASE: [number, number, number] = [-2.6, 0, -2.2];
const POT_RIM_Y = 0.2;
const STEM_TOP_Y = 0.62;
const FROND_COUNT = 5;
const FROND_LEN = 0.5;
const FROND_W = 0.09;
const FROND_T = 0.015;
// Per-frond droop (rad below horizontal) and material, varied for a
// natural asymmetric look rather than a perfect fan.
const FROND_CONFIG: { pitch: number; mat: 'plant' | 'plantDark' }[] = [
  { pitch: 0.25, mat: 'plant' },
  { pitch: 0.55, mat: 'plantDark' },
  { pitch: 0.75, mat: 'plant' },
  { pitch: 0.6, mat: 'plantDark' },
  { pitch: 0.4, mat: 'plant' },
];

// --- (c) Pennant flag — right wall, facing -X ---------------------------
// x pinned to the right wall's inner face (3.15) minus a hair — at the
// spec'd 2.9 the flag floated 25cm into the room and read as an artifact.
const FLAG_ANCHOR: [number, number, number] = [3.13, 1.9, -2.15];
const ROD_LEN = 0.3;

// --- (d) Scattered desk papers -------------------------------------------
const PAPER_CONFIG: { pos: [number, number, number]; rotY: number }[] = [
  { pos: [0.0, 0.795, -1.05], rotY: 0.15 },
  { pos: [0.6, 0.795, -1.3], rotY: -0.22 },
  { pos: [0.05, 0.797, -1.0], rotY: 0.4 },
];
const PAPER_W = 0.22;
const PAPER_D = 0.28;
const PAPER_T = 0.003;

// --- (e) Wooden crate + bottle — front-left floor corner ------------------
const CRATE_POS: [number, number, number] = [-1.9, 0, -0.3];
const CRATE_SIZE = 0.4;
const BOTTLE_POS: [number, number, number] = [-1.78, CRATE_SIZE, -0.35];

export default function Clutter({ position = [0, 0, 0], rotationY = 0 }: PropProps) {
  // Pot profile (radius, height pairs), revolved around the local Y axis.
  const potPoints = useMemo(
    () =>
      [
        [0, 0],
        [0.11, 0],
        [0.1, 0.02],
        [0.12, 0.16],
        [0.15, POT_RIM_Y],
        [0.13, POT_RIM_Y],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
    []
  );

  // Bottle profile — narrow neck, rounded shoulder, small base.
  const bottlePoints = useMemo(
    () =>
      [
        [0, 0],
        [0.035, 0],
        [0.04, 0.01],
        [0.045, 0.08],
        [0.045, 0.1],
        [0.02, 0.13],
        [0.015, 0.13],
        [0.015, 0.18],
        [0.018, 0.185],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
    []
  );

  // Pennant triangle, built double-sided (two opposite-wound triangles)
  // so it reads from both inside the room and up close, without touching
  // the shared material's `side` setting. Local coords, offset from the
  // flag's mount anchor: vertical edge threads onto the rod at z=0, tip
  // droops out and away at z=-0.35.
  const flagGeometry = useMemo(() => {
    const v0 = new THREE.Vector3(0, 0.15, 0);
    const v1 = new THREE.Vector3(0, -0.05, 0);
    const v2 = new THREE.Vector3(0.0, 0.02, -0.35);
    const positions = new Float32Array([
      // front winding
      v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z,
      // back winding (reversed) so both faces render
      v0.x, v0.y, v0.z, v2.x, v2.y, v2.z, v1.x, v1.y, v1.z,
    ]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    return geom;
  }, []);

  // Merged `plantDark`: palm stem + its plantDark fronds + the floor bottle.
  // Stem and fronds carry the PLANT_BASE group offset (and the fronds' nested
  // azimuth/pitch group rotations) baked in; the bottle carries its absolute
  // BOTTLE_POS — all authored relative to the room group so they can share a
  // single mesh there.
  const plantDarkGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    // Stem
    parts.push(
      new THREE.CylinderGeometry(0.015, 0.02, STEM_TOP_Y - POT_RIM_Y, 6).applyMatrix4(
        composeM(PLANT_BASE).multiply(composeM([0, POT_RIM_Y + (STEM_TOP_Y - POT_RIM_Y) / 2, 0])),
      ),
    );
    // plantDark fronds
    FROND_CONFIG.forEach((frond, i) => {
      if (frond.mat !== 'plantDark') return;
      const azimuth = (i * (Math.PI * 2)) / FROND_COUNT;
      const m = composeM(PLANT_BASE)
        .multiply(composeM([0, STEM_TOP_Y, 0], [0, azimuth, 0]))
        .multiply(composeM([0, 0, 0], [0, 0, -frond.pitch]))
        .multiply(composeM([FROND_LEN / 2, 0, 0]));
      parts.push(new THREE.BoxGeometry(FROND_LEN, FROND_T, FROND_W).applyMatrix4(m));
    });
    // Bottle (absolute floor position)
    parts.push(new THREE.LatheGeometry(bottlePoints, 8).applyMatrix4(composeM(BOTTLE_POS)));
    return mergeGeometries(parts);
  }, [bottlePoints]);

  // Merged `plant`: the 3 plant-colored fronds (same nested transform chain).
  const plantGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    FROND_CONFIG.forEach((frond, i) => {
      if (frond.mat !== 'plant') return;
      const azimuth = (i * (Math.PI * 2)) / FROND_COUNT;
      const m = composeM(PLANT_BASE)
        .multiply(composeM([0, STEM_TOP_Y, 0], [0, azimuth, 0]))
        .multiply(composeM([0, 0, 0], [0, 0, -frond.pitch]))
        .multiply(composeM([FROND_LEN / 2, 0, 0]));
      parts.push(new THREE.BoxGeometry(FROND_LEN, FROND_T, FROND_W).applyMatrix4(m));
    });
    return mergeGeometries(parts);
  }, []);

  // Merged `paper`: the 3 scattered desk sheets.
  const papersGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    PAPER_CONFIG.forEach((p) =>
      parts.push(new THREE.BoxGeometry(PAPER_W, PAPER_T, PAPER_D).applyMatrix4(composeM(p.pos, [0, p.rotY, 0]))),
    );
    return mergeGeometries(parts);
  }, []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* (a) Rug */}
      <mesh position={RUG_POS} material={flatMat('fabric')} receiveShadow>
        <boxGeometry args={[RUG_W, 0.01, RUG_D]} />
      </mesh>

      {/* (b) Potted palm — pot stays its own woodRed mesh; the stem +
          plantDark fronds + floor bottle are one merged plantDark mesh, and
          the plant fronds one merged plant mesh (see memos above). */}
      <mesh position={PLANT_BASE} material={flatMat('woodRed')} castShadow receiveShadow>
        <latheGeometry args={[potPoints, 8]} />
      </mesh>
      <mesh geometry={plantDarkGeo} material={flatMat('plantDark')} castShadow />
      <mesh geometry={plantGeo} material={flatMat('plant')} castShadow />

      {/* (c) Pennant flag on the right wall, facing -X */}
      <group position={FLAG_ANCHOR}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={flatMat('metalDark')} castShadow>
          <cylinderGeometry args={[0.006, 0.006, ROD_LEN, 6]} />
        </mesh>
        <mesh geometry={flagGeometry} material={flatMat('fabric')} />
      </group>

      {/* (d) Scattered desk papers — merged paper, one draw call */}
      <mesh geometry={papersGeo} material={flatMat('paper')} />

      {/* (e) Wooden crate (the bottle is merged into plantDark above) */}
      <mesh
        position={[CRATE_POS[0], CRATE_SIZE / 2, CRATE_POS[2]]}
        material={flatMat('woodLight')}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[CRATE_SIZE, CRATE_SIZE, CRATE_SIZE]} />
      </mesh>
    </group>
  );
}
