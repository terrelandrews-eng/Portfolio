import { colors, fonts } from '../theme/tokens';

// Shown when WebGL is unavailable. Real static evidence index (flat HTML
// version of the exhibits) lands in M7.
export default function StaticFallback() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        background: colors.bg,
        color: colors.paper,
        fontFamily: fonts.mono,
        fontSize: 15,
        lineHeight: 1.6,
        textAlign: 'center',
      }}
    >
      This experience needs WebGL. Evidence index coming in M7.
    </div>
  );
}
