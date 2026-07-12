// IDENTITY CONFIRMED completion modal (M3.4), ported visually from
// legacy/Agent Office Ship.dc.html's IDENTITY CONFIRMED block (~lines
// 164-179): a centered paper card with a double-bordered stamp,
// congratulation copy, EMAIL/LINKEDIN action buttons, and a RESET CASE
// link.
//
// --- Show/persist logic, and where it deviates from legacy ---
//
// Legacy's `showDone` (~line 657) is:
//   allFound && !openId && !camTarget && !doneDismissed && introPhase==='done'
// `doneDismissed` is plain in-memory React-style state, initialized false
// on every load (~line 411) and NEVER persisted. That means legacy
// re-shows this modal on every single page load for as long as the case
// stays complete — closing it (the small ✕) only suppresses it until the
// next reload. That's naggy, and the M3.4 spec explicitly asks for
// better behavior: persist the "already shown" flag in sessionStorage
// (not localStorage) so a returning visitor whose case was already
// complete isn't nagged again, while a visitor who completes the case
// live in a fresh session still sees it once.
//
// sessionStorage alone isn't sufficient to express "already complete at
// load vs. completed live": a brand new tab has empty sessionStorage
// either way, so a plain "have I shown it this session" flag can't tell
// a returning-with-9-already visitor apart from someone who just found
// #9. So this component also tracks, via a ref set once and never
// re-derived except across a reset, whether `found` was ever observed
// below 9 during THIS component's lifetime. Only found reaching 9 after
// having been below 9 counts as a "live" completion worth showing the
// modal for automatically:
//   - page loads with found.length === 9 (already complete)  -> no auto-show
//   - found.length goes 8 -> 9 while the app is running       -> auto-show once
//   - resetCase() drops found back to 0                       -> re-arms both
//     the ref and the sessionStorage flag, so the next live completion
//     shows the modal again
//
// Also unlike legacy, this modal closes on Escape and on backdrop click
// (legacy's backdrop has no onClick at all, only the ✕) — added per the
// explicit M3.4 spec. The RESET CASE action, however, matches legacy
// exactly: a single click resets immediately, no confirm step (contrast
// with EvidenceMenu.tsx's two-click confirm, which strings.ts notes was
// added later specifically for that menu and has no legacy precedent).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { STRINGS } from '../content/strings';
import { CONTACT_EMAIL, LINKEDIN_URL } from '../content/exhibits';
import { colors, fonts, zIndex } from '../theme/tokens';
import './briefing.css';

const CLOSE_ANIM_MS = 200;
const DONE_SHOWN_KEY = 'ta-office-done-shown';

function readShown(): boolean {
  try {
    return sessionStorage.getItem(DONE_SHOWN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeShown(shown: boolean): void {
  try {
    if (shown) sessionStorage.setItem(DONE_SHOWN_KEY, '1');
    else sessionStorage.removeItem(DONE_SHOWN_KEY);
  } catch {
    // storage blocked/unavailable — flag simply won't persist
  }
}

const doneVars = {
  '--ta-done-z': zIndex.modal,
  '--ta-done-paper': colors.paperBright,
  '--ta-done-ink': colors.ink,
  '--ta-done-stamp': colors.stampRed,
  '--ta-done-amber': colors.amber,
  '--ta-done-font': fonts.mono,
  '--ta-done-backdrop-bg': 'rgba(11, 18, 21, 0.55)',
} as CSSProperties;

export default function DoneModal() {
  const found = useAppStore((s) => s.found);
  const panelId = useAppStore((s) => s.panelId);
  const introPhase = useAppStore((s) => s.introPhase);
  const resetCase = useAppStore((s) => s.resetCase);

  const allFound = found.length === 9;

  // Set once found is observed below 9; only THEN does a later 9 count
  // as a live completion. Starts false when the case is already complete
  // at mount (returning visitor) so the modal won't auto-show for them.
  const everIncompleteRef = useRef(!allFound);
  if (!allFound) everIncompleteRef.current = true;

  const [dismissed, setDismissed] = useState(() => readShown());
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  // Re-arm both the "shown" flag and the live-completion tracking
  // whenever the case is no longer complete (resetCase(), or found not
  // yet at 9 on a fresh case).
  useEffect(() => {
    if (!allFound) {
      writeShown(false);
      setDismissed(false);
    }
  }, [allFound]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    []
  );

  const show =
    allFound && everIncompleteRef.current && !dismissed && !panelId && introPhase === 'done';

  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (show) {
      closingRef.current = false;
      setClosing(false);
      closeBtnRef.current?.focus();
    }
  }, [show]);

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timeoutRef.current = window.setTimeout(() => {
      setDismissed(true);
      writeShown(true);
    }, CLOSE_ANIM_MS);
  };

  useEffect(() => {
    if (!show) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  const { identityConfirmed } = STRINGS;
  const nameIdx = identityConfirmed.paragraph1.indexOf(identityConfirmed.subjectName);
  const beforeName =
    nameIdx >= 0 ? identityConfirmed.paragraph1.slice(0, nameIdx) : identityConfirmed.paragraph1;
  const afterName =
    nameIdx >= 0
      ? identityConfirmed.paragraph1.slice(nameIdx + identityConfirmed.subjectName.length)
      : '';

  return (
    <div
      className={`ta-done-backdrop${closing ? ' is-closing' : ''}`}
      style={doneVars}
      onClick={requestClose}
    >
      <div
        className={`ta-done${closing ? ' is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={identityConfirmed.stamp}
      >
        <button
          ref={closeBtnRef}
          type="button"
          className="ta-done__dismiss"
          onClick={requestClose}
          aria-label={STRINGS.panelChrome.closeButton}
        >
          {'✕'}
        </button>
        <div className="ta-done__stamp">{identityConfirmed.stamp}</div>
        <p className="ta-done__paragraph">
          {nameIdx >= 0 ? (
            <>
              {beforeName}
              <b>{identityConfirmed.subjectName}</b>
              {afterName}
            </>
          ) : (
            identityConfirmed.paragraph1
          )}
        </p>
        <p className="ta-done__subparagraph">{identityConfirmed.paragraph2}</p>
        <div className="ta-done__actions">
          <a className="ta-done__action ta-done__action--solid" href={`mailto:${CONTACT_EMAIL}`}>
            {identityConfirmed.emailButton}
          </a>
          <a
            className="ta-done__action ta-done__action--outline"
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener"
          >
            {identityConfirmed.linkedinButton}
          </a>
          <button type="button" className="ta-done__reset" onClick={resetCase}>
            {identityConfirmed.resetButton}
          </button>
        </div>
      </div>
    </div>
  );
}
