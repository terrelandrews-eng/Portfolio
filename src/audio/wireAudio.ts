// Store-driven audio wiring (M3.4).
//
// ExhibitPanel.tsx (open/close) and EvidenceMenu.tsx/BriefingCard.tsx
// (dismissBriefing) are owned by other tasks, so instead of editing them
// to call playOpen/playClose/playConfirm directly, this module
// subscribes to useAppStore from the outside and derives sound events
// from the state transitions those components already cause. This is
// the pattern to extend if a future task needs another store-driven
// sound: add a comparison inside the subscribe callback below, don't
// reach back into the component that owns the state change.
//
// wireAudio() must be called exactly once — HudRoot.tsx does this in a
// useEffect with an empty dependency array — and returns an unsubscribe
// function for cleanup.
//
// Transitions wired (see src/audio/beeps.ts for the legacy semantics
// behind each sound):
//   panelId  null -> id            : playOpen()    (legacy open())
//   panelId  id   -> null          : playClose()   (legacy close())
//   briefingDismissed false->true  : playConfirm() (legacy dismissBriefing(),
//                                     the only place legacy's third beep fires)

import { useAppStore } from '../state/store';
import { playOpen, playClose, playConfirm } from './beeps';

export function wireAudio(): () => void {
  return useAppStore.subscribe((state, prevState) => {
    if (prevState.panelId === null && state.panelId !== null) {
      playOpen();
    } else if (prevState.panelId !== null && state.panelId === null) {
      playClose();
    }

    if (!prevState.briefingDismissed && state.briefingDismissed) {
      playConfirm();
    }
  });
}
