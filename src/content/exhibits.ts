// Exhibit copy, transcribed VERBATIM from the legacy authoring source
// (legacy/Agent Office Ship.dc.html). Do not paraphrase or "improve" the
// copy here — this file is the single source of truth for exhibit content
// consumed by the 3D rebuild's panel UI.
//
// Identity map (fixed): A=window, B=journal, C=laptop, D=phone, E=board,
// F=shelf, G=photos, H=radio, I=mug.

import type { ExhibitCore, ExhibitId } from './types';

// --- Resume asset path -----------------------------------------------
// Vite-base-relative path to the downloadable resume, placed by M1.3's
// asset-extraction step at public/assets/Terrel-Andrews-Resume-2026.docx.
const RESUME_ASSET_PATH = 'assets/Terrel-Andrews-Resume-2026.docx';
export const RESUME_HREF = import.meta.env.BASE_URL + RESUME_ASSET_PATH;

// Known-correct contact info. The legacy source Cloudflare-obfuscates the
// email (data-cfemail) — do NOT attempt to decode that by eye; this is the
// verified real address (double "d" is correct: terreldandrews, not
// terrelandrews).
export const CONTACT_EMAIL = 'terreldandrews@gmail.com';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/terrel-andrews/';
export const LINKEDIN_HANDLE = '/in/terrel-andrews';

// --- ExhibitContent discriminated union --------------------------------
// One variant per exhibit's actual content shape in the source.

export interface ParagraphsContent {
  kind: 'paragraphs';
  image?: { src: string; alt: string };
  paragraphs: string[];
}

export interface ResumeAchievement {
  text: string;
}

export interface ResumePosting {
  title: string;
  dateRange: string;
  description: string;
}

export interface ResumeContent {
  kind: 'resume';
  name: string;
  title: string;
  summary: string;
  resumeHref: string;
  resumeDownloadName: string;
  resumeLabel: string;
  achievementsHeading: string;
  achievements: string[];
  postingsHeading: string;
  postings: ResumePosting[];
  trainingHeading: string;
  training: string;
}

export interface Project {
  number: string;
  title: string;
  tag: string;
  body: string;
  /** Optional standout-metric line, e.g. "▮ FULL PAGE AUDIT IN UNDER 20 SECONDS" */
  highlight?: string;
}

export interface ProjectsContent {
  kind: 'projects';
  terminalLine: string;
  projects: Project[];
}

export interface ContactContent {
  kind: 'contact';
  intro: string;
  email: string;
  emailLabel: string;
  linkedinUrl: string;
  linkedinHandle: string;
  linkedinLabel: string;
}

export interface PinboardCard {
  heading: string;
  lines: string[];
}

export interface PinboardContent {
  kind: 'pinboard';
  subheading: string;
  cards: PinboardCard[];
}

export interface CredentialsContent {
  kind: 'credentials';
  certsHeading: string;
  certs: string[];
  skillsHeading: string;
  skills: string[];
}

export interface Polaroid {
  caption: string;
}

export interface PhotosContent {
  kind: 'photos';
  /** Shared placeholder stamp shown on each polaroid in the legacy source ("CLASSIFIED") */
  placeholderStamp: string;
  polaroids: Polaroid[];
  fieldNotesHeading: string;
  fieldNotes: string[];
}

export interface RadioContent {
  kind: 'radio';
  transmissionLabel: string;
  staticGlyphs: string;
  transmissionNote: string;
  paragraph: string;
}

export interface MugContent {
  kind: 'mug';
  stamp: string;
  paragraph: string;
}

export type ExhibitContent =
  | ParagraphsContent
  | ResumeContent
  | ProjectsContent
  | ContactContent
  | PinboardContent
  | CredentialsContent
  | PhotosContent
  | RadioContent
  | MugContent;

// --- EXHIBITS ------------------------------------------------------------
// Anchors and camera targets are room-space meters, +Z toward viewer.
// Camera seat: (0, 1.45, 2.3). Each `camera.pos` is computed by taking the
// normalized direction from the exhibit anchor toward the seat, backing off
// along it by a fixed distance (desk items ~0.55m, wall items ~0.9m), then
// overriding pos.y to anchor.y + 0.05. `camera.lookAt` is the anchor itself.
// These are first-pass values — literal numbers below are TUNABLE in M2.

