// Intro overlay (M6.1) — the near-black title-card curtain over the canvas
// and the state-machine driver for the whole intro sequence.
//
// This component owns TIMING and the DOM curtain; the CameraRig owns the
// camera during 'hold'/'flyin'. The two stay decoupled: both read the same
// phase off the store and the same durations from introTiming.ts, so there is
// no cross-component ref plumbing to get out of sync.
//
// Phase flow (see the report / introTiming.ts for the full diagram):
//   normal:   hold --holdMs--> flyin --flyinMs--> done
//   reduced:  hold --reducedHoldMs--> done            (no fly-in, opacity cut)
//   skip:     (pointerdown | keydown) at any point --> done  (via skipIntro)
//   failsafe: mount + failsafeMs --> done             (hard guarantee)
//
// Every path lands on 'done'. Once 'done', this renders null (curtain gone,
// listeners removed), the HUD/briefing take over, and the rig resumes idle.

import { useEffect, type CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, fonts, zIndex } from '../theme/tokens';
import { INTRO_TIMING } from './introTiming';
import './intro.css';

// Sits above every other layer (modal = 300) so nothing shows through the
// curtain while it's up. It unmounts at 'done', so it never blocks input.
const introVars = {
  '--ta-intro-z': zIndex.modal + 100,
  '--ta-intro-bg': colors.bg,
  '--ta-intro-amber': colors.amber,
  '--ta-intro-paper': colors.paper,
  '--ta-intro-stamp': colors.stampRed,
  '--ta-intro-font': fonts.mono,
  '--ta-intro-fade-ms': `${INTRO_TIMING.overlayFadeMs}ms`,
} as CSSProperties;

/** Force the intro to 'done' unless it already is. Idempotent. */
function forceDone(): void {
  if (useAppStore.getState().introPhase !== 'done') {
    useAppStore.getState().skipIntro();
  }
}

export default function IntroOverlay() {
  const introPhase = useAppStore((s) => s.introPhase);
  const qualityTier = useAppStore((s) => s.qualityTier);
  const prefersReduced = useReducedMotion();
  const reduced = prefersReduced || qualityTier === 'reduced';

  // ── Failsafe: independent of the sequence effect below. From mount, force
  // 'done' after failsafeMs no matter what state the sequence is in. ────────
  useEffect(() => {
    const id = window.setTimeout(forceDone, INTRO_TIMING.failsafeMs);
    return () => window.clearTimeout(id);
  }, []);

  // ── Skip: any pointerdown/keydown during hold/flyin cuts to 'done'.
  // skipIntro() is what window.__rig.goto() also calls, so the dev/test
  // harness keeps working. forceDone() no-ops once we're already done. ──────
  useEffect(() => {
    window.addEventListener('pointerdown', forceDone);
    window.addEventListener('keydown', forceDone);
    return () => {
      window.removeEventListener('pointerdown', forceDone);
      window.removeEventListener('keydown', forceDone);
    };
  }, []);

  // ── Sequence driver: schedules the phase transitions. Re-runs if `reduced`
  // flips mid-intro; always tears its timers down on cleanup. ───────────────
  useEffect(() => {
    if (useAppStore.getState().introPhase === 'done') return;

    const timers: number[] = [];
    if (reduced) {
      // Static hold, then straight to done (no fly-in, no continuous anim).
      timers.push(window.setTimeout(forceDone, INTRO_TIMING.reducedHoldMs));
    } else {
      // hold -> flyin. The rig now fires 'flyin' -> 'done' itself, when the
      // fly-in flight actually lands (frame-clock driven), instead of a blind
      // wall-clock timer here — so the curtain and camera can never desync if
      // frames stall during the intro.
      timers.push(
        window.setTimeout(() => {
          const st = useAppStore.getState();
          if (st.introPhase === 'hold') st.setIntroPhase('flyin');
        }, INTRO_TIMING.holdMs),
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduced]);

  if (introPhase === 'done') return null;

  // Non-reduced: the whole curtain fades out over overlayFadeMs once we enter
  // 'flyin'. Reduced: no fade class — it's an opacity cut when we unmount.
  const fading = introPhase === 'flyin' && !reduced;
  const className =
    'ta-intro' +
    (fading ? ' is-fading' : '') +
    (reduced ? ' ta-intro--reduced' : '');

  return (
    <div className={className} style={introVars} aria-hidden="true">
      <div className="ta-intro__card">
        <div className="ta-intro__stamp">{STAMP}</div>
        <div className="ta-intro__title">
          {TITLE_LEAD} <span className="ta-intro__num">{TITLE_NUM}</span>
          <span className="ta-intro__caret" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

// Intro-only copy. Mirrors the HUD's case title (strings.ts) but the intro is
// a title treatment, not chrome, so it keeps its own minimal literals here.
const STAMP = 'EYES ONLY';
const TITLE_LEAD = 'CASE FILE';
const TITLE_NUM = '№ 220';
