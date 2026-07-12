// Exhibit E — "THE NETWORK": investigation corkboard mounted flush on the
// back wall. Stylized low-poly noir, flat-shaded, code-authored geometry
// only. All materials come from ../materials (flatMat) — no inline colors.
//
// Contract: origin = center of the board face (the cork surface the pins
// sit on), local +Z faces into the room. The board itself (frame + cork)
// sits with its front face at local z=0 and its depth behind that
// (negative z), matching a flush wall mount. Default position is the
// exhibit's own anchor so the prop drops in correctly even before the
// orchestrator supplies one explicitly.
//
// Card faces are intentionally blank — no text geometry/decals. The panel
// UI carries the actual content; this prop is silhouette + suggestion
// only (frame, cork, a few pinned cards, red pins, red string).

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { flatMat } from '../materials';

interface CorkboardProps {
  position?: [number, number, number];
}

const BOARD_W = 1.1;
const BOARD_H = 0.8;
const FRAME_DEPTH = 0.03;
const CORK_DEPTH = 0.022;
const CORK_MARGIN = 0.045; // wood border visible around the cork inset
const CORK_W = BOARD_W - CORK_MARGIN * 2;
const CORK_H = BOARD_H - CORK_MARGIN * 2;
const CORK_FRONT_Z = 0; // board face = origin plane
const CARD_PROUD = 0.008; // cards stand this far off the cork face

// Reusable dummy for building instance matrices.
const dummy = new THREE.Object3D();

interface CardSpec {
  x: number;
  y: number;
  rotZ: number;
  w: number;
  h: number;
}

// 4 real index cards + 2 small scraps, scattered with a little rotation
// jitter so they don't read as a perfect grid.
const CARDS: CardSpec[] = [
  { x: -0.32, y: 0.18, rotZ: -0.09, w: 0.16, h: 0.11 },
  { x: 0.1, y: 0.22, rotZ: 0.06, w: 0.16, h: 0.11 },
  { x: -0.12, y: -0.12, rotZ: 0.04, w: 0.16, h: 0.11 },
  { x: 0.3, y: -0.08, rotZ: -0.05, w: 0.16, h: 0.11 },
  // extra scraps, smaller
  { x: -0.4, y: -0.2, rotZ: 0.12, w: 0.09, h: 0.07 },
  { x: 0.36, y: 0.24, rotZ: -0.14, w: 0.08, h: 0.06 },
];

// Pin positions: one per real card, roughly at the card's upper area so
// it reads as "pinned". Scraps don't get pins (curling loose scraps).
const PINS: { x: number; y: number }[] = [
  { x: -0.32, y: 0.225 },
  { x: 0.1, y: 0.265 },
  { x: -0.12, y: -0.07 },
  { x: 0.3, y: -0.035 },
];

// Zigzag conspiracy-map string connecting the pins, with one crossing
// segment for the "network" look.
const STRING_SEGMENTS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 2], // crossing diagonal
];

const STRING_THICKNESS = 0.004;
const STRING_Z = CARD_PROUD + 0.003; // sits just off the pin heads

export default function Corkboard({ position = [-1.5, 1.75, -2.55] }: CorkboardProps) {
  const cardsRef = useRef<THREE.InstancedMesh>(null);
  const pinsRef = useRef<THREE.InstancedMesh>(null);
  const stringRef = useRef<THREE.InstancedMesh>(null);

  const cardMatrices = useMemo(() => {
    return CARDS.map((c) => {
      dummy.position.set(c.x, c.y, CORK_FRONT_Z + CARD_PROUD / 2);
      dummy.rotation.set(0, 0, c.rotZ);
      dummy.scale.set(c.w, c.h, CARD_PROUD);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, []);

  const pinMatrices = useMemo(() => {
    return PINS.map((p) => {
      dummy.position.set(p.x, p.y, CORK_FRONT_Z + CARD_PROUD + 0.005);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.012, 0.012, 0.012);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, []);

  const stringMatrices = useMemo(() => {
    return STRING_SEGMENTS.map(([aIdx, bIdx]) => {
      const a = PINS[aIdx];
      const b = PINS[bIdx];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const angle = Math.atan2(dy, dx);
      dummy.position.set(midX, midY, STRING_Z);
      dummy.rotation.set(0, 0, angle);
      dummy.scale.set(length, STRING_THICKNESS, STRING_THICKNESS);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, []);

  useLayoutEffect(() => {
    if (cardsRef.current) {
      cardMatrices.forEach((m, i) => cardsRef.current!.setMatrixAt(i, m));
      cardsRef.current.instanceMatrix.needsUpdate = true;
    }
    if (pinsRef.current) {
      pinMatrices.forEach((m, i) => pinsRef.current!.setMatrixAt(i, m));
      pinsRef.current.instanceMatrix.needsUpdate = true;
    }
    if (stringRef.current) {
      stringMatrices.forEach((m, i) => stringRef.current!.setMatrixAt(i, m));
      stringRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [cardMatrices, pinMatrices, stringMatrices]);

  return (
    <group position={position}>
      {/* Wood frame — a single slab behind the cork; its border shows
          around the cork inset since the cork is smaller and centered. */}
      <mesh
        position={[0, 0, -FRAME_DEPTH / 2]}
        material={flatMat('trim')}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[BOARD_W, BOARD_H, FRAME_DEPTH]} />
      </mesh>

      {/* Cork face, flush with the frame's front (board face = origin). */}
      <mesh
        position={[0, 0, -CORK_DEPTH / 2]}
        material={flatMat('cork')}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[CORK_W, CORK_H, CORK_DEPTH]} />
      </mesh>

      {/* Pinned index cards + a couple of loose scraps, instanced. */}
      <instancedMesh
        ref={cardsRef}
        args={[undefined, undefined, cardMatrices.length]}
        material={flatMat('paper')}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Red pin dots, instanced. */}
      <instancedMesh
        ref={pinsRef}
        args={[undefined, undefined, pinMatrices.length]}
        material={flatMat('fabric')}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Red string zigzag connecting the pins, instanced thin boxes. */}
      <instancedMesh
        ref={stringRef}
        args={[undefined, undefined, stringMatrices.length]}
        material={flatMat('fabric')}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
}
