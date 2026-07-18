import { useEffect, useState } from 'react';
import { useAppStore } from '../state/store';
import Hud, { hudVars } from './Hud';
import ExhibitPanel from './ExhibitPanel';
import BriefingCard from './BriefingCard';
import DoneModal from './DoneModal';
import { wireAudio } from '../audio/wireAudio';
import { INTRO_TIMING } from './introTiming';
import './hud.css';

// Composition root for the case-file HUD (M3.3): top bar, footer strip,
// evidence tracker + dropdown (all in Hud.tsx / EvidenceMenu.tsx, the
// latter mounted from within Hud), plus the exhibit panel layer (M3.1,
// unmodified — owned by another task/agent), plus the field-briefing
// card and IDENTITY CONFIRMED completion modal (M3.4, BriefingCard.tsx /
// DoneModal.tsx — each is self-gating on the store and renders null
// when not applicable, so mounting them unconditionally here is safe).
//
// The HUD is hidden (opacity 0, non-interactive) during the intro, then
// fades in (CSS class toggle, not unmount, so hud.css's opacity transition
// plays). It reveals on the last beat of the fly-in — hudFadeLeadMs before
// the flyin->done flip — so the chrome is settling in as the camera lands.
// It ALSO reveals unconditionally on `introPhase === 'done'`, which is what
// makes every non-timer path (skip, reduced motion, failsafe) show the HUD;
// that guarantee is the guard against the M2 "frozen page, hidden HUD" bug.
//
// wireAudio() (M3.4) is started once here, not from a component that
// could remount — see src/audio/wireAudio.ts for why this subscribes to
// the store from outside rather than being called from ExhibitPanel.tsx
// or BriefingCard.tsx directly.
export default function HudRoot() {
  const introPhase = useAppStore((s) => s.introPhase);
  const [hudRevealed, setHudRevealed] = useState(introPhase === 'done');

  useEffect(() => wireAudio(), []);

  // Reveal logic: instant on 'done' (skip/reduced/failsafe all pass through
  // 'done'); on the fly-in tail via a self-contained timer. Kept hidden in
  // 'hold'. Cleaning up the timer on each phase change keeps it leak-free.
  useEffect(() => {
    if (introPhase === 'done') {
      setHudRevealed(true);
      return;
    }
    if (introPhase === 'flyin') {
      const lead = Math.max(0, INTRO_TIMING.flyinMs - INTRO_TIMING.hudFadeLeadMs);
      const id = window.setTimeout(() => setHudRevealed(true), lead);
      return () => window.clearTimeout(id);
    }
    setHudRevealed(false); // 'hold'
  }, [introPhase]);

  return (
    <>
      <div className={`ta-hud${hudRevealed ? '' : ' ta-hud--hidden'}`} style={hudVars()}>
        <Hud />
      </div>
      <ExhibitPanel />
      <BriefingCard />
      <DoneModal />
    </>
  );
}
