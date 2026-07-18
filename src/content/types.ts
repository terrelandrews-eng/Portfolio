// Shared content contract. Both the content data (exhibits.ts) and the
// app state (state/store.ts) build against these types. Orchestrator-owned:
// builders must not widen or rename these without flagging it for review.

export const EXHIBIT_IDS = [
  'window',
  'journal',
  'laptop',
  'phone',
  'board',
  'shelf',
  'photos',
  'radio',
  'mug',
] as const;

export type ExhibitId = (typeof EXHIBIT_IDS)[number];

export type ExhibitLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

export interface CameraTarget {
  /** World-space camera position when dollied to this exhibit */
  pos: [number, number, number];
  /** World-space point the camera looks at on arrival */
  lookAt: [number, number, number];
  /** Optional fov override during focus (default: scene fov) */
  fov?: number;
}

export interface ExhibitCore {
  id: ExhibitId;
  letter: ExhibitLetter;
  /** Short in-scene label, e.g. "THE WINDOW" */
  label: string;
  /** Panel header kicker, e.g. "EXHIBIT A — THE VIEW" */
  panelKicker: string;
  /** Panel title line */
  panelTitle: string;
  /** World-space marker anchor in room coordinates */
  anchor: [number, number, number];
  camera: CameraTarget;
}
