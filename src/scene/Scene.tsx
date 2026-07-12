// Everything that lives inside the <Canvas>: background/fog, the camera rig,
// and the room + exhibit content. SceneRoot owns the Canvas shell (DOM
// wrapper, camera/dpr/shadow config); this owns what's drawn.

import { colors } from '../theme/tokens';
import CameraRig from './CameraRig';
import Room from './Room';
import Placeholders from './exhibits/Placeholders';
import Effects from './Effects';
import LightShafts from './atmosphere/LightShafts';
import DustMotes from './atmosphere/DustMotes';

export default function Scene() {
  return (
    <>
      <color attach="background" args={[colors.bg]} />
      {/* Day grade: distance fades toward bright haze, not noir black,
          and much less of it — the room should read clean at midday. */}
      <fogExp2 attach="fog" args={['#c3dde4', 0.022]} />
      {/* The rig owns the camera every frame (position + look): idle drift,
          fly-to/return dollies, mouse-look. Replaces the old one-shot aim. */}
      <CameraRig />
      <Room />
      <Placeholders />
      {/* Atmosphere (M5): additive window shafts + drifting dust motes. */}
      <LightShafts />
      <DustMotes />
      {/* Post chain (M5): Bloom -> DoF (high tier) -> Vignette -> Noise. */}
      <Effects />
    </>
  );
}
