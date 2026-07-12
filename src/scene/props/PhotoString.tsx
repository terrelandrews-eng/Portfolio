// PhotoString — Exhibit G, "CLASSIFIED": a length of twine pinned to the
// wall with a handful of undeveloped/blacked-out polaroids clothespinned
// beneath it. Stylized low-poly noir, flat-shaded, code-authored geometry
// only. All materials come from ../materials (flatMat) — no inline colors.
//
// Contract: origin = center of the string span. The string runs along
// local z (span ~1.2m, from -0.6 to +0.6) and sags along -y toward the
// center. Local x=0 is the wall/mount plane; more-negative x is "forward,
// into the room". At rotationY=0 the polaroids face -X, matching the
// right-wall mount at (2.9, 1.9, -0.8) where the room interior is toward
// -X. Default position/rotation are that anchor so the prop drops in
// correctly even before the orchestrator supplies one explicitly.
//
// Structure: one continuous TubeGeometry mesh for the twine (CatmullRom
// curve through two wall anchors and one sagging midpoint) + a small nail
// head at each anchor. Five polaroids hang below the string, each a thin
// white frame box (paper) with an inset dark photo box (wallDark) proud
// of its face — the photo sits high in the frame, leaving a wider paper
// margin at the bottom, the classic polaroid look. Each polaroid gets a
// little rotation jitter around x/z so the row doesn't read as a rigid
// grid. A two-jaw clothespin (metalWarm) bridges each photo up to the
// string.
//
// Instancing: nails, frames, photos, and pins are each their own
// InstancedMesh (matrices built via a shared dummy Object3D in useMemo,
// applied with setMatrixAt in useLayoutEffect) — one instanced group per
// repeated part, standard pattern. The twine itself is a single mesh
// since it's one continuous curve, not a repeated part. That's 5
// meshes/instanced groups total, within the ≤6 budget.

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { flatMat } from '../materials';

interface PhotoStringProps {
  position?: [number, number, number];
  rotationY?: number;
}

const HALF_SPAN = 0.6; // string spans z in [-0.6, 0.6], span = 1.2m
const SAG = 0.06; // string dips this far along -y at z=0
const STRING_RADIUS = 0.0025;
const STRING_TUBULAR_SEGMENTS = 24;
const STRING_RADIAL_SEGMENTS = 6;

const NAIL_SIZE = 0.014; // small cube standing in for a nail head

const FRAME_X = -0.012; // frame center, proud of the wall/string plane
const FRAME_DEPTH = 0.006;
const FRAME_W = 0.11;
const FRAME_H = 0.13;

const PHOTO_DEPTH = 0.003;
const PHOTO_PROUD_GAP = 0.0008; // gap between frame face and photo, avoids z-fighting
const PHOTO_W = 0.088;
const PHOTO_H = 0.085;
const PHOTO_TOP_MARGIN = 0.014; // frame top -> photo top (thin top border)
// Vertical offset from frame center to photo center: pushes the photo up
// so the leftover paper collects at the bottom (wider bottom border).
const PHOTO_Y_OFFSET = FRAME_H / 2 - PHOTO_TOP_MARGIN - PHOTO_H / 2;
const PHOTO_X_OFFSET = -(FRAME_DEPTH / 2 + PHOTO_PROUD_GAP + PHOTO_DEPTH / 2);

const PIN_JAW_W = 0.009; // along x
const PIN_JAW_H = 0.02; // along y
const PIN_JAW_D = 0.009; // along z
const PIN_Y_DROP = 0.006; // how far below the string line the jaws sit

interface PhotoSpec {
  z: number;
  rotX: number;
  rotZ: number;
}

// 5 polaroids, unevenly spaced with a little jitter in rotation so the
// row reads as hand-pinned rather than a rigid grid.
const PHOTOS: PhotoSpec[] = [
  { z: -0.44, rotX: 0.06, rotZ: -0.08 },
  { z: -0.22, rotX: -0.05, rotZ: 0.06 },
  { z: 0.02, rotX: 0.08, rotZ: 0.03 },
  { z: 0.24, rotX: -0.04, rotZ: -0.07 },
  { z: 0.46, rotX: 0.05, rotZ: 0.09 },
];

// Parabolic approximation of the CatmullRom sag curve's y at a given z —
// close enough for placing hardware under the string without re-sampling
// the actual curve.
function stringSagY(z: number): number {
  return -SAG * (1 - (z / HALF_SPAN) ** 2);
}

