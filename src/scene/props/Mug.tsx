// Mug — Exhibit I ("#1 DAD"). Stylized low-poly noir coffee mug, a small
// desk item ~0.09 diameter x 0.10 tall. Group origin is the base contact
// point (the foot resting on the desk surface, world y=0.79 desk mount),
// meters. Decal ("#1 DAD") faces +Z at rotationY=0; the handle sits at the
// back (-Z) so it never competes with the decal.
//
// Structure (6 meshes total):
//   (a) body — ONE open-top LatheGeometry profile: base cap -> outer wall
//       up -> lip -> short thin inner wall back down. `paper` (ceramic).
//   (b) coffee surface — a flat disc dropped just inside the inner wall,
//       near the top. `wallDark` (dark coffee).
//   (c) handle — a half TorusGeometry, built via sequential geometry
//       rotations (not an Euler `rotation` prop, to avoid axis-order
//       ambiguity) so its diameter is vertical and it bulges outward at
//       the back. `paper`.
//   (d) decal — "#1 DAD" stamped in bold blocky letters on ONE small
//       (128x64) transparent canvas texture, applied to a flat
//       PlaneGeometry hugging the front of the mug (see DEVIATION 1
//       below for why a plane was chosen over a curved cylinder-segment
//       shell).
//   (e)-(f) steam — two thin vertical planes above the rim, swaying very
//       slowly in useFrame; frozen when qualityTier === 'reduced' (see
//       DEVIATION 2 below for their material).
//
// Materials: flatMat('paper') for body + handle, flatMat('wallDark') for
// the coffee surface — both from materials.ts, no inline colors there.
//
// DEVIATION 1 (pre-approved by the brief): the decal needs a textured
// material, which flatMat() can't produce (it only takes palette keys).
// A local MeshBasicMaterial with a generated CanvasTexture (map) is used
// instead. The canvas paint color is `colors.stampRed` (#B0402E) from
// ../../theme/tokens — that's paint drawn onto a transparent bitmap, not
// a new scene material color, per the brief's explicit carve-out.
//   Decal shape: chose a FLAT PLANE over a curved cylinder-segment shell.
//   A partial CylinderGeometry(thetaStart/thetaLength) would technically
//   wrap the curve, but getting its U-direction (left/right) and winding
//   correct with zero visual QA available in this pass was a real risk of
//   shipping a mirrored or backface-culled decal. A plane proud of the
//   body by ~1mm is cheap, robust, and reads correctly at the exhibit's
//   near-head-on camera angle. Flagging per the brief's instruction.
//
// DEVIATION 2 (pre-approved by the brief): steam uses a local
// MeshBasicMaterial (color flatMat's own PALETTE.paper value, opacity
// 0.12, transparent, depthWrite false, DoubleSide) rather than flatMat(),
// since flatMat's cached MeshLambertMaterial instances are opaque and
// shared — mutating one to be translucent would corrupt every other prop
// using 'paper'. This local material is intentionally NOT cached/shared.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { flatMat, PALETTE } from '../materials';
import { useAppStore } from '../../state/store';
import { colors } from '../../theme/tokens';

interface PropProps {
  position?: [number, number, number];
  rotationY?: number;
}

// --- Body: single open-top lathe profile (radius, y) in meters ----------
// base cap -> outer wall -> lip -> short inner wall, revolved around Y.
const BODY_POINTS = [
  new THREE.Vector2(0, 0), // base center — closes the bottom flat
  new THREE.Vector2(0.038, 0), // base outer edge
  new THREE.Vector2(0.043, 0.008), // slight belly out from the foot
  new THREE.Vector2(0.043, 0.082), // outer wall rising
  new THREE.Vector2(0.044, 0.095), // outer wall continues toward the rim
  new THREE.Vector2(0.045, 0.1), // rim outer top — widest point
  new THREE.Vector2(0.04, 0.099), // rim top surface, stepping inward (thin lip)
  new THREE.Vector2(0.037, 0.09), // inner wall drops a bit below the rim
  new THREE.Vector2(0.035, 0.078), // inner wall bottoms out just above the coffee disc
];
const BODY_SEGMENTS = 12;

// --- Coffee surface disc, sitting just inside the inner wall -----------
const COFFEE_Y = 0.076;
const COFFEE_RADIUS = 0.033;

