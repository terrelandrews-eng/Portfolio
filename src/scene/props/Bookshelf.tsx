// Exhibit F — "CREDENTIALS": tall wooden bookshelf. Stylized low-poly noir,
// flat-shaded, code-authored geometry only.
//
// Contract: origin = base center, flush against the wall (local x=0 is the
// wall-contact plane). At rotationY=0 the shelf's open face looks toward
// +X (into the room), so local +X is "depth into the room" and local Z is
// "width along the wall". Height runs 0 (floor) -> 1.8 (top of carcass) on
// local Y. Meant to be mounted at (-3.0, 0, -1.2) against the left wall by
// the orchestrator; this file never mounts itself.
//
// Materials come from the shared palette (materials.ts): carcass (sides,
// top, back) = `desk`, shelves = `woodLight`, certificate paper = `paper`,
// trophy = `metalWarm`. No inline colors and no new hex values anywhere in
// this file.
//
// DEVIATION (flagged per house rules): the ~26-30 books are one
// THREE.InstancedMesh colored via per-instance `instanceColor`. Three.js
// only applies instanceColor when the material has `vertexColors: true`,
// and `flatMat()` returns a *cached, shared* MeshLambertMaterial keyed by
// palette name — flipping vertexColors on a cached instance (e.g. the
// `desk` material, which this very file's carcass also uses, plus other
// props) would silently recolor every other mesh using that cached
// material across the scene. So the books get one dedicated
// MeshLambertMaterial built locally in this file (not cached, not
// exported, never touches materials.ts), with colors read from the
// existing `PALETTE` table via `new THREE.Color(PALETTE[key])` — no new
// colors invented, just a material instance that can't leak. Every other
// mesh in this prop uses `flatMat()` as normal.

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { flatMat, PALETTE, type PaletteKey } from '../materials';

interface PropProps {
  position?: [number, number, number];
  rotationY?: number;
}

// --- Carcass dimensions (meters) --------------------------------------------
const W = 0.9; // width along local Z (along the wall)
const H = 1.8; // height
const D = 0.35; // depth along local X (into the room)

const SIDE_T = 0.025;
const TOP_T = 0.03;
const BACK_T = 0.02;
const SHELF_T = 0.02;

const INNER_W = W - 2 * SIDE_T; // 0.85 — clear width between the sides
const SHELF_D = D - BACK_T; // 0.33 — shelf run from the back panel to the front edge
const SHELF_CX = BACK_T + SHELF_D / 2; // 0.185 — shelf x-center

// Four shelves, evenly spaced; y is each shelf's center height.
const SHELF_YS = [0.36, 0.72, 1.08, 1.44];
// Book-row floor = top surface of each shelf.
const ROW_Y = SHELF_YS.map((y) => y + SHELF_T / 2);

// Books sit flush-ish against the back, leaving a front lip.
const BOOK_DEPTH_X = 0.17;
const BOOK_X = BACK_T + 0.03 + BOOK_DEPTH_X / 2; // 0.135

const BOOK_COLORS: PaletteKey[] = ['woodRed', 'fabric', 'plantDark', 'paperShadow', 'wallDark'];

interface BookSpec {
  x: number;
  y: number;
  z: number;
  sx: number; // scale along local X (book depth, front-to-back)
  sy: number; // scale along local Y (book height, or thickness if lying flat)
  sz: number; // scale along local Z (book thickness/spine width, or length if lying flat)
  rotX: number; // lean, radians
  rotZ: number; // casual tilt for flat-lying books, radians
  colorKey: PaletteKey;
}

// Deterministic pseudo-variety per book index — no Math.random, so the
// layout is reproducible across renders/reloads.
function bookTemplate(i: number) {
  const thickness = 0.022 + ((i * 7) % 5) * 0.006; // 0.022 .. 0.046
  const height = 0.19 + ((i * 13) % 6) * 0.014; // 0.19 .. 0.26
  return { thickness, height };
}

// Rows of standing books: one per shelf, resting on that shelf's top
// surface. startZ is hand-tuned so each row leaves open shelf space for
// the certificate (row 1) and trophy (row 3), and so the two flat-lying
// books (added separately below) have a cluster to rest on (rows 0 and 2).
const ROWS: { y: number; startZ: number; count: number }[] = [
  { y: ROW_Y[0], startZ: -0.36, count: 7 },
  { y: ROW_Y[1], startZ: -0.4, count: 6 },
  { y: ROW_Y[2], startZ: -0.4, count: 7 },
  { y: ROW_Y[3], startZ: -0.4, count: 6 },
];

// Global book indices that get a slight lean against their neighbor.
const LEAN_INDICES = new Set([2, 15, 22]);
const GAP = 0.008;

