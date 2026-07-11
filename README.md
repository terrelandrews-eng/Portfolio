# Portfolio

An interactive noir detective-style portfolio experience. Visit the live site at https://terrelandrews-eng.github.io/Portfolio/

## What This Is

Case File No. 220. An operative has gone quiet in Antigua. His beach-shack office remains untouched, and you've been tasked with confirming his identity by examining the evidence.

The site is a self-contained interactive experience. As you explore his office, you open nine exhibits (A through I) to piece together who this person is:

- Window view (the setting)
- Journal (resume and work history)
- Computer (projects and code)
- Phone (how to reach him)
- Corkboard (tech stack)
- Bookshelf (credentials and education)
- Photos (background and interests)
- Radio (ongoing work)
- Mug (personal details)

## Live Site

The portfolio is deployed via GitHub Pages and lives at the root of the main branch. Visit https://terrelandrews-eng.github.io/Portfolio/ to explore the case.

## How It Works (Legacy Architecture)

The legacy site now lives under `legacy/`. It runs as a single bundled `legacy/index.html` file (approximately 3.3 MB) with all assets embedded as base64-encoded data. This keeps deployment simple and the experience self-contained.

The human-editable source file is `legacy/Agent Office Ship.dc.html`. When you make changes, use the repack tooling to update the bundled version:

```bash
# Extract the deployed page template out of the bundled index.html
python3 legacy/tools/repack.py extract template.html

# Make your edits, then inject the template back into index.html
python3 legacy/tools/repack.py inject template.html
```

## Local Development

To preview legacy site changes locally:

```bash
python3 legacy/tools/serve.py
```

This starts a local server at http://127.0.0.1:8734. Open that URL in your browser to see the legacy site.

To work on the new 3D rebuild instead:

```bash
npm install
npm run dev
```

This starts a Vite dev server at http://127.0.0.1:5173/Portfolio/.

## What's Next

A full rebuild is underway as an immersive 3D experience using Vite, React, TypeScript, and react-three-fiber. This work is happening on the `rebuild/3d` branch while the current version remains live on main. A GitHub Actions workflow builds and deploys that branch's preview on every pull request and deploys to GitHub Pages on push to main.

When the 3D version ships, this legacy version will be preserved and accessible at `/Portfolio/legacy/` for archival and reference.
