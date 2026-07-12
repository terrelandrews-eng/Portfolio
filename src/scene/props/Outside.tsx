// The world outside the beach-shack window — a layered dusk seascape seen
// through the 1.6 x 1.1 m opening centered at world (0.9, 1.7) on the back
// wall (z = -2.55). Stylized low-poly noir, flat-shaded, code-authored
// geometry only. All materials come from ../materials — no inline colors.
// Backdrop surfaces use backdropMat (unlit MeshBasicMaterial): no scene
// light reaches past the back wall, so lit Lambert materials would render
// black out there. Only the sun disc uses emissiveMat.
//
// COORDINATE CHOICE: this prop is authored in WORLD space and defaults to
// position [0,0,0]. Every constant below is a real-world meter coordinate,
// so the layers land at the depths the brief calls for (z -3.4 .. -7) and
// the composition reads correctly from BOTH the seat (0,1.45,2.3) and the
// window dolly (~0.72,1.75,-1.66). The orchestrator can mount <Outside />
// with no position and it sits where it belongs; a supplied position just
// offsets the whole backdrop.
//
// Coverage is built generously (x -2.75..4.75, y -0.1..3.5) so no seam of
// the backdrop is ever visible through the frame from either viewpoint.
//
// SKY GRADIENT: faked with two stacked overlapping planes at slightly
// different depths (skyHigh behind, a lighter/warmer `sky` band drawn over
// the lower third near the horizon) — NO canvas texture is used at all
// (flagged in report). This keeps the prop texture-free and cheap.
//
// Palette keys used: skyHigh, sky, lampGlow (sun), sea, seaFoam, sand,
// silhouette. All present in materials.ts.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { backdropMat, emissiveMat } from '../materials';
import { useAppStore } from '../../state/store';

interface OutsideProps {
  position?: [number, number, number];
}

// --- Horizon / layer depths (world meters) --------------------------------
const HORIZON_Y = 1.38; // sea/sky meet just above window-center height
const SKY_Z = -6.95;
const SKY_LOW_Z = -6.85;
const SUN_Z = -6.7;
const SEA_Z = -5.95;
const FOAM_Z = -5.9;
const SAND_Z = -4.3;
const HEADLAND_Z = -6.3;
const PALM_Z = -4.35;
const BOAT_Z = -5.85;

// View is centered (by parallax from the seat) a little right of the
// window's own x; palm anchored left, sailboat right-of-center — see report.
const VIEW_CX = 1.0;
const BACKDROP_W = 7.5; // covers x -2.75 .. 4.75

const dummy = new THREE.Object3D();

// --- Foam wave strips: thin seaFoam bars that drift laterally --------------
interface FoamSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  amp: number; // lateral drift amplitude (m)
  speed: number; // rad/s
  phase: number;
}

// Lower strips are longer/thicker (nearer), higher strips thinner (farther).
const FOAM: FoamSpec[] = [
  { x: 1.4, y: HORIZON_Y - 0.06, w: 3.4, h: 0.02, amp: 0.03, speed: 0.9, phase: 0.0 },
  { x: 0.6, y: HORIZON_Y - 0.16, w: 4.2, h: 0.025, amp: 0.04, speed: 0.75, phase: 1.3 },
  { x: 1.6, y: HORIZON_Y - 0.3, w: 4.8, h: 0.03, amp: 0.05, speed: 0.85, phase: 2.6 },
  { x: 0.9, y: HORIZON_Y - 0.5, w: 5.4, h: 0.035, amp: 0.05, speed: 0.7, phase: 0.7 },
  { x: 1.2, y: HORIZON_Y - 0.75, w: 5.8, h: 0.045, amp: 0.06, speed: 0.8, phase: 3.4 },
];

// --- Palm crown fronds: flattened drooping blades radiating from the top ---
const PALM_CROWN = new THREE.Vector3(1.0, 2.3, PALM_Z);
const FROND_COUNT = 6;

