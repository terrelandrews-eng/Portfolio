// The world outside the beach-shack window — a layered BRIGHT CARIBBEAN
// MIDDAY seascape seen through the 1.6 x 1.1 m opening centered at world
// (0.9, 1.7) on the back wall (z = -2.55). Stylized low-poly, flat-shaded,
// code-authored geometry only. All materials come from ../materials — no
// inline colors. The palette was regraded to day values by the
// orchestrator: skyHigh = saturated day blue, sky = pale horizon haze,
// sea = turquoise, seaFoam = near-white, silhouette = deep foliage green.
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
// different depths — the saturated skyHigh plane fills the whole backdrop
// and the pale `sky` haze band overlays the lower stretch at a slightly
// nearer depth, so the sky reads deep blue up top fading to haze at the
// horizon (the correct orientation for midday). NO canvas texture is used
// at all (flagged in report).
//
// Palette keys used: skyHigh, sky, lampGlow (sun), sea, seaFoam (foam
// lines, sail canvas, clouds), sand, silhouette (foliage-green shapes).
// All present in materials.ts.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { backdropMat, emissiveMat } from '../materials';
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

interface OutsideProps {
  position?: [number, number, number];
}

// --- Horizon / layer depths (world meters) --------------------------------
const HORIZON_Y = 1.38; // sea/sky meet just above window-center height
const SKY_Z = -6.95;
const SKY_LOW_Z = -6.85;
const SUN_Z = -6.7;
const CLOUD_Z = -6.6;
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

// Lower strips are longer/thicker (nearer), higher strips thinner
// (farther). Day pass: near-white seaFoam on turquoise is high contrast,
// so the strips are thinner and shorter than the dusk composition —
// broken glints that read as sun sparkle, not full-width stripes.
const FOAM: FoamSpec[] = [
  { x: 1.6, y: HORIZON_Y - 0.06, w: 2.0, h: 0.013, amp: 0.03, speed: 0.9, phase: 0.0 },
  { x: 0.4, y: HORIZON_Y - 0.16, w: 2.6, h: 0.016, amp: 0.04, speed: 0.75, phase: 1.3 },
  { x: 2.0, y: HORIZON_Y - 0.3, w: 2.8, h: 0.019, amp: 0.05, speed: 0.85, phase: 2.6 },
  { x: 0.7, y: HORIZON_Y - 0.5, w: 3.2, h: 0.023, amp: 0.05, speed: 0.7, phase: 0.7 },
  { x: 1.3, y: HORIZON_Y - 0.75, w: 3.6, h: 0.03, amp: 0.06, speed: 0.8, phase: 3.4 },
];

// --- Clouds: two flat white puffs, each a cluster of flattened sphere
// instances (one instancedMesh total, static). Placed so from the seat one
// sits upper-left in the window and one in the top-right corner, clear of
// the high sun.
interface CloudPuff {
  x: number;
  y: number;
  sx: number;
  sy: number;
}

const CLOUDS: CloudPuff[] = [
  // cloud A (upper-left of the view)
  { x: 0.45, y: 2.58, sx: 0.34, sy: 0.1 },
  { x: 0.72, y: 2.64, sx: 0.26, sy: 0.09 },
  { x: 0.28, y: 2.64, sx: 0.2, sy: 0.07 },
  // cloud B (top-right corner)
  { x: 2.95, y: 2.84, sx: 0.4, sy: 0.11 },
  { x: 3.25, y: 2.9, sx: 0.24, sy: 0.08 },
];

// --- Palm crown fronds: flattened drooping blades radiating from the top ---
const PALM_CROWN = new THREE.Vector3(1.0, 2.3, PALM_Z);
const FROND_COUNT = 6;

