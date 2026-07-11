// Design tokens for "Case File No. 220". Single source of truth for color,
// type, layering, and timing — components should import from here rather
// than hard-coding hex values or magic numbers.

export const colors = {
  // Base noir palette (as specified)
  bg: '#0B1215',
  amber: '#E8B54A',
  paper: '#EDE6D2',
  paperBright: '#F2ECDA',
  stampRed: '#B0402E',

  // Derived variants, kept within the same noir family
  bgMuted: '#141C20', // slightly lifted bg, for panels/cards sitting on bg
  ink: '#080D0F', // near-black, for deep shadow / text-on-paper accents
  amberMuted: '#A9843A', // dimmed amber for disabled/secondary accents
  amberBright: '#F7C866', // hot amber for hover/active highlights
  paperMuted: '#C9C0A8', // dimmed paper, for secondary text on dark bg
  stampRedMuted: '#7A2E22', // dimmed stamp red, for borders/dividers
} as const;

export const fonts = {
  mono: "'Courier Prime', 'Courier New', monospace",
} as const;

// Layering order, low to high. Keep gaps between tiers so intermediate
// layers can be inserted later without renumbering everything.
export const zIndex = {
  canvas: 0,
  hud: 100,
  panel: 200,
  modal: 300,
} as const;

// Timing constants. Values marked "placeholder" are approximations to be
// tuned once the actual camera rig / intro sequence exists (M2+).
export const timing = {
  panelStaggerMs: 60, // delay between successive panel-row reveals
  dollyDurationMs: 1400, // placeholder: camera dolly to an exhibit
  introHoldMs: 900, // placeholder: time spent in 'hold' phase before flying in
  introFlyinMs: 1800, // placeholder: duration of the 'flyin' phase
} as const;

// localStorage keys. MUST match the legacy build (legacy/Agent Office
// Ship.dc.html) exactly so returning visitors keep their progress:
//   localStorage.getItem('ta-office-found')     -> JSON array of found exhibit ids
//   localStorage.getItem('ta-office-briefing')  -> '1' when the briefing card was dismissed
export const storageKeys = {
  found: 'ta-office-found',
  briefingDismissed: 'ta-office-briefing',
} as const;