function buildBookSpecs(): BookSpec[] {
  const specs: BookSpec[] = [];
  let globalIdx = 0;

  ROWS.forEach((row) => {
    let cursorZ = row.startZ;
    for (let i = 0; i < row.count; i++) {
      const { thickness, height } = bookTemplate(globalIdx);
      const centerZ = cursorZ + thickness / 2;
      const lean = LEAN_INDICES.has(globalIdx) ? (globalIdx % 2 === 0 ? 0.16 : -0.14) : 0;
      specs.push({
        x: BOOK_X,
        y: row.y + height / 2,
        z: centerZ,
        sx: BOOK_DEPTH_X,
        sy: height,
        sz: thickness,
        rotX: lean,
        rotZ: 0,
        colorKey: BOOK_COLORS[globalIdx % BOOK_COLORS.length],
      });
      cursorZ += thickness + GAP;
      globalIdx++;
    }
  });

  // Two books lying flat on top of a row of standing books (max standing
  // height in either donor row is ~0.26, so 0.27 clears it).
  specs.push({
    x: BOOK_X,
    y: ROW_Y[0] + 0.27 + 0.012,
    z: -0.22,
    sx: 0.17,
    sy: 0.024,
    sz: 0.22,
    rotX: 0,
    rotZ: 0.06,
    colorKey: 'wallDark',
  });
  specs.push({
    x: BOOK_X,
    y: ROW_Y[2] + 0.27 + 0.012,
    z: -0.26,
    sx: 0.16,
    sy: 0.02,
    sz: 0.2,
    rotX: 0,
    rotZ: -0.05,
    colorKey: 'paperShadow',
  });

  return specs;
}

// Small low-poly trophy cup profile (base -> stem -> flared cup), revolved
// with LatheGeometry.
const TROPHY_POINTS = [
  new THREE.Vector2(0.028, 0),
  new THREE.Vector2(0.028, 0.008),
  new THREE.Vector2(0.01, 0.02),
  new THREE.Vector2(0.01, 0.055),
  new THREE.Vector2(0.024, 0.065),
  new THREE.Vector2(0.03, 0.09),
  new THREE.Vector2(0.026, 0.11),
];

const dummy = new THREE.Object3D();

export default function Bookshelf({ position = [0, 0, 0], rotationY = 0 }: PropProps) {
  const booksRef = useRef<THREE.InstancedMesh>(null);

  const bookSpecs = useMemo(() => buildBookSpecs(), []);

  // Dedicated, non-cached material for the instanced books — see the
  // DEVIATION note at the top of this file for why flatMat() can't be
  // reused here.
  // No `vertexColors: true` here: instanceColor is auto-detected by three's
  // shader (USE_INSTANCING_COLOR), while vertexColors makes it expect a
  // per-vertex `color` attribute this geometry doesn't have — the unbound
  // attribute reads black and zeroes the diffuse (books rendered black).
  const bookMaterial = useMemo(() => new THREE.MeshLambertMaterial(), []);

  const bookMatrices = useMemo(
    () =>
      bookSpecs.map((b) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(b.rotX, 0, b.rotZ);
        dummy.scale.set(b.sx, b.sy, b.sz);
        dummy.updateMatrix();
        return dummy.matrix.clone();
      }),
    [bookSpecs]
  );

  // Merge the 4 `desk` carcass panels (2 sides, top, back) into one geometry
  // and the 4 `woodLight` shelves into another — two draw calls instead of
  // eight. Positions baked in (no rotations here).
  const carcassGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    parts.push(new THREE.BoxGeometry(D, H, SIDE_T).translate(D / 2, H / 2, W / 2 - SIDE_T / 2));
    parts.push(new THREE.BoxGeometry(D, H, SIDE_T).translate(D / 2, H / 2, -(W / 2 - SIDE_T / 2)));
    parts.push(new THREE.BoxGeometry(D, TOP_T, W).translate(D / 2, H - TOP_T / 2, 0));
    parts.push(new THREE.BoxGeometry(BACK_T, H, W).translate(BACK_T / 2, H / 2, 0));
    return mergeGeometries(parts);
  }, []);

  const shelvesGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    SHELF_YS.forEach((y) => parts.push(new THREE.BoxGeometry(SHELF_D, SHELF_T, INNER_W).translate(SHELF_CX, y, 0)));
    return mergeGeometries(parts);
  }, []);

  useLayoutEffect(() => {
    const mesh = booksRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    bookMatrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      color.set(PALETTE[bookSpecs[i].colorKey]);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bookMatrices, bookSpecs]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Carcass: two sides, top, back panel — merged `desk`, one draw call */}
      <mesh geometry={carcassGeo} material={flatMat('desk')} castShadow receiveShadow />

      {/* Four shelves — merged `woodLight`, one draw call */}
      <mesh geometry={shelvesGeo} material={flatMat('woodLight')} castShadow receiveShadow />

      {/* Small framed certificate, propped against the back panel on
          shelf 2 (row 1). The dark back panel behind it reads as the
          frame surround, so no separate frame mesh is needed. */}
      <mesh
        position={[BACK_T + 0.0075, ROW_Y[1] + 0.07, 0.15]}
        rotation={[-0.08, 0, 0]}
        material={flatMat('paper')}
        castShadow
      >
        <boxGeometry args={[0.015, 0.14, 0.12]} />
      </mesh>

      {/* Small trophy, standing on shelf 4 (top row) */}
      <mesh position={[0.15, ROW_Y[3], 0.15]} material={flatMat('metalWarm')} castShadow>
        <latheGeometry args={[TROPHY_POINTS, 8]} />
      </mesh>

      {/* Books — one instanced mesh, ~26-30 unit boxes scaled/colored per instance */}
      <instancedMesh
        ref={booksRef}
        args={[undefined, undefined, bookSpecs.length]}
        material={bookMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
}