export default function Outside({ position = [0, 0, 0] }: OutsideProps) {
  const reduced = useAppStore((s) => s.qualityTier === 'reduced');

  const foamRef = useRef<THREE.InstancedMesh>(null);
  const frondRef = useRef<THREE.InstancedMesh>(null);

  // Palm trunk: a gently S-bent tube leaning up and to the right, so from
  // the seat it rises out of the beach into the window's left third.
  const trunkCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.42, 0.0, PALM_Z),
        new THREE.Vector3(0.52, 0.85, PALM_Z),
        new THREE.Vector3(0.72, 1.6, PALM_Z - 0.03),
        new THREE.Vector3(1.0, 2.3, PALM_Z - 0.05),
      ]),
    [],
  );

  // Static frond matrices (fanned + drooped around the crown).
  const frondMatrices = useMemo(() => {
    return Array.from({ length: FROND_COUNT }, (_, i) => {
      const yaw = (i / FROND_COUNT) * Math.PI * 2 + 0.4;
      const droop = 1.95 + (i % 2) * 0.15; // > 90deg so blades tip outward-down
      const len = 0.9 + (i % 3) * 0.12;
      dummy.position.copy(PALM_CROWN);
      dummy.rotation.set(droop, yaw, 0);
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, []);

  // Base foam matrices (also the resting state when quality is reduced).
  const foamBase = useMemo(() => {
    return FOAM.map((f) => {
      dummy.position.set(f.x, f.y, FOAM_Z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(f.w, f.h, 1);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, []);

  useLayoutEffect(() => {
    if (frondRef.current) {
      frondMatrices.forEach((m, i) => frondRef.current!.setMatrixAt(i, m));
      frondRef.current.instanceMatrix.needsUpdate = true;
    }
    if (foamRef.current) {
      foamBase.forEach((m, i) => foamRef.current!.setMatrixAt(i, m));
      foamRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [frondMatrices, foamBase]);

  // Slow lateral shimmer of the foam strips (period ~7-9s). Static when the
  // quality tier is 'reduced' — we simply leave the base matrices in place.
  useFrame(({ clock }) => {
    if (reduced || !foamRef.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < FOAM.length; i++) {
      const f = FOAM[i];
      dummy.position.set(f.x + Math.sin(t * f.speed + f.phase) * f.amp, f.y, FOAM_Z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(f.w, f.h, 1);
      dummy.updateMatrix();
      foamRef.current.setMatrixAt(i, dummy.matrix);
    }
    foamRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* (a) SKY — deep upper plane, then a lighter warm band over the lower
          third to fake a dusk vertical gradient (no texture). */}
      <mesh position={[VIEW_CX, 1.7, SKY_Z]} material={backdropMat('skyHigh')}>
        <planeGeometry args={[BACKDROP_W, 3.6]} />
      </mesh>
      <mesh position={[VIEW_CX, HORIZON_Y + 0.35, SKY_LOW_Z]} material={backdropMat('sky')}>
        <planeGeometry args={[BACKDROP_W, 1.25]} />
      </mesh>

      {/* Low dusk sun disc — subtle warm emissive, sitting right of center. */}
      <mesh position={[2.5, 1.95, SUN_Z]} material={emissiveMat('lampGlow', 0.5)}>
        <circleGeometry args={[0.26, 24]} />
      </mesh>

      {/* (b) SEA — plane from the horizon down toward the wall. */}
      <mesh position={[VIEW_CX, HORIZON_Y - 0.75, SEA_Z]} material={backdropMat('sea')}>
        <planeGeometry args={[BACKDROP_W, 1.6]} />
      </mesh>

      {/* Drifting foam wave strips (instanced, animated in useFrame). */}
      <instancedMesh ref={foamRef} args={[undefined, undefined, FOAM.length]} material={backdropMat('seaFoam')}>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>

      {/* (c) SAND — a beach sliver low in the foreground on the near side. */}
      <mesh position={[0.6, 0.14, SAND_Z]} material={backdropMat('sand')}>
        <planeGeometry args={[3.6, 0.5]} />
      </mesh>

      {/* (d) SILHOUETTES ------------------------------------------------- */}
      {/* Distant headland lump rising from the horizon (behind the sea). */}
      <mesh
        position={[-0.35, HORIZON_Y - 0.05, HEADLAND_Z]}
        scale={[1.25, 0.34, 0.5]}
        material={backdropMat('silhouette')}
      >
        <sphereGeometry args={[1, 10, 6]} />
      </mesh>

      {/* Hero palm — leaning trunk (S-bent tube). */}
      <mesh material={backdropMat('silhouette')}>
        <tubeGeometry args={[trunkCurve, 12, 0.05, 5, false]} />
      </mesh>

      {/* Palm fronds — flattened drooping blades (instanced planes). The
          plane geometry is shifted so its base sits at the crown pivot. */}
      <instancedMesh
        ref={frondRef}
        args={[undefined, undefined, FROND_COUNT]}
        material={backdropMat('silhouette')}
      >
        <planeGeometry args={[0.13, 0.85]} />
      </instancedMesh>

      {/* Tiny sailboat on the horizon, right of center: hull + mast + sail. */}
      <group position={[2.2, HORIZON_Y - 0.02, BOAT_Z]}>
        <mesh material={backdropMat('silhouette')}>
          <boxGeometry args={[0.22, 0.05, 0.03]} />
        </mesh>
        <mesh position={[0, 0.11, 0]} material={backdropMat('silhouette')}>
          <cylinderGeometry args={[0.008, 0.008, 0.2, 5]} />
        </mesh>
        <mesh position={[0.06, 0.11, 0]} material={backdropMat('silhouette')}>
          <shapeGeometry args={[sailShape]} />
        </mesh>
      </group>
    </group>
  );
}

// Triangular sail (right triangle, hypotenuse trailing), authored once.
const sailShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.09);
  s.lineTo(0, 0.11);
  s.lineTo(0.11, -0.09);
  s.closePath();
  return s;
})();