export default function Outside({ position = [0, 0, 0] }: OutsideProps) {
  const reduced = useAppStore((s) => s.qualityTier === 'reduced');

  const foamRef = useRef<THREE.InstancedMesh>(null);
  const frondRef = useRef<THREE.InstancedMesh>(null);
  const cloudRef = useRef<THREE.InstancedMesh>(null);

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

  // All static `silhouette`-keyed shapes merged into one geometry: the
  // distant headland lump, the palm trunk tube, and the sailboat hull +
  // mast (baked through the boat sub-group offset). One draw call. Day
  // pass: the SAIL is split OUT of this merge — in daylight the shapes are
  // deep foliage green, and a green sail reads wrong, so the sail is its
  // own mesh with seaFoam (near-white canvas). The palm fronds and foam
  // strips stay instanced (foam still animates on the full tier).
  const silhouetteGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    parts.push(
      new THREE.SphereGeometry(1, 10, 6).applyMatrix4(
        composeM([-0.35, HORIZON_Y - 0.05, HEADLAND_Z], [0, 0, 0], [1.25, 0.34, 0.5]),
      ),
    );
    parts.push(new THREE.TubeGeometry(trunkCurve, 12, 0.05, 5, false));
    const boat = composeM([2.2, HORIZON_Y - 0.02, BOAT_Z]);
    parts.push(new THREE.BoxGeometry(0.22, 0.05, 0.03).applyMatrix4(boat.clone()));
    parts.push(
      new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5).applyMatrix4(boat.clone().multiply(composeM([0, 0.11, 0]))),
    );
    return mergeGeometries(parts);
  }, [trunkCurve]);

  // Static cloud puff matrices (flattened spheres, two clusters).
  const cloudMatrices = useMemo(() => {
    return CLOUDS.map((c) => {
      dummy.position.set(c.x, c.y, CLOUD_Z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(c.sx, c.sy, 0.05);
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
    if (cloudRef.current) {
      cloudMatrices.forEach((m, i) => cloudRef.current!.setMatrixAt(i, m));
      cloudRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [frondMatrices, foamBase, cloudMatrices]);

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
      {/* (a) SKY — saturated day-blue plane behind, pale haze band over the
          lower stretch to fake the midday vertical gradient (no texture). */}
      <mesh position={[VIEW_CX, 1.7, SKY_Z]} material={backdropMat('skyHigh')}>
        <planeGeometry args={[BACKDROP_W, 3.6]} />
      </mesh>
      <mesh position={[VIEW_CX, HORIZON_Y + 0.35, SKY_LOW_Z]} material={backdropMat('sky')}>
        <planeGeometry args={[BACKDROP_W, 1.25]} />
      </mesh>

      {/* High midday sun — smaller and hotter than the old dusk disc. From
          the seat it lands in the window's upper third, right of center
          (~(1.02, 2.18) on the wall plane). Intensity 1.5 so it blooms. */}
      <mesh position={[1.9, 2.8, SUN_Z]} material={emissiveMat('lampGlow', 1.5)}>
        <circleGeometry args={[0.18, 24]} />
      </mesh>

      {/* White cloud puffs (instanced flattened spheres, static). */}
      <instancedMesh
        ref={cloudRef}
        args={[undefined, undefined, CLOUDS.length]}
        material={backdropMat('seaFoam')}
      >
        <sphereGeometry args={[1, 8, 5]} />
      </instancedMesh>

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

      {/* (d) FOLIAGE-GREEN SHAPES ---------------------------------------- */}
      {/* Distant headland + hero palm trunk + sailboat hull/mast, all
          `silhouette` (now deep green), merged — a single draw call. */}
      <mesh geometry={silhouetteGeo} material={backdropMat('silhouette')} />

      {/* Sail split out of the merge for the day pass: near-white canvas
          (seaFoam) instead of foliage green. Position = boat group offset
          (2.2, HORIZON_Y - 0.02, BOAT_Z) + local sail offset (0.06, 0.11). */}
      <mesh position={[2.26, HORIZON_Y + 0.09, BOAT_Z]} material={backdropMat('seaFoam')}>
        <shapeGeometry args={[sailShape]} />
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