export const EXHIBITS: Array<ExhibitCore & { content: ExhibitContent }> = [
  // A — WINDOW (wall item, backoff 0.9m)
  {
    id: 'window',
    letter: 'A',
    label: 'THE WINDOW',
    panelKicker: 'EXHIBIT A — THE VIEW',
    panelTitle: 'STATION: ANTIGUA & BARBUDA',
    anchor: [0.9, 1.7, -2.55],
    camera: {
      pos: [0.736, 1.75, -1.666],
      lookAt: [0.9, 1.7, -2.55],
    },
    content: {
      kind: 'paragraphs',
      image: { src: 'window-view.png', alt: 'The view from the office window' },
      paragraphs: [
        '365 beaches — one for every day of the year. This is the view the agent chose when he "retired." The laptop on the desk suggests otherwise.',
      ],
    },
  },

  // B — JOURNAL (desk item, backoff 0.55m)
  {
    id: 'journal',
    letter: 'B',
    label: 'THE JOURNAL',
    panelKicker: 'EXHIBIT B — THE JOURNAL',
    panelTitle: 'SERVICE RECORD',
    anchor: [-0.35, 0.78, -1.05],
    camera: {
      pos: [-0.32, 1.22, -0.62],
      lookAt: [-0.35, 0.8, -1.05],
    },
    content: {
      kind: 'resume',
      name: 'TERREL ANDREWS',
      title: 'REVOPS & AI SYSTEMS ENGINEER',
      summary:
        'Director-level Revenue Operations & AI systems leader with 8+ years building the machinery behind revenue: CRM architecture, marketing automation at enterprise scale, and custom AI agents that remove human bottlenecks. Led full-platform migrations, owns a $1M Martech budget, and ships tooling that QAs, filters, routes — and makes calls.',
      resumeHref: RESUME_HREF,
      resumeDownloadName: 'Terrel Andrews Resume 2026.docx',
      resumeLabel: 'DOWNLOAD RESUME ↓',
      achievementsHeading: 'KEY ACHIEVEMENTS',
      achievements: [
        'Led full migration to Salesforce Marketing Cloud at Goldco — enterprise-scale automation supporting billion-dollar revenue operations.',
        'Owns and optimized a $1M annual Martech budget — renegotiated vendor contracts, consolidated tools, improved performance.',
        'Built the executive reporting framework in Domo + Salesforce that shapes revenue strategy and forecasting.',
        'Standardized automation & CRM process across multiple organizations — campaign efficiency, lead conversion, cross-team alignment.',
      ],
      postingsHeading: 'POSTINGS',
      postings: [
        {
          title: 'SR. MARKETING AUTOMATION MANAGER — Goldco',
          dateRange: 'May 2021 – Present',
          description:
            'Directed the SFMC migration end-to-end. Manages the $1M Martech budget. Leads Marketing × Sales × IT alignment on lead gen and nurture. Governs the stack — Salesforce, HubSpot, Zapier, GTM, custom builds.',
        },
        {
          title: 'MARTECH CONTRACTOR — LAIRE Digital',
          dateRange: 'May 2021 – Jun 2022',
          description:
            'Advised client leadership on Martech strategy, CRM adoption and automation; designed scalable HubSpot/Salesforce/Zapier processes; ran training and change management.',
        },
        {
          title: 'MARTECH SPECIALIST — LAIRE Digital',
          dateRange: 'Jul 2020 – May 2021',
          description:
            'Implemented HubSpot and Salesforce automation frameworks; led cross-channel integration projects for campaign and journey tracking.',
        },
        {
          title: 'EARLY CAREER — Intelichart · Ironpaper',
          dateRange: '2017 – 2020',
          description:
            'CRM migrations, Salesforce dashboards, multi-channel campaigns in HubSpot and Mailchimp, pipeline visibility with sales leadership.',
        },
      ],
      trainingHeading: 'TRAINING',
      training: 'B.S. Business Administration, Marketing — University of North Carolina at Charlotte',
    },
  },

  // C — LAPTOP (desk item, backoff 0.55m)
  {
    id: 'laptop',
    letter: 'C',
    label: 'THE COMPUTER',
    panelKicker: 'EXHIBIT C — THE COMPUTER',
    panelTitle: 'FIELD OPERATIONS',
    anchor: [0.35, 0.78, -1.25],
    camera: {
      pos: [0.33, 1.04, -0.73],
      lookAt: [0.35, 0.9, -1.25],
    },
    content: {
      kind: 'projects',
      terminalLine: '> decrypting case files… 5 found_',
      projects: [
        {
          number: '01',
          title: 'LANDING PAGE QC TOOL',
          tag: 'AI · CLAUDE · UNBOUNCE API',
          body: 'An AI agent that audits landing pages end-to-end: scrapes Unbounce back-ends via API, validates consent language, form field names, webhooks, pixel placement and favicon; submits a live test lead via JS and confirms a 200 webhook response; runs a Google PageSpeed check; logs pass/fail to Google Sheets via Apps Script.',
          highlight: '▮ FULL PAGE AUDIT IN UNDER 20 SECONDS',
        },
        {
          number: '02',
          title: 'AI OUTBOUND VOICE AGENT',
          tag: 'AI · VOICE · SALES OPS',
          body: 'Call data showed 85% of connections happen within the first 5 attempts. Deployed an AI voice agent to work attempts 6–10, freeing reps for high-probability outreach.',
          highlight: '▮ FREED ~50% OF SALES ORG CAPACITY — VOLUME, CONNECTS & REVENUE HELD',
        },
        {
          number: '03',
          title: 'QA FORM-FILL CHROME EXTENSION',
          tag: 'JS · SALESFORCE',
          body: 'Auto-fills and submits test forms across landing pages, then verifies each lead record lands correctly in Salesforce — replacing a manual, high-volume QA process.',
        },
        {
          number: '04',
          title: 'LEAD FILTERING SYSTEM',
          tag: 'DATA INTEGRITY',
          body: 'Filters and qualifies leads before they ever hit Salesforce — protecting data integrity at the system-of-record level.',
        },
        {
          number: '05',
          title: 'LEAD ROUTING REDESIGN',
          tag: 'REVOPS STRATEGY',
          body: 'Eliminated lead scoring in favor of smarter routing — the best leads go to the most qualified reps based on fit and behavior, not a score.',
        },
      ],
    },
  },

  // D — PHONE (desk item, backoff 0.55m)
  {
    id: 'phone',
    letter: 'D',
    label: 'THE PHONE',
    panelKicker: 'EXHIBIT D — THE PHONE',
    panelTitle: 'SECURE LINE',
    anchor: [0.85, 0.78, -0.95],
    camera: {
      pos: [0.6, 1.12, -0.5],
      lookAt: [0.85, 0.86, -0.95],
    },
    content: {
      kind: 'contact',
      intro: 'The line is open. He actually answers.',
      email: CONTACT_EMAIL,
      emailLabel: 'EMAIL',
      linkedinUrl: LINKEDIN_URL,
      linkedinHandle: LINKEDIN_HANDLE,
      linkedinLabel: 'LINKEDIN',
    },
  },

  // E — BOARD (wall item, backoff 0.9m)
  {
    id: 'board',
    letter: 'E',
    label: 'THE BOARD',
    panelKicker: 'EXHIBIT E — THE BOARD',
    panelTitle: 'THE NETWORK',
    anchor: [-1.5, 1.75, -2.55],
    camera: {
      pos: [-1.235, 1.8, -1.692],
      lookAt: [-1.5, 1.75, -2.55],
    },
    content: {
      kind: 'pinboard',
      subheading: 'Every system he runs, and how they connect.',
      cards: [
        { heading: 'SYSTEM OF RECORD', lines: ['Salesforce', 'HubSpot · Marketo'] },
        {
          heading: 'AUTOMATION',
          lines: ['Salesforce Marketing Cloud', 'Marketo · HubSpot · Zapier'],
        },
        { heading: 'INTELLIGENCE', lines: ['Domo · Google Analytics', 'GTM'] },
        {
          heading: 'AI FIELD KIT',
          lines: ['Claude · AI voice agents', 'JavaScript · Node.js · Python', 'APIs · GitHub · Apps Script'],
        },
      ],
    },
  },

  // F — SHELF (wall/furniture item, backoff 0.9m)
  {
    id: 'shelf',
    letter: 'F',
    label: 'THE BOOKSHELF',
    panelKicker: 'EXHIBIT F — THE BOOKSHELF',
    panelTitle: 'CREDENTIALS',
    anchor: [-3.0, 1.2, -1.2],
    camera: {
      pos: [-2.2, 1.5, -0.85],
      lookAt: [-3.0, 1.35, -1.2],
    },
    content: {
      kind: 'credentials',
      certsHeading: 'CERTIFICATIONS',
      certs: [
        'HubSpot — Inbound Sales · Inbound Marketing · Marketing Software · Sales Software',
        'Google Analytics',
        'Salesforce Trailhead — Ranger status',
        'Salesforce Administrator — in progress',
      ],
      skillsHeading: 'FIELD SKILLS',
      skills: [
        'CRM migration',
        '$1M Martech budget ownership',
        'Lifecycle automation',
        'Lead routing & filtering',
        'Executive reporting',
        'Vendor negotiation',
        'Change management',
        'Cross-functional leadership',
      ],
    },
  },

  // G — PHOTOS (wall item, backoff 0.9m)
  {
    id: 'photos',
    letter: 'G',
    label: 'THE PHOTOS',
    panelKicker: 'EXHIBIT G — THE PHOTOS',
    panelTitle: 'KNOWN ASSOCIATES & TRAITS',
    anchor: [2.9, 1.9, -0.8],
    camera: {
      pos: [2.289, 1.95, -0.146],
      lookAt: [2.9, 1.9, -0.8],
    },
    content: {
      kind: 'photos',
      placeholderStamp: 'CLASSIFIED',
      polaroids: [
        { caption: 'The household unit — wife + two junior operatives.' },
        { caption: 'Allegiance: Pittsburgh Steelers. Non-negotiable.' },
        { caption: 'Origin: Pittsburgh, PA.' },
        { caption: 'Latest build. He works with his hands.' },
      ],
      fieldNotesHeading: 'FIELD NOTES',
      fieldNotes: [
        "Escape rooms and complex lock boxes — he solves puzzles for sport. (You're inside one of his right now.)",
        'Builds with his hands: LEGO, projects, whatever needs assembling.',
        'Keeps plants. All alive, allegedly.',
        'Trained at UNC Charlotte. Self-described renaissance man — many seemingly unconnected interests, one very connected brain.',
      ],
    },
  },

  // H — RADIO (desk item, backoff 0.55m)
  {
    id: 'radio',
    letter: 'H',
    label: 'THE RADIO',
    panelKicker: 'EXHIBIT H — THE RADIO',
    panelTitle: "FREQ 94.7 — THE AGENT'S FREQUENCY",
    anchor: [1.05, 0.78, -1.35],
    camera: {
      pos: [0.82, 1.1, -0.83],
      lookAt: [1.05, 0.87, -1.35],
    },
    content: {
      kind: 'radio',
      transmissionLabel: 'TRANSMISSION INTERCEPTED…',
      staticGlyphs: '▂▄▆▂▁▅▃▇▂▄▁▆▃▂▅▁',
      transmissionNote: 'Mostly static. The playlist remains classified.',
      paragraph:
        "The dial never stays on one station — neither does he. Ask him what's playing; the man has range.",
    },
  },

  // I — MUG (desk item, backoff 0.55m)
  {
    id: 'mug',
    letter: 'I',
    label: 'THE MUG',
    panelKicker: 'EXHIBIT I — THE MUG',
    panelTitle: 'STANDARD ISSUE',
    anchor: [1.12, 0.78, -1.0],
    camera: {
      pos: [1.0, 1.08, -0.55],
      lookAt: [1.12, 0.84, -1.0],
    },
    content: {
      kind: 'mug',
      stamp: '#1 DAD',
      paragraph:
        "Issued by the two junior operatives at home. Evidence suggests the coffee rarely survives to lukewarm — there's always another mission (usually the school run).",
    },
  },
];

// Convenience lookup, keyed by ExhibitId.
export const EXHIBITS_BY_ID: Record<ExhibitId, ExhibitCore & { content: ExhibitContent }> =
  Object.fromEntries(EXHIBITS.map((e) => [e.id, e])) as Record<ExhibitId, ExhibitCore & { content: ExhibitContent }>;
