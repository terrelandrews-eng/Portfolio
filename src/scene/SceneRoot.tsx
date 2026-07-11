// Canvas shell: fills the viewport, owns camera/dpr/shadow config. Scene
// content (background, fog, room, exhibits) lives in Scene.tsx.

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { zIndex } from '../theme/tokens';
import Scene from './Scene';

export default function SceneRoot() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.canvas,
      }}
    >
      <Canvas
        camera={{ position: [0, 1.45, 2.3], fov: 55 }}
        dpr={[1, 1.75]}
        shadows={false}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
