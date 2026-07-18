// Field-briefing paper card (M3.4), ported visually from
// legacy/Agent Office Ship.dc.html's BRIEFING CARD block (~lines
// 152-162): a slightly rotated paper card anchored bottom-left, with a
// kicker + "EYES ONLY" badge, briefing copy, and a dismiss button.
//
// Visibility mirrors legacy's `showBriefingCard` condition (~line 656),
// translated to this store's shape — legacy's `camTarget`/`openId`
// pair (its pre-M2 camera state machine) collapses to this store's
// single `panelId`, and legacy's `introPhase === 'card' || 'done'`
// collapses to just `'done'` since M3 has no 'card' phase yet:
//   introPhase === 'done' && !briefingDismissed && !panelId && found.length < 9
// The trailing `found.length < 9` matches legacy's `!allFound` — once
// the case is complete, DoneModal owns the overlay instead.
//
// Legacy chooses between two entrance animations via `briefAnim`: a
// "fly in from off-screen" right after the intro finishes, or a plain
// fade-up on a normal load where the intro already played. M6 owns that
// choreography; per the M3.4 spec this always does the simple fade-in
// for now, and respects prefers-reduced-motion (no animated entrance)
// via briefing.css.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { STRINGS } from '../content/strings';
import { colors, fonts, zIndex } from '../theme/tokens';
import './briefing.css';

// Local dismiss-animation duration — mirrors ExhibitPanel.tsx's own
// CLOSE_ANIM_MS pattern: the card fades out on the client BEFORE
// dismissBriefing() flips the store flag (which unmounts this
// component), so the fade has a frame to animate instead of the card
// just vanishing.
const DISMISS_ANIM_MS = 180;

const briefingVars = {
  '--ta-briefing-z': zIndex.hud,
  '--ta-briefing-paper': colors.paperBright,
  '--ta-briefing-ink': colors.ink,
  '--ta-briefing-stamp': colors.stampRed,
  '--ta-briefing-amber': colors.amber,
  '--ta-briefing-font': fonts.mono,
} as CSSProperties;

export default function BriefingCard() {
  const introPhase = useAppStore((s) => s.introPhase);
  const briefingDismissed = useAppStore((s) => s.briefingDismissed);
  const panelId = useAppStore((s) => s.panelId);
  const found = useAppStore((s) => s.found);
  const dismissBriefing = useAppStore((s) => s.dismissBriefing);

  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false); // guards double-fire (e.g. Enter + click)
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    []
  );

  const visible =
    introPhase === 'done' && !briefingDismissed && !panelId && found.length < 9;

  if (!visible) return null;

  const handleDismiss = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timeoutRef.current = window.setTimeout(() => {
      dismissBriefing();
    }, DISMISS_ANIM_MS);
  };

  return (
    <div
      className={`ta-briefing${closing ? ' is-closing' : ''}`}
      style={briefingVars}
    >
      <div className="ta-briefing__head">
        <div className="ta-briefing__kicker">{STRINGS.briefingCard.heading}</div>
        <div className="ta-briefing__badge">{STRINGS.briefingCard.eyesOnlyBadge}</div>
      </div>
      <p className="ta-briefing__body">{STRINGS.briefingCard.body}</p>
      <button type="button" className="ta-briefing__dismiss" onClick={handleDismiss}>
        {STRINGS.briefingCard.dismissButton}
      </button>
    </div>
  );
}
