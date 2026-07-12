// Radio — Exhibit H, "FREQ 94.7". A stylized low-poly 1950s field radio that
// sits on the desk surface. Group origin is the base contact point (bottom of
// the cabinet), so mounting at y = 0.79 seats it flush on the desk top. The
// front face (+Z at rotationY = 0) carries the speaker grille and control
// panel and is meant to face the visitor/camera.
//
// Overall envelope ~0.30 w x 0.20 h x 0.14 d.
//
// Structure:
//   - Cabinet: rounded-edge box (drei RoundedBox), `woodRed` warm red-brown.
//   - Front face split at x = +0.05: left two-thirds is the speaker grille
//     (a recessed dark backing plate + one InstancedMesh of 7 vertical slats);
//     right third is a control panel (dark inset plate) carrying 2 brass knobs,
//     a glowing amber frequency-dial strip, and a thin dark needle.
//   - Whip antenna: thin tapered cylinder rising from the back-left top,
//     leaning ~15 deg back and ~15 deg left.
//   - Carry handle: a half-torus arching across the top (dark leather strap).
//
// Materials: all from the shared palette (materials.ts). `woodRed` cabinet,
// `metalDark` for grille backing / control plate / needle-adjacent dark parts /
// antenna / handle, `metalWarm` brass knobs, and `emissiveMat('marker', 0.7)`
// for the amber dial glow. Geometry only.
//
// DEVIATION (flagged): the instanced grille slats need a dedicated material.
// Instancing works with any single material, but reusing the cached
// flatMat('metalDark') singleton for an InstancedMesh risks coupling this
// prop's draw state to every other prop that shares that cached material. To
// keep the instanced mesh self-contained I clone metalDark into a local,
// non-cached MeshLambertMaterial (same color, no new palette entry).

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { flatMat, emissiveMat, PALETTE } from '../materials';

interface PropProps {
  position?: [number, number, number];
  rotationY?: number;
}

// Cabinet envelope.
const CAB_W = 0.3;
const CAB_H = 0.2;
const CAB_D = 0.14;
const CAB_CY = CAB_H / 2; // center height above the desk
const FRONT_Z = CAB_D / 2; // +Z front face plane (0.07)

// Front face split: left two-thirds (grille) vs right third (control panel).
// Viewer looks down -Z at the +Z face, so the grille sits on the -X side.
const GRILLE_CX = -0.05; // center of the -0.15..+0.05 region
const PANEL_CX = 0.1; // center of the +0.05..+0.15 region

// Speaker grille slats.
const SLAT_COUNT = 7;
const SLAT_W = 0.009;
const SLAT_H = 0.14;
const SLAT_D = 0.008;
const SLAT_SPAN = 0.16; // total X spread of slat centers
const SLAT_Z = FRONT_Z + 0.008; // stand slightly proud of the cabinet face

// Antenna: base at the back-left top corner, leaning back (-Z) and left (-X).
const ANT_LEN = 0.45;
const ANT_BACK = 0.26; // ~15 deg tilt toward -Z
const ANT_LEFT = 0.26; // ~15 deg tilt toward -X
const ANT_BASE: [number, number, number] = [-0.12, CAB_H, -0.05];
// Local up axis after the two tilts (small-angle robust to Euler order).
const ANT_UX = -Math.sin(ANT_LEFT);
const ANT_UY = Math.cos(ANT_LEFT) * Math.cos(ANT_BACK);
const ANT_UZ = -Math.sin(ANT_BACK);
const ANT_CENTER: [number, number, number] = [
  ANT_BASE[0] + (ANT_LEN / 2) * ANT_UX,
  ANT_BASE[1] + (ANT_LEN / 2) * ANT_UY,
  ANT_BASE[2] + (ANT_LEN / 2) * ANT_UZ,
];

const dummy = new THREE.Object3D();

