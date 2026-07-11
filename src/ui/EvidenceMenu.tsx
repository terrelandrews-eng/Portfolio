// Evidence dropdown menu (M3.3). Ported visually from
// legacy/Agent Office Ship.dc.html's EVIDENCE dropdown (~lines 118-132):
// a paper-dark card anchored to the evidence tracker, listing every
// exhibit by letter + label with a found tick, plus a RESET CASE row.
//
// The legacy source resets immediately on click (`onClick="{{ resetCase
// }}"`, ~line 175, inside a different modal). Here the reset row is a
// simple inline two-step confirm instead of window.confirm (which would
// block the page): first click arms it ("CONFIRM RESET?"), second click
// resets, and blur/escape cancels back to the normal label.

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../state/store';
import { EXHIBITS } from '../content/exhibits';
import { STRINGS } from '../content/strings';

export default function EvidenceMenu() {
  const menuOpen = useAppStore((s) => s.menuOpen);
  const toggleMenu = useAppStore((s) => s.toggleMenu);
  const found = useAppStore((s) => s.found);
  const openExhibit = useAppStore((s) => s.openExhibit);
  const resetCase = useAppStore((s) => s.resetCase);

  const [confirmingReset, setConfirmingReset] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset the confirm-arm state whenever the menu itself closes.
  useEffect(() => {
    if (!menuOpen) setConfirmingReset(false);
  }, [menuOpen]);

  // ESC cancels an armed reset confirm first; a second ESC (or a first one
  // when nothing is armed) closes the menu. Deliberately NOT listening for
  // outside pointerdown here — the toggle button that opens/closes this
  // menu lives in Hud.tsx as a sibling, and a document-level pointerdown
  // handler would race its own onClick (close-on-outside-click firing on
  // pointerdown, then the toggle's onClick re-opening it on the same
  // gesture). Escape and the explicit item/reset actions are enough.
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmingReset) {
        setConfirmingReset(false);
        return;
      }
      toggleMenu();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, confirmingReset]);

  if (!menuOpen) return null;

  const handleResetClick = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    resetCase();
    setConfirmingReset(false);
  };

  const handleResetBlur = () => {
    setConfirmingReset(false);
  };

  return (
    <div className="ta-evidence-menu" role="menu" ref={menuRef}>
      <div className="ta-evidence-menu__heading">{STRINGS.topBar.menuHeading}</div>
      {EXHIBITS.map((exhibit) => {
        const isFound = found.includes(exhibit.id);
        return (
          <button
            key={exhibit.id}
            type="button"
            role="menuitem"
            className="ta-evidence-menu__item"
            onClick={() => openExhibit(exhibit.id)}
          >
            <span
              className={`ta-evidence-menu__mark${
                isFound ? ' ta-evidence-menu__mark--found' : ' ta-evidence-menu__mark--unfound'
              }`}
            >
              {isFound ? '✓' : '·'}
            </span>
            <span className="ta-evidence-menu__letter">{exhibit.letter}</span>
            <span className="ta-evidence-menu__label">{exhibit.label}</span>
          </button>
        );
      })}
      <div className="ta-evidence-menu__divider" />
      <button
        type="button"
        role="menuitem"
        className={`ta-evidence-menu__reset${confirmingReset ? ' ta-evidence-menu__reset--confirm' : ''}`}
        onClick={handleResetClick}
        onBlur={handleResetBlur}
      >
        {confirmingReset ? STRINGS.identityConfirmed.resetConfirm : STRINGS.identityConfirmed.resetButton}
      </button>
    </div>
  );
}
