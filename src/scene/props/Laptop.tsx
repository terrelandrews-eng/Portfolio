// Laptop — Exhibit C, the "FIELD OPERATIONS" terminal. Stylized low-poly
// noir laptop sitting open on the desk. Group origin is the base contact
// point (bottom-back-center where the base meets the desk), so mounting at
// (x, 0.79, z) seats the base flush on the desk top. At rotationY=0 the
// screen faces +Z — toward the visitor's seat / the camera.
//
// Structure (6 meshes):
//   1. base slab (metalDark)
//   2. keyboard deck — thin darker slab inset into the base top (wallDark)
//   3. trackpad inset — smaller darker slab toward the front edge (wallDark)
//   4. screen lid back panel (metalDark), hinged at the base back edge and
//      tilted back to a ~102° open angle
//   5. screen FACE — a plane carrying the one allowed canvas texture (a
//      tiny green terminal readout on a near-black ground)
//   6. amber sticker on the lid back (marker)
//
// Materials: `metalDark` (body), `wallDark` (key deck + trackpad), `marker`
// (sticker) — all from the shared palette (materials.ts). The screen face is
// the sanctioned local exception: a MeshBasicMaterial carrying a CanvasTexture
// so the display self-lights and glows in the dark room regardless of scene
// lighting (flagged in the report). No other inline colors are introduced —
// the canvas paints only PALETTE.screenDark and PALETTE.screenGreen.
//
// Blink: the block cursor toggles every ~600ms by swapping the material's map
// between two prebuilt CanvasTextures, driven off the frame clock in useFrame
// (NOT setInterval). On the 'reduced' quality tier the blink freezes with the
// cursor solid on, matching the store's quality-scaling contract.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { flatMat, PALETTE } from '../materials';
import { useAppStore } from '../../state/store';

interface PropProps {
  position?: [number, number, number];
  rotationY?: number;
}

// --- Base geometry ----------------------------------------------------------
const BASE_W = 0.32;
const BASE_D = 0.22;
const BASE_H = 0.015;
const BASE_TOP = BASE_H; // top surface height in local space
const BASE_BACK_Z = -BASE_D / 2; // hinge edge (away from viewer)

// Key deck: thin darker slab covering most of the base top, sitting just
// proud so its darker color reads as the recessed keyboard well.
const DECK_W = 0.28;
const DECK_D = 0.14;
const DECK_H = 0.005;
const DECK_Y = BASE_TOP + DECK_H / 2 - 0.001;
const DECK_Z = -0.015; // biased toward the hinge (back)

// Trackpad: small darker inset toward the front edge (nearest the viewer).
const PAD_W = 0.07;
const PAD_D = 0.05;
const PAD_H = 0.004;
const PAD_Y = BASE_TOP + PAD_H / 2 - 0.001;
const PAD_Z = 0.06;

// --- Lid / screen -----------------------------------------------------------
const LID_W = 0.3;
const LID_H = 0.2;
const LID_T = 0.01;
// Open angle ~102°: 12° past vertical, tipping the top back (−Z). Negative
// X-rotation walks the top away from the viewer while keeping the face +Z.
const SCREEN_TILT = -0.21;
const HINGE: [number, number, number] = [0, BASE_TOP, BASE_BACK_Z + 0.01];

// Screen face: inset inside the lid bezel, nudged just in front of the panel.
const FACE_W = 0.26;
const FACE_H = 0.16;

// --- Canvas texture ---------------------------------------------------------
const TEX_W = 256;
const TEX_H = 160;
const BLINK_PERIOD = 0.6; // seconds per on/off half-cycle

const SCREEN_LINES = [
  '> decrypting case files…',
  '> matching prints',
  '> cross-ref: 3 leads',
  '> 5 found',
];

function makeScreenTexture(withCursor: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Near-black ground (palette screenDark)
    ctx.fillStyle = PALETTE.screenDark;
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    // Green terminal text (palette screenGreen)
    ctx.fillStyle = PALETTE.screenGreen;
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textBaseline = 'alphabetic';

    const x = 14;
    const firstBaseline = 34;
    const step = 30;
    SCREEN_LINES.forEach((line, i) => {
      ctx.fillText(line, x, firstBaseline + i * step);
    });

    // Blinking block cursor after the last line
    if (withCursor) {
      const lastY = firstBaseline + (SCREEN_LINES.length - 1) * step;
      const lastW = ctx.measureText(SCREEN_LINES[SCREEN_LINES.length - 1]).width;
      ctx.fillRect(x + lastW + 5, lastY - 13, 11, 15);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export default function Laptop({ position = [0, 0, 0], rotationY = 0 }: PropProps) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const lastPhase = useRef(-1);
  const qualityTier = useAppStore((s) => s.qualityTier);

  // Two prebuilt textures — cursor on / cursor off — swapped, never redrawn.
  const { texOn, texOff } = useMemo(
    () => ({ texOn: makeScreenTexture(true), texOff: makeScreenTexture(false) }),
    [],
  );

  useFrame((state) => {
    if (!matRef.current) return;
    // Frozen (cursor solid on) on the reduced perf tier; otherwise blink off
    // the frame clock — no setInterval.
    const on =
      qualityTier === 'reduced' ||
      Math.floor(state.clock.elapsedTime / BLINK_PERIOD) % 2 === 0;
    const phase = on ? 1 : 0;
    if (phase !== lastPhase.current) {
      matRef.current.map = on ? texOn : texOff;
      matRef.current.needsUpdate = true;
      lastPhase.current = phase;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Base slab */}
      <mesh position={[0, BASE_H / 2, 0]} material={flatMat('metalDark')} castShadow receiveShadow>
        <boxGeometry args={[BASE_W, BASE_H, BASE_D]} />
      </mesh>

      {/* Keyboard deck — darker inset */}
      <mesh position={[0, DECK_Y, DECK_Z]} material={flatMat('wallDark')}>
        <boxGeometry args={[DECK_W, DECK_H, DECK_D]} />
      </mesh>

      {/* Trackpad inset */}
      <mesh position={[0, PAD_Y, PAD_Z]} material={flatMat('wallDark')}>
        <boxGeometry args={[PAD_W, PAD_H, PAD_D]} />
      </mesh>

      {/* Screen assembly — pivoted at the hinge and tilted back */}
      <group position={HINGE} rotation={[SCREEN_TILT, 0, 0]}>
        {/* Lid back panel */}
        <mesh position={[0, LID_H / 2, LID_T / 2]} material={flatMat('metalDark')} castShadow>
          <boxGeometry args={[LID_W, LID_H, LID_T]} />
        </mesh>

        {/* Screen face — the one allowed canvas texture, self-lit so it glows */}
        <mesh position={[0, LID_H / 2, LID_T + 0.001]}>
          <planeGeometry args={[FACE_W, FACE_H]} />
          <meshBasicMaterial ref={matRef} map={texOn} toneMapped={false} />
        </mesh>

        {/* Amber sticker on the lid back */}
        <mesh position={[0.09, 0.15, -0.004]} material={flatMat('marker')}>
          <boxGeometry args={[0.04, 0.04, 0.006]} />
        </mesh>
      </group>
    </group>
  );
}
