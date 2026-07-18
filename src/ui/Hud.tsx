// Top bar + footer strip chrome (M3.3). Ported visually from
// legacy/Agent Office Ship.dc.html's TOP BAR (~lines 105-135) and FOOTER
// STRIP (~lines 137-150) blocks. The legacy footer's plain found/unfound
// bars are upgraded here to per-exhibit letter chips (A-I) per the M3.3
// spec, and are directly clickable (openExhibit) in addition to the
// EVIDENCE n/9 toggle that opens the full dropdown (EvidenceMenu.tsx).
//
// All copy comes from content/strings.ts and content/exhibits.ts — no
// literal strings live here.

import type { CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { EXHIBITS } from '../content/exhibits';
import { STRINGS } from '../content/strings';
import { colors } from '../theme/tokens';
import EvidenceMenu from './EvidenceMenu';

export default function Hud() {
  const found = useAppStore((s) => s.found);
  const muted = useAppStore((s) => s.muted);
  const toggleMuted = useAppStore((s) => s.toggleMuted);
  const menuOpen = useAppStore((s) => s.menuOpen);
  const toggleMenu = useAppStore((s) => s.toggleMenu);
  const openExhibit = useAppStore((s) => s.openExhibit);

  const total = STRINGS.topBar.evidenceTotal;
  const foundCount = found.length;
  const allFound = foundCount >= total;

  const { topBar, footer } = STRINGS;

  return (
    <>
      <div className="ta-hud__topbar">
        <div className="ta-hud__topbar-left">
          <div>
            <div className="ta-hud__title-row">
              <span className="ta-hud__dossier-badge">{topBar.dossierBadge}</span>
              <span className="ta-hud__title">
                {topBar.caseTitle.replace(topBar.caseTitleHighlight, '').trimEnd()}{' '}
                <span className="ta-hud__title-highlight">{topBar.caseTitleHighlight}</span>
              </span>
            </div>
            <div className="ta-hud__meta-line">
              {topBar.roleLine} <span className="ta-hud__meta-sep">▪</span> {topBar.stationLine}{' '}
              <span className="ta-hud__meta-sep">▪</span> {topBar.statusLabel}{' '}
              <span className="ta-hud__status-value">
                {allFound ? topBar.statusConfirmed : topBar.statusActive}
              </span>
            </div>
            <div className="ta-hud__title-underline" />
          </div>
          <div className="ta-hud__stamp">{topBar.eyesOnlyStamp}</div>
        </div>
        <div className="ta-hud__topbar-right">
          <button type="button" className="ta-hud__sound-btn" onClick={toggleMuted}>
            {muted ? topBar.soundOff : topBar.soundOn}
          </button>
        </div>
      </div>

      <div className="ta-hud__footer">
        <div className="ta-hud__coords">{footer.coords}</div>

        <div className="ta-hud__evidence-group">
          <button
            type="button"
            className="ta-hud__evidence-toggle"
            onClick={toggleMenu}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            {topBar.evidenceLabel}{' '}
            <span className="ta-hud__evidence-count">
              {foundCount}/{total}
            </span>
            <span className="ta-hud__evidence-caret">{menuOpen ? '▲' : '▼'}</span>
          </button>
          <div className="ta-hud__chip-row">
            {EXHIBITS.map((exhibit) => {
              const isFound = found.includes(exhibit.id);
              return (
                <button
                  key={exhibit.id}
                  type="button"
                  className={`ta-hud__chip${isFound ? ' ta-hud__chip--found' : ''}`}
                  onClick={() => openExhibit(exhibit.id)}
                  aria-label={exhibit.label}
                  title={exhibit.label}
                >
                  {isFound ? '✓' : exhibit.letter}
                </button>
              );
            })}
          </div>
          <EvidenceMenu />
        </div>

        <div className="ta-hud__fileno">
          {footer.fileNo} <span className="ta-hud__meta-sep">▪</span>{' '}
          {allFound ? footer.hintDone : footer.hintActive}
        </div>
      </div>
    </>
  );
}

// Threaded CSS custom properties, exported for HudRoot to spread onto the
// container so hud.css stays free of hard-coded hex values.
export function hudVars(): CSSProperties {
  return {
    '--ta-hud-amber': colors.amber,
    '--ta-hud-paper': colors.paper,
    '--ta-hud-stamp': colors.stampRed,
    '--ta-hud-ink': colors.ink,
  } as CSSProperties;
}