// Reusable dummy + vectors for building instance matrices.
const dummy = new THREE.Object3D();
const photoOffset = new THREE.Vector3();

export default function PhotoString({
  position = [2.9, 1.9, -0.8],
  rotationY = 0,
}: PhotoStringProps) {
  const nailsRef = useRef<THREE.InstancedMesh>(null);
  const framesRef = useRef<THREE.InstancedMesh>(null);
  const photosRef = useRef<THREE.InstancedMesh>(null);
  const pinsRef = useRef<THREE.InstancedMesh>(null);

  const stringCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -HALF_SPAN),
      new THREE.Vector3(0, -SAG, 0),
      new THREE.Vector3(0, 0, HALF_SPAN),
    ]);
  }, []);

  const nailMatrices = useMemo(() => {
    return [-HALF_SPAN, HALF_SPAN].map((z) => {
      dummy.position.set(0, 0, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(NAIL_SIZE, NAIL_SIZE, NAIL_SIZE);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, []);

  const frameMatrices = useMemo(() => {
    return PHOTOS.map((p) => {
      dummy.position.set(FRAME_X, stringSagY(p.z) - FRAME_H / 2, p.z);
      dummy.rotation.set(p.rotX, 0, p.rotZ);
      dummy.scale.set(FRAME_DEPTH, FRAME_H, FRAME_W);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, []);

  const photoMatrices = useMemo(() => {
    return PHOTOS.map((p) => {
      const frameCenter = new THREE.Vector3(FRAME_X, stringSagY(p.z) - FRAME_H / 2, p.z);
      const euler = new THREE.Euler(p.rotX, 0, p.rotZ);
      photoOffset.set(PHOTO_X_OFFSET, PHOTO_Y_OFFSET, 0).applyEuler(euler);
      const center = frameCenter.add(photoOffset);
      dummy.position.copy(center);
      dummy.rotation.set(p.rotX, 0, p.rotZ);
      dummy.scale.set(PHOTO_DEPTH, PHOTO_H, PHOTO_W);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, []);

  const pinMatrices = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    PHOTOS.forEach((p) => {
      const y = stringSagY(p.z) - PIN_Y_DROP;
      // back jaw: at the string/wall plane
      dummy.position.set(0, y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(PIN_JAW_W, PIN_JAW_H, PIN_JAW_D);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      // front jaw: out at the photo's depth, gripping the frame top edge
      dummy.position.set(FRAME_X - FRAME_DEPTH / 2, y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(PIN_JAW_W, PIN_JAW_H, PIN_JAW_D);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
    });
    return matrices;
  }, []);

  useLayoutEffect(() => {
    if (nailsRef.current) {
      nailMatrices.forEach((m, i) => nailsRef.current!.setMatrixAt(i, m));
      nailsRef.current.instanceMatrix.needsUpdate = true;
    }
    if (framesRef.current) {
      frameMatrices.forEach((m, i) => framesRef.current!.setMatrixAt(i, m));
      framesRef.current.instanceMatrix.needsUpdate = true;
    }
    if (photosRef.current) {
      photoMatrices.forEach((m, i) => photosRef.current!.setMatrixAt(i, m));
      photosRef.current.instanceMatrix.needsUpdate = true;
    }
    if (pinsRef.current) {
      pinMatrices.forEach((m, i) => pinsRef.current!.setMatrixAt(i, m));
      pinsRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [nailMatrices, frameMatrices, photoMatrices, pinMatrices]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Twine, sagging along -y between two wall anchors. */}
      <mesh material={flatMat('metalWarm')} castShadow>
        <tubeGeometry
          args={[
            stringCurve,
            STRING_TUBULAR_SEGMENTS,
            STRING_RADIUS,
            STRING_RADIAL_SEGMENTS,
            false,
          ]}
        />
      </mesh>

      {/* Nail heads pinning the string ends to the wall. */}
      <instancedMesh
        ref={nailsRef}
        args={[undefined, undefined, nailMatrices.length]}
        material={flatMat('metalDark')}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* White polaroid frames. */}
      <instancedMesh
        ref={framesRef}
        args={[undefined, undefined, frameMatrices.length]}
        material={flatMat('paper')}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Undeveloped/classified dark photo insets. */}
      <instancedMesh
        ref={photosRef}
        args={[undefined, undefined, photoMatrices.length]}
        material={flatMat('wallDark')}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Clothespin jaws bridging each photo up to the string. */}
      <instancedMesh
        ref={pinsRef}
        args={[undefined, undefined, pinMatrices.length]}
        material={flatMat('metalWarm')}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
}