export default function Radio({ position = [0, 0, 0], rotationY = 0 }: PropProps) {
  const slatsRef = useRef<THREE.InstancedMesh>(null);

  // Local clone of metalDark for the instanced slats — see DEVIATION note.
  const slatMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: PALETTE.metalDark }),
    []
  );

  const slatMatrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < SLAT_COUNT; i++) {
      const t = i / (SLAT_COUNT - 1);
      const x = GRILLE_CX + (t - 0.5) * SLAT_SPAN;
      dummy.position.set(x, CAB_CY, SLAT_Z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      out.push(dummy.matrix.clone());
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const mesh = slatsRef.current;
    if (!mesh) return;
    slatMatrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [slatMatrices]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Cabinet — rounded-edge box */}
      <RoundedBox
        args={[CAB_W, CAB_H, CAB_D]}
        radius={0.012}
        smoothness={3}
        position={[0, CAB_CY, 0]}
        material={flatMat('woodRed')}
        castShadow
        receiveShadow
      />

      {/* Grille backing — recessed dark plate behind the slats */}
      <mesh position={[GRILLE_CX, CAB_CY, FRONT_Z - 0.002]} material={flatMat('metalDark')} receiveShadow>
        <boxGeometry args={[0.185, 0.15, 0.012]} />
      </mesh>

      {/* Speaker grille — one InstancedMesh of vertical slats */}
      <instancedMesh
        ref={slatsRef}
        args={[undefined, undefined, SLAT_COUNT]}
        material={slatMaterial}
        castShadow
      >
        <boxGeometry args={[SLAT_W, SLAT_H, SLAT_D]} />
      </instancedMesh>

      {/* Control panel — dark inset plate on the right third */}
      <mesh position={[PANEL_CX, CAB_CY, FRONT_Z + 0.001]} material={flatMat('metalDark')} receiveShadow>
        <boxGeometry args={[0.085, 0.16, 0.012]} />
      </mesh>

      {/* Two brass knobs — cylinders laid axis-along-Z, protruding from panel */}
      <mesh
        position={[PANEL_CX, 0.145, FRONT_Z + 0.017]}
        rotation={[Math.PI / 2, 0, 0]}
        material={flatMat('metalWarm')}
        castShadow
      >
        <cylinderGeometry args={[0.02, 0.02, 0.022, 12]} />
      </mesh>
      <mesh
        position={[PANEL_CX, 0.055, FRONT_Z + 0.017]}
        rotation={[Math.PI / 2, 0, 0]}
        material={flatMat('metalWarm')}
        castShadow
      >
        <cylinderGeometry args={[0.02, 0.02, 0.022, 12]} />
      </mesh>

      {/* Frequency dial strip — glows amber */}
      <mesh position={[PANEL_CX, CAB_CY, FRONT_Z + 0.012]} material={emissiveMat('marker', 0.7)}>
        <boxGeometry args={[0.07, 0.018, 0.006]} />
      </mesh>

      {/* Dial needle — thin dark box just in front of the glowing strip */}
      <mesh position={[PANEL_CX + 0.012, CAB_CY, FRONT_Z + 0.017]} material={flatMat('wallDark')}>
        <boxGeometry args={[0.004, 0.022, 0.004]} />
      </mesh>

      {/* Whip antenna — thin tapered cylinder from the back-left top */}
      <mesh
        position={ANT_CENTER}
        rotation={[-ANT_BACK, 0, ANT_LEFT]}
        material={flatMat('metalDark')}
        castShadow
      >
        <cylinderGeometry args={[0.0025, 0.006, ANT_LEN, 6]} />
      </mesh>

      {/* Carry handle — half-torus arching across the top (dark leather strap) */}
      <mesh position={[0, CAB_H, 0]} material={flatMat('metalDark')} castShadow>
        <torusGeometry args={[0.05, 0.006, 6, 12, Math.PI]} />
      </mesh>
    </group>
  );
}
