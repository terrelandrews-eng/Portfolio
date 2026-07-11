# CLAUDE.md — Portfolio

## What this is

Terrel Andrews' portfolio site. Concept: "Case File No. 220," a noir
detective frame. The visitor explores a beach-shack office in Antigua and
opens 9 evidence exhibits (A through I) to "confirm the operative's
identity":

- A — window view
- B — journal / resume
- C — computer / projects
- D — phone / contact
- E — corkboard / tech stack
- F — bookshelf / credentials
- G — photos
- H — radio
- I — mug

Live at https://terrelandrews-eng.github.io/Portfolio/ via GitHub Pages,
serving the root of `main`.

## Legacy edit workflow (current site)

As of the `rebuild/3d` branch, the legacy site now lives under `legacy/`
rather than the repo root. Paths below reflect that move.

`legacy/index.html` is a BUILT ARTIFACT: a custom bundler format with
base64-encoded assets. Do not hand-edit it directly — it's generated, not
authored.

The authoring source is `legacy/Agent Office Ship.dc.html`. It carries the
real page markup, styles, and structure in readable form.

`legacy/index.html` embeds that markup as a JSON string inside a
`<script type="__bundler/template">` tag. To make a content or markup
change:

1. Edit `legacy/Agent Office Ship.dc.html` directly, OR extract the
   current embedded template out of `legacy/index.html` first if you need
   to see what's actually deployed:
   ```
   python3 legacy/tools/repack.py extract <out-template.html>
   ```
2. Inject your edited template back into `legacy/index.html`:
   ```
   python3 legacy/tools/repack.py inject <in-template.html>
   ```
   This re-serializes the file as JSON and escapes `</` to `<\/` so an
   embedded `</script>` (or similar) can't terminate the carrier tag early
   and break the page. Don't hand-roll that escaping — always go through
   `repack.py inject`.
3. Verify locally before pushing:
   ```
   python3 legacy/tools/serve.py
   ```
   Serves the `legacy/` directory at `http://127.0.0.1:8734` — the same
   layout GitHub Pages serves it at in production (`/Portfolio/legacy/`),
   so this is a faithful local preview.

## Content invariants

Do not change any of the following without explicit user instruction —
these are the product, not incidental content:

- Contact email is `terreldandrews@gmail.com`. **The double d is
  correct.** It is not a typo of `terrelandrews@gmail.com`. Never "fix"
  it, autocorrect it, or flag it as an error.
- Palette: background `#0B1215`, amber accent `#E8B54A`, paper `#EDE6D2`.
  Typography: Courier Prime.
- The 9-exhibit structure (letters A through I) and the Case File 220
  noir framing are the product concept itself, not decorative flavor.
  Don't restructure, rename, or drop exhibits as a side effect of an
  unrelated change.
- Motion principles: calm, premium, intentional. Nothing flashy.
  Performance-first — animations should never come at the cost of load
  time or responsiveness.
- LinkedIn: `/in/terrel-andrews`.
- Resume file: `Terrel Andrews Resume 2026.docx`.
- Voice for any user-facing copy: conversational and clear. No emojis, no
  em-dashes, no hype.

## New stack (3D rebuild)

The site is being rebuilt as an immersive 3D experience: Vite + React +
TypeScript + `@react-three/fiber`, on branch `rebuild/3d`.

The legacy site (`index.html`, `Agent Office Ship.dc.html`, `tools/`) now
lives under `legacy/`. Use `python3 legacy/tools/serve.py` for a local
preview of it (serves at `http://127.0.0.1:8734`); the extract/inject
workflow above still applies, just with paths rooted at `legacy/`.

Dev commands for the new stack, run from the repo root:

```bash
npm install
npm run dev       # http://127.0.0.1:5173/Portfolio/
npm run build     # tsc --noEmit, then vite build -> dist/
npm run preview   # serve the production build locally
```

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds on every
pull request and deploys to GitHub Pages on push to `main`. It copies
`legacy/index.html` into `dist/legacy/index.html` as part of the build, so
the legacy experience stays reachable at `/Portfolio/legacy/` once this
branch cuts over.

After cutover, the legacy site stays live at `/Portfolio/legacy/` rather
than being deleted.

## Backlog

(empty — scope-creep ideas and "would be nice" notes go here instead of
getting pulled into active work)
