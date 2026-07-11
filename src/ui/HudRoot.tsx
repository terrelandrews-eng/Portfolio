import { colors, fonts, zIndex } from '../theme/tokens';

// Placeholder HUD chrome. Real exhibit tracker, mute/menu controls, and
// briefing card land in M3.
export default function HudRoot() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: zIndex.hud,
        display: 'flex',
        alignItems: 'center',
        padding: '14px 20px',
        color: colors.amber,
        fontFamily: fonts.mono,
        fontSize: 13,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
      }}
    >
      CASE FILE № 220 — T. ANDREWS
    </div>
  );
}
