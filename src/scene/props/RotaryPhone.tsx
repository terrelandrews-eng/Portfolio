// RotaryPhone — Exhibit D, the fiction's "SECURE LINE". A stylized
// low-poly 1950s bakelite rotary desk phone. Group origin is the base
// contact point (the wide foot sits on the desk surface), so mounting at
// desk height (y = 0.79) seats the foot flush. Dial face points toward +Z
// at rotationY = 0; the handset lies across the top parallel to the front
// edge, the coiled cord loops off the left side down to the desk and back
// up to the handset.
//
// Structure:
//   - Body: a single LatheGeometry bell — wide foot, pinched waist,
//     narrower flat top — the pyramidal bakelite base (metalDark).
//   - Dial: a warm disc on the front-upper slope (metalWarm), a ring of
//     10 dark finger holes (wallDark) as one InstancedMesh, plus a small
//     warm center disc.
//   - Handset: two flattened-sphere ear/mouth cups joined by a curved
//     torus-arc grip bar, resting on two short cradle posts (metalDark).
//   - Cord: a TubeGeometry swept along a CatmullRom curve that droops from
//     the body's left side down to the desk and coils back up (metalDark).
//
// Materials: all from the shared palette (materials.ts) — metalDark for
// the body/handset/posts/cord, metalWarm for the dial, wallDark for the
// finger holes. No inline colors. `wallDark` is the palette's darkest
// value and reads as the recessed dial holes; flagged as a near-match, not
// an exact "hole black". No new colors were needed.
//
// Budget: 9 plain meshes + 1 InstancedMesh (holes); ~1.5k tris. The cord
// tube (64x5) and the lathe bell are the spenders.

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { flatMat } from '../materials';

// ---- Body lathe profile (radius x, height y), bottom -> top. Caps at
// x = 0 at both ends so the bell is a closed solid, not an open tube.
const BODY_PROFILE: [number, number][] = [
  [0.0, 0.0],
  [0.085, 0.0],
  [0.09, 0.012],
  [0.082, 0.03],
  [0.07, 0.055],
  [0.062, 0.08],
  [0.056, 0.098],
  [0.048, 0.105],
  [0.0, 0.105],
];
const BODY_TOP_Y = 0.105;

// ---- Dial, mounted on the front-upper slope, facing +Z.
const DIAL_POS: [number, number, number] = [0, 0.055, 0.052];
const DIAL_RADIUS = 0.048;
const DIAL_THICK = 0.016;
const HOLE_COUNT = 10;
const HOLE_RING_R = 0.034; // radius of the finger-hole ring on the dial face
const HOLE_FACE_Z = DIAL_POS[2] + 0.01; // holes sit proud of the dial face

// ---- Handset, resting across the top. Local frame: grip bows up in +Y,
// spans X; cups hang at each end. The sub-group is lifted to cradle height.
const HANDSET_Y = 0.125;
const HANDSET_Z = -0.005;
const GRIP_R = 0.075; // torus major radius
const GRIP_ARC = 1.4; // arc swept (rad), centered about the top of the ring
const GRIP_Y_OFF = -0.066; // drop the arc so the bar centers on the group

// ---- Cradle posts under the handset.
const POST_X = 0.045;

// Reusable dummy for building instance matrices (matches other props).
const dummy = new THREE.Object3D();

interface PropProps {
  position?: [number, number, number];
  rotationY?: number;
}

