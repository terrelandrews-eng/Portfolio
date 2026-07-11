import { colors, fonts } from '../theme/tokens';

// Placeholder for the 3D scene. Real @react-three/fiber Canvas + room +
// camera rig lands in M2.
export default function SceneRoot() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bg,
        color: colors.paperMuted,
        fontFamily: fonts.mono,
        letterSpacing: '0.08em',
        opacity: 0.5,
      }}
    >
      SCENE — M2
    </div>
  );
}
