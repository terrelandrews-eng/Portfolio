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

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { flatMat } from '../materials';
import { useAppStore } from '../../state/store';

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

  const bladeAngles = Array.from({ length: BLADE_COUNT }, (_, i) => (i * (Math.PI * 2)) / BLADE_COUNT);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Downrod — ceiling mount to motor hub */}
      <mesh position={[0, ROD_Y, 0]} material={flatMat('metalDark')} castShadow>
        <cylinderGeometry args={[0.02, 0.02, ROD_LEN, 6]} />
      </mesh>

      {/* Motor hub — static housing the blades key into */}
      <mesh position={[0, HUB_Y, 0]} material={flatMat('metalDark')} castShadow>
        <cylinderGeometry args={[HUB_RADIUS, HUB_RADIUS * 0.9, HUB_HEIGHT, 8]} />
      </mesh>

      {/* Spinning blade group */}
      <group ref={bladeGroupRef} position={[0, HUB_Y, 0]}>
        {bladeAngles.map((angle) => (
          <group key={angle} rotation={[0, angle, 0]}>
            <mesh
              position={[BLADE_RADIUS_OFFSET, 0, 0]}
              rotation={[0, 0, BLADE_PITCH]}
              material={flatMat('woodLight')}
              castShadow
            >
              <boxGeometry args={[BLADE_LEN, BLADE_T, BLADE_W]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
