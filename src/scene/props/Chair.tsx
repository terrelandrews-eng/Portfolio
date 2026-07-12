// Chair — simple wooden captain's / writing chair, scenery on the visitor
// side of the desk. Ladderback silhouette: a slab seat, two front legs, two
// rear posts that continue past the seat to frame the back, a top crest rail,
// and three vertical slats. Faces -Z at rotationY = 0 (looking toward the
// desk). Group origin is the floor contact point; seat height ~0.45.
//
// All wood uses the shared `woodLight` palette key (materials.ts). No inline
// colors.

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
  const slatXs = [-0.11, 0, 0.11];

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Seat slab */}
      <mesh position={[0, SEAT_Y, 0]} material={flatMat('woodLight')} castShadow receiveShadow>
        <boxGeometry args={[SEAT_W, SEAT_T, SEAT_D]} />
      </mesh>

      {/* Two front legs (floor -> underside of seat) */}
      {[-LEG_HX, LEG_HX].map((lx) => (
        <mesh
          key={`f${lx}`}
          position={[lx, SEAT_UNDER / 2, FRONT_Z]}
          rotation={[0, Math.PI / 4, 0]}
          material={flatMat('woodLight')}
          castShadow
        >
          <cylinderGeometry args={[0.03, 0.022, SEAT_UNDER, 4]} />
        </mesh>
      ))}

      {/* Two rear posts (floor -> back top; double as rear legs + back frame) */}
      {[-LEG_HX, LEG_HX].map((lx) => (
        <mesh
          key={`r${lx}`}
          position={[lx, BACK_TOP / 2, REAR_Z]}
          rotation={[0, Math.PI / 4, 0]}
          material={flatMat('woodLight')}
          castShadow
        >
          <cylinderGeometry args={[0.03, 0.03, BACK_TOP, 4]} />
        </mesh>
      ))}

      {/* Top crest rail joining the rear posts */}
      <mesh position={[0, BACK_TOP - 0.03, REAR_Z]} material={flatMat('woodLight')} castShadow>
        <boxGeometry args={[SEAT_W, 0.06, 0.04]} />
      </mesh>

      {/* Three vertical back slats between seat and crest */}
      {slatXs.map((sx) => (
        <mesh key={`s${sx}`} position={[sx, 0.66, REAR_Z]} material={flatMat('woodLight')}>
          <boxGeometry args={[0.05, 0.34, 0.02]} />
        </mesh>
      ))}
    </group>
  );
}
