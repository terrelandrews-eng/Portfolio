// Global app store (zustand). This is the ONLY place interaction-boundary
// state lives — i.e. state that changes on discrete user/scene events
// (clicking an exhibit, dismissing a panel, toggling mute, ...).
//
// Rules for future builders:
// - Transient per-frame values (mouse NDC, camera scratch vectors, drag
//   deltas, etc.) must live in refs (or R3F's useFrame closures), NEVER
//   in this store. Pushing per-frame updates through zustand will thrash
//   React and defeat the point of refs.
// - Store updates happen at interaction boundaries only: a click, a
//   camera arrival, a menu toggle, a persisted-progress change. If you
//   find yourself calling a store setter inside useFrame, stop and use a
//   ref instead.
// - localStorage is written through directly inside the actions below
//   (write-through), not via a blanket store subscription — this keeps
//   persistence colocated with the action that causes it and avoids
//   writing on every unrelated state change.

import { create } from 'zustand';
import type { ExhibitId } from '../content/types';
import { storageKeys } from '../theme/tokens';

export type IntroPhase = 'hold' | 'flyin' | 'done';
export type QualityTier = 'high' | 'mobile' | 'reduced';

interface AppState {
  introPhase: IntroPhase;
  focusId: ExhibitId | null;
  panelId: ExhibitId | null;
  found: ExhibitId[];
  briefingDismissed: boolean;
  muted: boolean;
  menuOpen: boolean;
  qualityTier: QualityTier;

  skipIntro: () => void;
  setIntroPhase: (phase: IntroPhase) => void;
  openExhibit: (id: ExhibitId) => void;
  arriveAtExhibit: (id: ExhibitId) => void;
  closePanel: () => void;
  clearFocus: () => void;
  dismissBriefing: () => void;
  toggleMuted: () => void;
  toggleMenu: () => void;
  setQualityTier: (tier: QualityTier) => void;
  resetCase: () => void;
}

// --- localStorage helpers, guarded for storage-blocked environments
// (private browsing, disabled storage, SSR-less-but-hostile embeds). ---

function readFound(): ExhibitId[] {
  try {
    const raw = localStorage.getItem(storageKeys.found);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ExhibitId[]) : [];
  } catch {
    return [];
  }
}

function writeFound(found: ExhibitId[]): void {
  try {
    localStorage.setItem(storageKeys.found, JSON.stringify(found));
  } catch {
    // storage blocked/unavailable — progress simply won't persist
  }
}

function readBriefingDismissed(): boolean {
  try {
    return localStorage.getItem(storageKeys.briefingDismissed) === '1';
  } catch {
    return false;
  }
}

function writeBriefingDismissed(dismissed: boolean): void {
  try {
    localStorage.setItem(storageKeys.briefingDismissed, dismissed ? '1' : '');
  } catch {
    // storage blocked/unavailable
  }
}

function clearStorage(): void {
  try {
    localStorage.setItem(storageKeys.found, '[]');
    localStorage.setItem(storageKeys.briefingDismissed, '');
  } catch {
    // storage blocked/unavailable
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  // The intro sequence (M6.1) starts in 'hold' and is driven to 'done' by
  // IntroOverlay (timer path), skipIntro() (any pointer/key or window.__rig),
  // reduced-motion (fast static path), or a hard failsafe timeout. Every one
  // of those paths lands on 'done', so the page can never sit frozen here —
  // see the M2 note in the git history for why that guarantee matters.
  introPhase: 'hold',
  focusId: null,
  panelId: null,
  found: readFound(),
  briefingDismissed: readBriefingDismissed(),
  muted: false,
  menuOpen: false,
  qualityTier: 'high',

  skipIntro: () => set({ introPhase: 'done' }),

  setIntroPhase: (phase) => set({ introPhase: phase }),

  openExhibit: (id) => {
    if (get().focusId === id) return;
    set({ focusId: id });
  },

  arriveAtExhibit: (id) => {
    const { found } = get();
    const nextFound = found.includes(id) ? found : [...found, id];
    if (nextFound !== found) writeFound(nextFound);
    set({ panelId: id, found: nextFound });
  },

  // Clears the open panel only. The camera rig watches panelId and, once
  // it transitions to null, is responsible for calling clearFocus() to
  // release focusId (e.g. after a dolly-out animation completes).
  closePanel: () => set({ panelId: null }),

  clearFocus: () => set({ focusId: null }),

  dismissBriefing: () => {
    writeBriefingDismissed(true);
    set({ briefingDismissed: true });
  },

  toggleMuted: () => set((s) => ({ muted: !s.muted })),

  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),

  setQualityTier: (tier) => set({ qualityTier: tier }),

  resetCase: () => {
    clearStorage();
    set({ found: [], briefingDismissed: false, panelId: null, focusId: null });
  },
}));
