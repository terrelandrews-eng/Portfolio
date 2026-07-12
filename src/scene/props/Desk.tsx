// Desk — worn wooden writing desk, the hero surface of the office (five
// exhibits sit on its top). Stylized low-poly noir: a chunky slab top with a
// slight overhang, four tapered square legs, a back modesty panel, and one
// visitor-facing drawer with a brass knob. Group origin is the floor contact
// point, so mounting at y=0 sits it on the floor; the top surface finishes at
// exactly y = 0.79.
//
// Materials come from the shared palette (materials.ts): carcass = `desk`,
// knob = `metalWarm`, drawer recess = `wallDark`. No inline colors.

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
  const legPositions: [number, number][] = [
    [-LEG_HX, -LEG_HZ],
    [LEG_HX, -LEG_HZ],
    [-LEG_HX, LEG_HZ],
    [LEG_HX, LEG_HZ],
  ];

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Slab top with slight overhang */}
      <mesh position={[0, TOP_CY, 0]} material={flatMat('desk')} castShadow receiveShadow>
        <boxGeometry args={[TOP_W, TOP_T, TOP_D]} />
      </mesh>

      {/* Four tapered square legs (4-sided cylinders, wider at top) */}
      {legPositions.map(([lx, lz], i) => (
        <mesh
          key={i}
          position={[lx, LEG_H / 2, lz]}
          rotation={[0, Math.PI / 4, 0]}
          material={flatMat('desk')}
          castShadow
        >
          <cylinderGeometry args={[0.06, 0.042, LEG_H, 4]} />
        </mesh>
      ))}

      {/* Front apron (visitor / +Z side), carries the drawer */}
      <mesh position={[0, 0.66, 0.335]} material={flatMat('desk')} castShadow>
        <boxGeometry args={[1.66, 0.14, 0.05]} />
      </mesh>

      {/* Back modesty panel (-Z, toward the window) */}
      <mesh position={[0, 0.58, -0.33]} material={flatMat('desk')} castShadow>
        <boxGeometry args={[1.66, 0.3, 0.035]} />
      </mesh>

      {/* Drawer recess — dark inset frame reading as shadow */}
      <mesh position={[0, 0.66, 0.362]} material={flatMat('wallDark')}>
        <boxGeometry args={[0.46, 0.115, 0.02]} />
      </mesh>

      {/* Drawer face — proud of the recess */}
      <mesh position={[0, 0.66, 0.372]} material={flatMat('desk')}>
        <boxGeometry args={[0.42, 0.095, 0.02]} />
      </mesh>

      {/* Brass knob */}
      <mesh position={[0, 0.66, 0.392]} rotation={[Math.PI / 2, 0, 0]} material={flatMat('metalWarm')}>
        <cylinderGeometry args={[0.02, 0.02, 0.05, 12]} />
      </mesh>
    </group>
  );
}
