// Wraps one placeholder mesh (the `children`) with the interaction shell
// every exhibit shares: a pulsing amber marker ring that always faces the
// camera, hover feedback (cursor + marker brighten + emissive tint on the
// wrapped mesh), click-to-open via the app store, and a dev-only letter
// badge for grading/orientation while there's no real geometry yet.

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ExhibitCore } from '../../content/types';
import { useAppStore } from '../../state/store';
import { PALETTE } from '../materials';
import { colors, fonts } from '../../theme/tokens';

const HOVER_EMISSIVE = new THREE.Color('#3a2a0a');
const NO_EMISSIVE = new THREE.Color('#000000');
const CHECKED_MARKER = '#8FBF6E';
const HOVER_MARKER = '#F7C866';

interface ExhibitObjectProps {
  def: ExhibitCore;
  children: ReactNode;
}

export default function ExhibitObject({ def, children }: ExhibitObjectProps) {
  const [hovered, setHovered] = useState(false);
  const ringRef = useRef<THREE.Mesh>(null);
  const contentRef = useRef<THREE.Group>(null);

  const found = useAppStore((s) => s.found.includes(def.id));
  const openExhibit = useAppStore((s) => s.openExhibit);
  const introPhase = useAppStore((s) => s.introPhase);

  // Gentle pulse on the marker ring, phase-offset per exhibit so a room
  // full of them doesn't breathe in unison.
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 2.4 + def.anchor[0] * 3) * 0.08;
    ringRef.current.scale.setScalar(pulse);
  });

  // Tint whatever mesh(es) the placeholder is made of on hover, without
  // requiring the child to cooperate — just walk the wrapped group and
  // set emissive on any material that supports it.
  useEffect(() => {
    const group = contentRef.current;
    if (!group) return;
    const target = hovered ? HOVER_EMISSIVE : NO_EMISSIVE;
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((m) => {
        const mat = m as THREE.MeshLambertMaterial;
        if (mat && 'emissive' in mat) {
          mat.emissive.copy(target);
        }
      });
    });
  }, [hovered]);

  const markerColor = found ? CHECKED_MARKER : hovered ? HOVER_MARKER : PALETTE.marker;

  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Guard here (the click call site) rather than in the rig: exhibits
        // are not selectable until the intro sequence has finished. The rig
        // also ignores pre-intro focus changes as a backstop.
        if (introPhase !== 'done') return;
        openExhibit(def.id);
      }}
    >
      <group ref={contentRef}>{children}</group>

      <Billboard position={def.anchor}>
        <mesh ref={ringRef}>
          <torusGeometry args={[0.09, 0.015, 8, 24]} />
          <meshBasicMaterial color={markerColor} />
        </mesh>
      </Billboard>

      {import.meta.env.DEV && (
        <Html
          position={[def.anchor[0], def.anchor[1] + 0.15, def.anchor[2]]}
          center
          occlude={false}
        >
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 11,
              lineHeight: 1,
              color: colors.amber,
              background: 'rgba(11,18,21,0.75)',
              padding: '2px 5px',
              border: `1px solid ${colors.amber}`,
              borderRadius: 2,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {def.letter}
          </div>
        </Html>
      )}
    </group>
  );
}
