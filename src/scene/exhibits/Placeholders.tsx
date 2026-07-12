// Gray-box stand-ins for all 9 exhibits. Real props/models replace these
// box meshes in a later milestone; for now each one just needs to exist
// at its anchor with a roughly correct footprint so the marker/hover/
// click interaction (ExhibitObject) and camera-dolly tuning have
// something to aim at.
//
// Box dimensions are three.js [width-x, height-y, depth-z]. For desk
// items that's arbitrary (they're cubes). For wall-mounted items the
// "thin" dimension from the spec is reoriented to whichever room axis is
// actually perpendicular to that wall:
//   - back wall (window, board): perpendicular axis is z, so spec order
//     (w, h, thin) maps directly to (x, y, z).
//   - side walls (shelf on left @ x=-3.2, photos on right @ x=+3.2):
//     perpendicular axis is x, so the spec's (along-wall, h, thin) maps
//     to (thin, h, along-wall) = (x, y, z).

import type { ReactNode } from 'react';
import { EXHIBITS } from '../../content/exhibits';
import type { ExhibitId } from '../../content/types';
import ExhibitObject from './ExhibitObject';
import WindowFrame from '../props/WindowFrame';
import Corkboard from '../props/Corkboard';
import Bookshelf from '../props/Bookshelf';

// Real M4 prop components for exhibits that have them; the rest keep
// their gray-box stand-ins until their prop pass lands. Mount positions
// are the real-world prop origins (base/face centers), not necessarily
// the marker anchor from exhibits.ts.
const REAL: Partial<Record<ExhibitId, ReactNode>> = {
  window: <WindowFrame position={[0.9, 1.7, -2.55]} />,
  board: <Corkboard position={[-1.5, 1.75, -2.55]} />,
  shelf: <Bookshelf position={[-3.05, 0, -1.2]} />,
};

interface PlaceholderSpec {
  size: [number, number, number];
  color: string;
  transparent?: boolean;
  opacity?: number;
}

const SPECS: Record<ExhibitId, PlaceholderSpec> = {
  window: { size: [1.6, 1.1, 0.06], color: '#5fa8b0', transparent: true, opacity: 0.3 },
  journal: { size: [0.25, 0.25, 0.25], color: '#8a6d4b' },
  laptop: { size: [0.25, 0.25, 0.25], color: '#6b7280' },
  phone: { size: [0.25, 0.25, 0.25], color: '#4b6b8a' },
  board: { size: [1.1, 0.8, 0.05], color: '#d8d3c4' },
  shelf: { size: [0.35, 1.8, 0.9], color: '#6b4f3a' },
  photos: { size: [0.04, 0.5, 1.2], color: '#a85c5c' },
  radio: { size: [0.25, 0.25, 0.25], color: '#8a7a4b' },
  mug: { size: [0.25, 0.25, 0.25], color: '#c97b4a' },
};

export default function Placeholders() {
  return (
    <>
      {EXHIBITS.map((def) => {
        const real = REAL[def.id];
        const spec = SPECS[def.id];
        return (
          <ExhibitObject key={def.id} def={def}>
            {real ?? (
              <mesh position={def.anchor}>
                <boxGeometry args={spec.size} />
                <meshLambertMaterial
                  color={spec.color}
                  transparent={spec.transparent}
                  opacity={spec.opacity ?? 1}
                />
              </mesh>
            )}
          </ExhibitObject>
        );
      })}
    </>
  );
}