export default function RotaryPhone({ position = [0, 0, 0], rotationY = 0 }: PropProps) {
  const holesRef = useRef<THREE.InstancedMesh>(null);

  // Lathe profile as Vector2[] (radius, height).
  const bodyPoints = useMemo(
    () => BODY_PROFILE.map(([r, h]) => new THREE.Vector2(r, h)),
    [],
  );

  // Coiled cord curve: a drooping catenary-ish center path from the body's
  // left exit down toward the desk and back up to the handset, with a
  // horizontal coil offset (radius swells in the middle, zero at the ends
  // so the tube attaches cleanly). 2.5 lazy loops.
  const cordCurve = useMemo(() => {
    const A = new THREE.Vector3(-0.085, 0.04, 0.0); // exit on body's left
    const B = new THREE.Vector3(-0.05, 0.113, -0.005); // handset left cup
    const N = 48;
    const coils = 2.5;
    const drop = 0.07; // how far the center sags toward the desk
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const s = Math.sin(Math.PI * t);
      const angle = t * Math.PI * 2 * coils;
      const rc = 0.028 * s; // coil radius: 0 at ends, ~0.028 mid
      const cx = A.x + (B.x - A.x) * t - 0.05 * s; // bulge left in the middle
      const cy = A.y + (B.y - A.y) * t - drop * s; // sag toward desk (y~0)
      const cz = A.z + (B.z - A.z) * t - 0.02 * s;
      pts.push(
        new THREE.Vector3(
          cx + rc * Math.cos(angle),
          cy,
          cz + rc * Math.sin(angle),
        ),
      );
    }
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  }, []);

  // Finger-hole instance matrices: a ring of small cylinders on the dial
  // face, axes along +Z (rotated a quarter turn so the disc faces front).
  const holeMatrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < HOLE_COUNT; i++) {
      const a = (i / HOLE_COUNT) * Math.PI * 2;
      dummy.position.set(
        DIAL_POS[0] + HOLE_RING_R * Math.cos(a),
        DIAL_POS[1] + HOLE_RING_R * Math.sin(a),
        HOLE_FACE_Z,
      );
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      out.push(dummy.matrix.clone());
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    if (holesRef.current) {
      holeMatrices.forEach((m, i) => holesRef.current!.setMatrixAt(i, m));
      holesRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [holeMatrices]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Body — bakelite bell, code-authored lathe profile. */}
      <mesh material={flatMat('metalDark')} castShadow receiveShadow>
        <latheGeometry args={[bodyPoints, 14]} />
      </mesh>

      {/* Dial — warm disc on the front slope, facing +Z. */}
      <mesh
        position={DIAL_POS}
        rotation={[Math.PI / 2, 0, 0]}
        material={flatMat('metalWarm')}
        castShadow
      >
        <cylinderGeometry args={[DIAL_RADIUS, DIAL_RADIUS, DIAL_THICK, 16]} />
      </mesh>

      {/* Dial center hub, slightly proud of the face. */}
      <mesh
        position={[DIAL_POS[0], DIAL_POS[1], DIAL_POS[2] + 0.012]}
        rotation={[Math.PI / 2, 0, 0]}
        material={flatMat('metalWarm')}
        castShadow
      >
        <cylinderGeometry args={[0.016, 0.016, 0.02, 12]} />
      </mesh>

      {/* Finger holes — one InstancedMesh, a ring of dark cylinders. */}
      <instancedMesh
        ref={holesRef}
        args={[undefined, undefined, holeMatrices.length]}
        material={flatMat('wallDark')}
      >
        <cylinderGeometry args={[0.006, 0.006, 0.014, 6]} />
      </instancedMesh>

      {/* Cradle posts — two short cylinders the handset rests on. */}
      <mesh
        position={[-POST_X, BODY_TOP_Y - 0.002, 0]}
        material={flatMat('metalDark')}
        castShadow
      >
        <cylinderGeometry args={[0.01, 0.011, 0.026, 6]} />
      </mesh>
      <mesh
        position={[POST_X, BODY_TOP_Y - 0.002, 0]}
        material={flatMat('metalDark')}
        castShadow
      >
        <cylinderGeometry args={[0.01, 0.011, 0.026, 6]} />
      </mesh>

      {/* Handset — grip bar + two cups, lifted to cradle height. */}
      <group position={[0, HANDSET_Y, HANDSET_Z]}>
        {/* Curved grip bar: a torus arc bowing up in +Y, spanning X. The
            arc is centered about the ring's top by rotating Z, then dropped
            so the bar sits on the group's midline. */}
        <mesh
          position={[0, GRIP_Y_OFF, 0]}
          rotation={[0, 0, Math.PI / 2 - GRIP_ARC / 2]}
          material={flatMat('metalDark')}
          castShadow
        >
          <torusGeometry args={[GRIP_R, 0.011, 6, 10, GRIP_ARC]} />
        </mesh>

        {/* Ear cup (left) — flattened sphere. */}
        <mesh
          position={[-0.05, -0.012, 0]}
          scale={[1.1, 0.7, 1]}
          material={flatMat('metalDark')}
          castShadow
        >
          <sphereGeometry args={[0.024, 8, 6]} />
        </mesh>

        {/* Mouth cup (right) — flattened sphere. */}
        <mesh
          position={[0.05, -0.012, 0]}
          scale={[1.1, 0.7, 1]}
          material={flatMat('metalDark')}
          castShadow
        >
          <sphereGeometry args={[0.024, 8, 6]} />
        </mesh>
      </group>

      {/* Coiled cord — TubeGeometry along the drooping CatmullRom curve. */}
      <mesh material={flatMat('metalDark')} castShadow>
        <tubeGeometry args={[cordCurve, 64, 0.006, 5, false]} />
      </mesh>
    </group>
  );
}