// --- Handle geometry (built once, sequential rotations — see header) ---
const HANDLE_RADIUS = 0.026;
const HANDLE_TUBE = 0.007;
const HANDLE_Y = 0.05; // mid-height anchor; spans ~0.024..0.076 vertically
const HANDLE_Z = -0.043; // mug's back outer wall, ~ constant radius there

// --- Decal plane (flat, hugging the front) ------------------------------
const DECAL_W = 0.05;
const DECAL_H = 0.025;
const DECAL_Y = 0.05;
const DECAL_Z = 0.044; // ~1mm proud of the front outer wall

// --- Steam wisps ---------------------------------------------------------
const STEAM_BASE_Y = 0.1; // rim height
const STEAM_H = 0.055;
const STEAM_W = 0.012;
const STEAM_X = [-0.012, 0.01];
const STEAM_Z = [0.006, -0.004];
const SWAY_SPEED = 0.35; // rad/s, kept very slow per the brief

export default function Mug({ position = [0, 0, 0], rotationY = 0 }: PropProps) {
  const qualityTier = useAppStore((s) => s.qualityTier);
  const steamGroupRefs = useRef<(THREE.Group | null)[]>([]);

  // Handle geometry: default TorusGeometry lies in the XY plane with its
  // diameter along X (arc endpoints at theta=0 and theta=PI) and its
  // mid-arc bulge along +Y. Two sequential geometry-space rotations (not
  // an Euler `rotation` prop, to sidestep axis-order ambiguity) walk that
  // to: diameter vertical along local Y, bulge along local -Z. Positioning
  // the mesh at HANDLE_Z (the mug's back wall) then makes the two
  // attachment points sit flush against the body and the bulge stick out
  // backward, away from the mug — a standard handle silhouette.
  const handleGeometry = useMemo(() => {
    const g = new THREE.TorusGeometry(HANDLE_RADIUS, HANDLE_TUBE, 6, 10, Math.PI);
    g.rotateZ(Math.PI / 2);
    g.rotateY(-Math.PI / 2);
    return g;
  }, []);

  // "#1 DAD" stamp — one small transparent canvas texture, painted (not a
  // new material color) in tokens' stampRed. See DEVIATION 1 above.
  const decalTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = colors.stampRed;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 34px "Arial Black", Arial, sans-serif';
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-0.03); // faint stamp tilt
      ctx.fillText('#1 DAD', 0, 2);
      ctx.restore();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const decalMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: decalTexture,
        transparent: true,
        depthWrite: false,
      }),
    [decalTexture],
  );

  // DEVIATION 2 — local translucent material for steam, not flatMat()
  // (whose cached 'paper' instance is opaque and shared). See header.
  const steamMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: PALETTE.paper,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (qualityTier === 'reduced') return; // frozen on the reduced perf tier
    const t = clock.elapsedTime;
    steamGroupRefs.current.forEach((g, i) => {
      if (!g) return;
      g.rotation.z = Math.sin(t * SWAY_SPEED + i * 2.1) * 0.06;
      g.rotation.x = Math.sin(t * SWAY_SPEED * 0.7 + i) * 0.03;
    });
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Body — outer wall, lip, and short inner wall in one lathe pass */}
      <mesh material={flatMat('paper')} castShadow receiveShadow>
        <latheGeometry args={[BODY_POINTS, BODY_SEGMENTS]} />
      </mesh>

      {/* Coffee surface, visible through the open top */}
      <mesh position={[0, COFFEE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={flatMat('wallDark')}>
        <circleGeometry args={[COFFEE_RADIUS, 12]} />
      </mesh>

      {/* Handle, back of the mug */}
      <mesh position={[0, HANDLE_Y, HANDLE_Z]} geometry={handleGeometry} material={flatMat('paper')} castShadow />

      {/* "#1 DAD" decal, front of the mug */}
      <mesh position={[0, DECAL_Y, DECAL_Z]} material={decalMaterial}>
        <planeGeometry args={[DECAL_W, DECAL_H]} />
      </mesh>

      {/* Steam wisps, swaying from their base at the rim */}
      {STEAM_X.map((x, i) => (
        <group
          key={i}
          ref={(el) => {
            steamGroupRefs.current[i] = el;
          }}
          position={[x, STEAM_BASE_Y, STEAM_Z[i]]}
        >
          <mesh position={[0, STEAM_H / 2, 0]} material={steamMaterial}>
            <planeGeometry args={[STEAM_W, STEAM_H]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
