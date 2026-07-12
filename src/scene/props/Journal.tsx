// Journal — Exhibit B, the resume / service record. An OPEN leather journal
// lying flat on the desk, both pages splayed, a ribbon bookmark trailing off
// the front edge onto the desk. The camera dollies in and looks down, so the
// page curve and the dark gutter channel at the spine are the hero details.
//
// Origin = base contact point: the underside of the leather cover sits at
// y=0, so mounting the prop at desk height (y=0.79) rests it on the surface.
// Local axes: +X = across the width (spine/gutter at x=0, pages splay ±X),
// +Z = depth (front edge, toward camera, at +Z), +Y = up.
//
// Materials, all from the shared palette (materials.ts), no inline colors:
//   cover      -> `woodRed`  (leather, slightly larger than the pages)
//   spine      -> `woodRed`  (raised ridge poking up through the gutter gap)
//   pages      -> `paper`    (two curved page blocks, extruded cross-section)
//   ink lines  -> `wallDark` (flattened dark boxes = abstract handwriting)
//   ribbon     -> `fabric`   (bookmark draping over the front edge)
//
// Mesh budget: same-material static pieces are merged so each material is a
// single draw call — woodRed (cover + spine), paper (both page blocks), the
// 3 wallDark ink lines, and the 2 fabric ribbon segments. 9 meshes -> 4.

import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { flatMat } from '../materials';

interface PropProps {
  position?: [number, number, number];
  rotationY?: number;
}

// --- Leather cover --------------------------------------------------------
const COVER_W = 0.4; // full width, both pages + a small leather margin
const COVER_D = 0.28;
const COVER_T = 0.018; // thin slab thickness

// --- Spine ridge ----------------------------------------------------------
const SPINE_W = 0.02;
const SPINE_H = 0.016; // pokes ~0.01 above the cover, into the gutter gap

// --- Pages ----------------------------------------------------------------
const GUTTER_GAP = 0.008; // half-gap at center; leaves a channel for the spine
const PAGE_W = 0.18; // each page half-width (both pages ~= 0.36 total)
const PAGE_D = 0.26;
// Cross-section heights above the cover top: the page dips into the gutter,
// bows up to a peak past mid-page, then settles at the outer edge. This arc
// is the whole point — it is what reads as "an open book."
const GUTTER_H = 0.006;
const PEAK_H = 0.024;
const EDGE_H = 0.007;

// --- Ink lines (abstract handwriting on the right page) -------------------
const INK_LINES: { z: number; w: number }[] = [
  { z: -0.06, w: 0.12 },
  { z: 0.0, w: 0.13 },
  { z: 0.06, w: 0.1 },
];
const INK_X = 0.1; // near the page peak, mid-to-outer on the right page

// Bake a mesh's local transform into a fresh geometry and collect it, so a
// set of same-material parts can be merged into one draw call.
function bakeInto(
  parts: THREE.BufferGeometry[],
  geo: THREE.BufferGeometry,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
    new THREE.Vector3(1, 1, 1),
  );
  parts.push(geo.applyMatrix4(m));
}

export default function Journal({ position = [0, 0, 0], rotationY = 0 }: PropProps) {
  // One page block, built once and shared by both pages. The 2D cross-section
  // lives in the XY plane (X = across the page, Y = up); ExtrudeGeometry then
  // sweeps it along Z to give the page its depth. Bottom edge is flat (sits on
  // the cover); the top edge is the arc — a straight climb up the outer edge,
  // then a spline back across the crest to the low gutter edge.
  const pageGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); // inner-bottom (gutter side)
    shape.lineTo(PAGE_W, 0); // outer-bottom
    shape.lineTo(PAGE_W, EDGE_H); // up the outer edge
    shape.splineThru([
      new THREE.Vector2(PAGE_W * 0.55, PEAK_H), // crest, past mid-page
      new THREE.Vector2(0, GUTTER_H), // low inner edge at the gutter
    ]);
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: PAGE_D,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 8,
    });
    geom.translate(0, 0, -PAGE_D / 2); // center the depth on the local origin
    geom.computeVertexNormals();
    return geom;
  }, []);

  // woodRed — cover slab + spine ridge.
  const coverGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    bakeInto(parts, new THREE.BoxGeometry(COVER_W, COVER_T, COVER_D), [0, COVER_T / 2, 0]);
    bakeInto(parts, new THREE.BoxGeometry(SPINE_W, SPINE_H, COVER_D * 0.96), [0, COVER_T + SPINE_H / 2 - 0.006, 0]);
    return mergeGeometries(parts);
  }, []);

  // paper — both page blocks (left is the same block spun 180deg about Y).
  const pagesGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    bakeInto(parts, pageGeometry.clone(), [GUTTER_GAP, COVER_T, 0]);
    bakeInto(parts, pageGeometry.clone(), [-GUTTER_GAP, COVER_T, 0], [0, Math.PI, 0]);
    return mergeGeometries(parts);
  }, [pageGeometry]);

  // wallDark — the 3 ink lines near the right-page crest.
  const inkGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    INK_LINES.forEach((line) =>
      bakeInto(parts, new THREE.BoxGeometry(line.w, 0.0015, 0.004), [INK_X, COVER_T + PEAK_H - 0.001, line.z]),
    );
    return mergeGeometries(parts);
  }, []);

  // fabric — the 2 ribbon segments (flat length + draping tail).
  const ribbonGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    bakeInto(parts, new THREE.BoxGeometry(0.02, 0.002, 0.21), [0.016, COVER_T + 0.011, 0.02]);
    bakeInto(parts, new THREE.BoxGeometry(0.02, 0.002, 0.12), [0.016, 0.009, 0.19], [0.3, 0, 0]);
    return mergeGeometries(parts);
  }, []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Leather cover + spine ridge, merged woodRed — one draw call */}
      <mesh geometry={coverGeo} material={flatMat('woodRed')} castShadow receiveShadow />

      {/* Both pages, merged paper — one draw call */}
      <mesh geometry={pagesGeo} material={flatMat('paper')} castShadow receiveShadow />

      {/* Ink lines, merged wallDark — one draw call */}
      <mesh geometry={inkGeo} material={flatMat('wallDark')} />

      {/* Ribbon bookmark (both segments), merged fabric — one draw call */}
      <mesh geometry={ribbonGeo} material={flatMat('fabric')} castShadow />
    </group>
  );
}
