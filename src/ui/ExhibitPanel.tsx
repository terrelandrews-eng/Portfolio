// Exhibit panel chrome (M3.1). Watches `panelId` and renders the
// case-file paper panel over a dimmed/blurred backdrop, ported visually
// from legacy/Agent Office Ship.dc.html's .ta-panel* rules and markup.
//
// Body content is generic for M3.1 — see panels/GenericContent.tsx.
// Per-exhibit renderers land in a later task.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { EXHIBITS_BY_ID } from '../content/exhibits';
import { STRINGS } from '../content/strings';
import { colors, fonts, zIndex } from '../theme/tokens';
import GenericContent from './panels/GenericContent';
import './panels.css';

// Local close-animation duration. The panel fades out on the client
// BEFORE closePanel() clears the store, so the camera rig's return dolly
// starts as the paper is already lifting rather than snapping away.
const CLOSE_ANIM_MS = 180;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// CSS custom properties threaded from theme/tokens.ts into panels.css, so
// the stylesheet has no hard-coded color/z-index values of its own.
const panelVars = {
  '--ta-panel-z': zIndex.panel,
  '--ta-panel-paper': colors.paperBright,
  '--ta-panel-ink': colors.ink,
  '--ta-panel-stamp': colors.stampRed,
  '--ta-panel-amber': colors.amber,
  '--ta-panel-font': fonts.mono,
  '--ta-panel-backdrop-bg': hexToRgba(colors.bg, 0.62),
} as CSSProperties;

export default function ExhibitPanel() {
  const panelId = useAppStore((s) => s.panelId);
  const closePanel = useAppStore((s) => s.closePanel);

  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false); // guards double-fire (e.g. ESC + backdrop click)
  const closeTimeoutRef = useRef<number | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const exhibit = panelId ? EXHIBITS_BY_ID[panelId] : null;

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      closePanel();
    }, CLOSE_ANIM_MS);
  };

  // Reset local closing state whenever a new panel opens, and clean up
  // any pending close timeout on unmount.
  useEffect(() => {
    if (panelId) {
      closingRef.current = false;
      setClosing(false);
    }
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [panelId]);

  // Move focus into the panel on open, and wire ESC to close.
  useEffect(() => {
    if (!panelId) return;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId]);

  if (!exhibit) return null;

  return (
    <div
      className={`ta-panel-backdrop${closing ? ' is-closing' : ''}`}
      style={panelVars}
      onClick={requestClose}
    >
      <div
        className={`ta-panel${closing ? ' is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={exhibit.panelTitle}
      >
        <button
          ref={closeBtnRef}
          type="button"
          className="ta-panel__close"
          onClick={requestClose}
        >
          {STRINGS.panelChrome.closeButton}
        </button>
        <div className="ta-panel__content">
          <div className="ta-panel__kicker">{exhibit.panelKicker}</div>
          <div className="ta-panel__title">{exhibit.panelTitle}</div>
          <div className="ta-panel__divider" />
          <div className="ta-panel__body">
            <GenericContent content={exhibit.content} />
          </div>
        </div>
      </div>
    </div>
  );
}
