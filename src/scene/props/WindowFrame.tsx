// Weathered beach-shack window filling the 1.6 x 1.1 wall opening.
// Component origin = center of the opening. Local axes follow the room's
// world space (see Room.tsx): +Z is the interior/room side (camera side),
// -Z is the exterior side (toward the sky backdrop). Local z = 0 sits
// flush with the wall's interior (room-facing) surface, and the wall
// itself occupies z in [-0.1, 0] behind the frame.
//
// Reference (reference/office-painting.png) shows a simple, clean wood
// window frame with a single horizontal sash bar splitting the glass
// into two lights, no exterior shutters, and a plain sill below. No
// window in the painting carries shutters, so this prop skips them
// (flagged in the build report) and instead leans on frame chunkiness +
// the interior sill to read as a hand-built beach-shack window. Open-air
// opening — no glass mesh, matching the "sea breeze" note.

import { flatMat } from '../materials';

const WINDOW_W = 1.6;
const WINDOW_H = 1.1;

// Outer frame boards (chunky, weathered trim)
const FRAME_W = 0.12; // board width as seen from the front
const FRAME_D = 0.14; // board depth, centered on the wall's interior face
const FRAME_OUTER_W = WINDOW_W + FRAME_W * 2;

// Center mullions (thinner than the frame, visually recessed since they
// share the same z-center but a shallower depth)
const MULL_W = 0.06;
const MULL_D = 0.08;

// Interior sill (protrudes into the room past the frame face)
const SILL_W = WINDOW_W + FRAME_W * 2 + 0.06; // small "horn" overhang past the frame
const SILL_THICK = 0.06;
const SILL_DEPTH = 0.18;
const SILL_FRONT_Z = FRAME_D / 2 + 0.09; // frame face + ~0.09m protrusion
const SILL_Z = SILL_FRONT_Z - SILL_DEPTH / 2;
const SILL_Y = -WINDOW_H / 2 - SILL_THICK / 2;

interface WindowFrameProps {
  position?: [number, number, number];
}

export default function WindowFrame({ position = [0, 0, 0] }: WindowFrameProps) {
  const trim = flatMat('trim');
  const sillMat = flatMat('woodLight');

  return (
    <group position={position}>
      {/* --- Outer frame: 4 chunky boards, picture-frame joinery --------- */}
      <mesh position={[0, WINDOW_H / 2 + FRAME_W / 2, 0]} material={trim}>
        <boxGeometry args={[FRAME_OUTER_W, FRAME_W, FRAME_D]} />
      </mesh>
      <mesh position={[0, -WINDOW_H / 2 - FRAME_W / 2, 0]} material={trim}>
        <boxGeometry args={[FRAME_OUTER_W, FRAME_W, FRAME_D]} />
      </mesh>
      <mesh position={[-WINDOW_W / 2 - FRAME_W / 2, 0, 0]} material={trim}>
        <boxGeometry args={[FRAME_W, WINDOW_H, FRAME_D]} />
      </mesh>
      <mesh position={[WINDOW_W / 2 + FRAME_W / 2, 0, 0]} material={trim}>
        <boxGeometry args={[FRAME_W, WINDOW_H, FRAME_D]} />
      </mesh>

      {/* --- Center mullions: 1 vertical + 1 horizontal, 4 panes --------- */}
      <mesh position={[0, 0, 0]} material={trim}>
        <boxGeometry args={[MULL_W, WINDOW_H, MULL_D]} />
      </mesh>
      <mesh position={[0, 0, 0]} material={trim}>
        <boxGeometry args={[WINDOW_W, MULL_W, MULL_D]} />
      </mesh>

      {/* --- Interior sill: protruding shelf-edge below the opening ------ */}
      <mesh position={[0, SILL_Y, SILL_Z]} material={sillMat}>
        <boxGeometry args={[SILL_W, SILL_THICK, SILL_DEPTH]} />
      </mesh>
    </group>
  );
}
