// Gray-box beach-shack office room. Volumes/positions only — real
// materials/textures land in M4, real lighting in M5. Keep everything
// here flat-shaded (meshLambertMaterial) and cheap.
//
// World space: meters, origin at floor center, +Z toward the viewer.
//   floor  y = 0            ceiling y = 3.0
//   back wall   z = -2.6    front wall  z = +2.6
//   left wall   x = -3.2    right wall  x = +3.2
// Window opening in the back wall, centered near (0.9, 1.7), 1.6w x 1.1h.

import { PALETTE } from './materials';

const ROOM_WIDTH = 6.4;
const ROOM_DEPTH = 5.2;
const ROOM_HEIGHT = 3.0;
const WALL_THICKNESS = 0.1;

const WINDOW_CENTER: [number, number] = [0.9, 1.7];
const WINDOW_W = 1.6;
const WINDOW_H = 1.1;

export default function Room() {
  const winLeft = WINDOW_CENTER[0] - WINDOW_W / 2; // 0.1
  const winRight = WINDOW_CENTER[0] + WINDOW_W / 2; // 1.7
  const winBottom = WINDOW_CENTER[1] - WINDOW_H / 2; // 1.15
  const winTop = WINDOW_CENTER[1] + WINDOW_H / 2; // 2.25

  const backWallLeftW = winLeft - -ROOM_WIDTH / 2; // 3.3
  const backWallRightW = ROOM_WIDTH / 2 - winRight; // 1.5

  return (
    <group>
      {/* --- Lighting (temporary; M5 owns final lighting) ------------ */}
      <ambientLight color={PALETTE.wall} intensity={0.6} />
      <directionalLight
        color="#FBE3AE"
        position={[0.9, 2.2, -1]}
        intensity={1.2}
      />
      <pointLight color={PALETTE.marker} position={[0.1, 1.05, -1.15]} intensity={1.2} distance={4} />

      {/* --- Floor ----------------------------------------------------- */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshLambertMaterial color={PALETTE.floor} />
      </mesh>

      {/* --- Ceiling ----------------------------------------------------- */}
      <mesh position={[0, ROOM_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshLambertMaterial color={PALETTE.wallDark} />
      </mesh>

      {/* --- Left wall (solid) ------------------------------------------ */}
      <mesh position={[-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, ROOM_HEIGHT, ROOM_DEPTH]} />
        <meshLambertMaterial color={PALETTE.wall} />
      </mesh>

      {/* --- Right wall (solid) ------------------------------------------ */}
      <mesh position={[ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, ROOM_HEIGHT, ROOM_DEPTH]} />
        <meshLambertMaterial color={PALETTE.wall} />
      </mesh>

      {/* --- Front wall (solid, behind camera seat) ---------------------- */}
      <mesh position={[0, ROOM_HEIGHT / 2, ROOM_DEPTH / 2]}>
        <boxGeometry args={[ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS]} />
        <meshLambertMaterial color={PALETTE.wall} />
      </mesh>

      {/* --- Back wall, windowed: built from 4 boxes around the opening -- */}
      {/* left segment, full height */}
      <mesh position={[-ROOM_WIDTH / 2 + backWallLeftW / 2, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2]}>
        <boxGeometry args={[backWallLeftW, ROOM_HEIGHT, WALL_THICKNESS]} />
        <meshLambertMaterial color={PALETTE.wall} />
      </mesh>
      {/* right segment, full height */}
      <mesh position={[winRight + backWallRightW / 2, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2]}>
        <boxGeometry args={[backWallRightW, ROOM_HEIGHT, WALL_THICKNESS]} />
        <meshLambertMaterial color={PALETTE.wall} />
      </mesh>
      {/* segment below the opening */}
      <mesh position={[WINDOW_CENTER[0], winBottom / 2, -ROOM_DEPTH / 2]}>
        <boxGeometry args={[WINDOW_W, winBottom, WALL_THICKNESS]} />
        <meshLambertMaterial color={PALETTE.wall} />
      </mesh>
      {/* segment above the opening */}
      <mesh position={[WINDOW_CENTER[0], winTop + (ROOM_HEIGHT - winTop) / 2, -ROOM_DEPTH / 2]}>
        <boxGeometry args={[WINDOW_W, ROOM_HEIGHT - winTop, WALL_THICKNESS]} />
        <meshLambertMaterial color={PALETTE.wall} />
      </mesh>

      {/* --- "Outside" backdrop seen through the window opening --------- */}
      <mesh position={[WINDOW_CENTER[0], WINDOW_CENTER[1], -4]}>
        <planeGeometry args={[4, 3]} />
        <meshBasicMaterial color={PALETTE.sky} />
      </mesh>

      {/* --- Placeholder desk -------------------------------------------- */}
      <Desk />
    </group>
  );
}

function Desk() {
  const topY = 0.75;
  const topThickness = 0.08;
  const legHeight = topY - topThickness / 2; // bottom of top surface
  const legSize = 0.06;
  const halfW = 1.9 / 2 - 0.08; // inset legs slightly from the edges
  const halfD = 0.8 / 2 - 0.08;

  return (
    <group position={[0.3, 0, -1.2]} rotation={[0, (8 * Math.PI) / 180, 0]}>
      <mesh position={[0, topY, 0]}>
        <boxGeometry args={[1.9, topThickness, 0.8]} />
        <meshLambertMaterial color={PALETTE.desk} />
      </mesh>
      {[
        [-halfW, -halfD],
        [halfW, -halfD],
        [-halfW, halfD],
        [halfW, halfD],
      ].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, legHeight / 2, lz]}>
          <boxGeometry args={[legSize, legHeight, legSize]} />
          <meshLambertMaterial color={PALETTE.desk} />
        </mesh>
      ))}
    </group>
  );
}
