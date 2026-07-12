import { useEffect } from 'react';
import { useAppStore } from '../state/store';
import Hud, { hudVars } from './Hud';
import ExhibitPanel from './ExhibitPanel';
import BriefingCard from './BriefingCard';
import DoneModal from './DoneModal';
import { wireAudio } from '../audio/wireAudio';
import './hud.css';

// Composition root for the case-file HUD (M3.3): top bar, footer strip,
// evidence tracker + dropdown (all in Hud.tsx / EvidenceMenu.tsx, the
// latter mounted from within Hud), plus the exhibit panel layer (M3.1,
// unmodified — owned by another task/agent), plus the field-briefing
// card and IDENTITY CONFIRMED completion modal (M3.4, BriefingCard.tsx /
// DoneModal.tsx — each is self-gating on the store and renders null
// when not applicable, so mounting them unconditionally here is safe).
//
// The HUD is hidden (opacity 0, non-interactive) until the intro sequence
// finishes (`introPhase === 'done'`), via a CSS class toggle rather than
// unmounting, so its fade-in transition (see hud.css) can play.
//
// wireAudio() (M3.4) is started once here, not from a component that
// could remount — see src/audio/wireAudio.ts for why this subscribes to
// the store from outside rather than being called from ExhibitPanel.tsx
// or BriefingCard.tsx directly.
export default function HudRoot() {
  const introPhase = useAppStore((s) => s.introPhase);
  const introDone = introPhase === 'done';

  useEffect(() => wireAudio(), []);

  return (
    <>
      <div className={`ta-hud${introDone ? '' : ' ta-hud--hidden'}`} style={hudVars()}>
        <Hud />
      </div>
      <ExhibitPanel />
      <BriefingCard />
      <DoneModal />
    </>
  );
}
