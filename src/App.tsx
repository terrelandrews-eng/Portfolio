import { useWebGLSupport } from './hooks/useWebGLSupport';
import { useDeviceTier } from './hooks/useDeviceTier';
import { colors } from './theme/tokens';
import SceneRoot from './scene/SceneRoot';
import HudRoot from './ui/HudRoot';
import IntroOverlay from './ui/IntroOverlay';
import StaticFallback from './fallback/StaticFallback';

export default function App() {
  const webglSupported = useWebGLSupport();
  // Syncs the resolved quality tier into the store as a side effect;
  // the scene/HUD will read tier from the store once M2 needs it.
  useDeviceTier();

  if (webglSupported === null) {
    // Still probing — render just the background to avoid a flash.
    return <div style={{ width: '100vw', height: '100vh', background: colors.bg }} />;
  }

  if (!webglSupported) {
    return <StaticFallback />;
  }

  return (
    <>
      <SceneRoot />
      <HudRoot />
      <IntroOverlay />
    </>
  );
}
