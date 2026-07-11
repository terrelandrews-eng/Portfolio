// Non-exhibit copy, transcribed VERBATIM from the legacy authoring source
// (legacy/Agent Office Ship.dc.html): HUD chrome, briefing card, the
// completion modal, footer, and interaction hints. Exhibit-specific copy
// lives in exhibits.ts instead — this file is everything else.

export interface TopBarStrings {
  dossierBadge: string;
  /** Full case-file title as it reads in the source, incl. the highlighted name. */
  caseTitle: string;
  /** The trailing segment of caseTitle that renders in a different color ("T. ANDREWS"). */
  caseTitleHighlight: string;
  roleLine: string;
  stationLine: string;
  statusLabel: string;
  /** {{ caseStatus }} when not all 9 exhibits are found. */
  statusActive: string;
  /** {{ caseStatus }} once all 9 exhibits are found. */
  statusConfirmed: string;
  eyesOnlyStamp: string;
  evidenceLabel: string;
  evidenceTotal: number;
  menuHeading: string;
  soundOn: string;
  soundOff: string;
}

export interface FooterStrings {
  coords: string;
  evidenceLogLabel: string;
  fileNo: string;
  /** {{ footerHint }} while exhibits remain unfound. */
  hintActive: string;
  /** {{ footerHint }} once all 9 exhibits are found. */
  hintDone: string;
}

export interface PanHintStrings {
  /** Portrait-only swipe hint. */
  text: string;
}

export interface BriefingCardStrings {
  heading: string;
  eyesOnlyBadge: string;
  body: string;
  dismissButton: string;
}

export interface IdentityConfirmedStrings {
  stamp: string;
  /** Bolded name inside `paragraph1`. */
  subjectName: string;
  paragraph1: string;
  paragraph2: string;
  emailButton: string;
  linkedinButton: string;
  resetButton: string;
  /**
   * Not present in the legacy source (legacy resets immediately on click,
   * no confirm step). Added for M3.3's inline two-step reset row in
   * EvidenceMenu.tsx, which needs a confirm state instead of
   * window.confirm (would block the page). Author's copy, not a legacy port.
   */
  resetConfirm: string;
}

export interface PanelChromeStrings {
  closeButton: string;
}

export interface Strings {
  topBar: TopBarStrings;
  footer: FooterStrings;
  panHint: PanHintStrings;
  briefingCard: BriefingCardStrings;
  identityConfirmed: IdentityConfirmedStrings;
  panelChrome: PanelChromeStrings;
}

export const STRINGS: Strings = {
  topBar: {
    dossierBadge: 'DOSSIER',
    caseTitle: 'CASE FILE № 220 — T. ANDREWS',
    caseTitleHighlight: 'T. ANDREWS',
    roleLine: 'REVOPS & AI SYSTEMS ENGINEER',
    stationLine: 'STATION: ANTIGUA',
    statusLabel: 'STATUS:',
    statusActive: 'ACTIVE INVESTIGATION',
    statusConfirmed: 'IDENTITY CONFIRMED',
    eyesOnlyStamp: 'EYES ONLY',
    evidenceLabel: 'EVIDENCE',
    evidenceTotal: 9,
    menuHeading: 'EXHIBIT INDEX',
    soundOn: 'SOUND ON',
    soundOff: 'SOUND OFF',
  },
  footer: {
    coords: '17.0747° N, 61.7677° W ▪ FIELD OFFICE — DO NOT DISTURB',
    evidenceLogLabel: 'EVIDENCE LOG',
    fileNo: 'FILE NOIR-220',
    hintActive: 'CLICK A MARKER TO EXAMINE',
    hintDone: 'CASE CLOSED',
  },
  panHint: {
    text: '◂ SWIPE TO SEARCH THE ROOM ▸',
  },
  briefingCard: {
    heading: 'FIELD BRIEFING',
    eyesOnlyBadge: 'EYES ONLY',
    body: 'An operative has gone quiet in the Caribbean. This is his office. Nine objects in this room reveal who he is — open them all to confirm his identity.',
    dismissButton: 'UNDERSTOOD',
  },
  identityConfirmed: {
    stamp: 'IDENTITY CONFIRMED',
    subjectName: 'Terrel Andrews',
    paragraph1:
      'Subject: Terrel Andrews — RevOps & AI Systems Engineer. Builds revenue machinery, ships AI agents, solves puzzles for fun.',
    paragraph2: 'Case closed. Your move.',
    emailButton: 'EMAIL THE AGENT',
    linkedinButton: 'LINKEDIN',
    resetButton: 'RESET CASE',
    resetConfirm: 'CONFIRM RESET?',
  },
  panelChrome: {
    closeButton: '✕ CLOSE',
  },
};
