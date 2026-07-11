import { useAppStore } from '../state/store';
import Hud, { hudVars } from './Hud';
import ExhibitPanel from './ExhibitPanel';
import './hud.css';

// Composition root for the case-file HUD (M3.3): top bar, footer strip,
// evidence tracker + dropdown (all in Hud.tsx / EvidenceMenu.tsx, the
// latter mounted from within Hud), plus the exhibit panel layer (M3.1,
// unmodified — owned by another task/agent).
//
// The HUD is hidden (opacity 0, non-interactive) until the intro sequence
// finishes (`introPhase === 'done'`), via a CSS class toggle rather than
// unmounting, so its fade-in transition (see hud.css) can play.
export default function HudRoot() {
  const introPhase = useAppStore((s) => s.introPhase);
  const introDone = introPhase === 'done';

  return (
    <>
      <div className={`ta-hud${introDone ? '' : ' ta-hud--hidden'}`} style={hudVars()}>
        <Hud />
      </div>
      <ExhibitPanel />
    </>
  );
}
