# HANDOFF — 3D rebuild (paused before cutover)

_Last updated: 2026-07-16. Paused here intentionally, one step short of
going live, to pick up later._

## READ FIRST — design direction changed (2026-07-16)

Do **not** run the M8 cutover as-is. After living with the built 3D site,
the user does not like the overall feel of it and wants a rethink before
anything goes live. Specifics, in his words:

- **Loves:** the camera motions and the parallax scroll around the room.
  Those are the keepers — the core interaction is right.
- **Dislikes:** the 3D build itself feels clunky and blocky. It misses the
  mark. The code-modeled room reads as low-fi.
- **Prefers** the brightness and "realness" of the original 2D build over
  the new 3D look.
- **Ideal target:** a hybrid of the two — a **photorealistic background /
  environment**, kept the **camera movement and room-scroll** interaction
  on top of it. Not blocky modeled geometry; a real-looking space you move
  through the same way.

Not being worked on now — this is a note for the next pickup. The M8
cutover steps below are still accurate mechanically, but the site they'd
publish is no longer what the user wants shipped. Revisit direction first.

## Status in one line

The full 3D rebuild (milestones M0–M7) is **done, verified, committed, and
pushed** on branch `rebuild/3d`. The **live site is untouched** — it is
still the legacy 2D "Case File 220" page, served from `main`. Only the last
milestone, **M8 (the cutover that makes the new site live), remains** — and
it has not been started.

- Branch: `rebuild/3d`, in sync with `origin/rebuild/3d`, working tree clean.
- Last commit: `491d56e` (M7.2 touch + mobile).
- Live URL still serves the OLD site: https://terrelandrews-eng.github.io/Portfolio/
- Plan of record: `~/.claude/plans/lets-do-both-of-purring-hopper.md`

## To resume

Open Claude Code in this repo (or route to the `work` domain in the ICM
system, which points here). The next action is either:

1. **Review the built site once more** before cutover: `npm run dev`, open
   `http://localhost:5173/Portfolio/`. For headless/scripted screenshot
   checks the scene needs a real GPU — launch Chromium with
   `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`, and reload once
   in a warm context, or software GL stalls the first frames and the intro
   can't animate. (Scratch verification scripts from the build sessions are
   not in the repo; they were one-offs.)
2. **Run the cutover (M8)** when ready — steps below. This is the only
   remaining work and it is a deliberate, user-gated, public action.

## What's done (M0–M7)

- **M0–M1** — Repo docs (`README.md`, this repo's `CLAUDE.md`), Vite + React
  19 + TS scaffold, `base:'/Portfolio/'`, pinned deps, and
  `.github/workflows/deploy.yml` (inert until `main` has a `package.json`).
  Legacy 2D site moved to `legacy/` and still buildable/serveable via
  `legacy/tools/`.
- **M2–M3** — Gray-box room + the camera rig (`src/scene/CameraRig.tsx`,
  the highest-risk file: seat pose, idle drift, mouse-look, dolly-to-exhibit,
  ESC), then the nine exhibit panels + HUD, all copy from
  `src/content/exhibits.ts` / `strings.ts`.
- **M4** — All props modeled in code (desk, laptop, radio, phone, journal,
  window, corkboard, bookshelf, photos, mug, ceiling fan, lamp, outside
  scenery).
- **M5** — Lighting, post-processing (Bloom → DoF → Vignette → Noise),
  atmosphere. **Art direction was changed from dusk-noir to a bright
  Caribbean-day grade** at the user's request; that day grade is the
  approved look.
- **M6** — Intro sequence: a title-card hold, then a camera fly-in from the
  desk to the seat, skippable, reduced-motion-aware. Plus page meta (title,
  favicon, Open Graph / Twitter cards, og-image).
- **M7 (hardening, scoped)**:
  - **7.1 fallback** — `src/fallback/StaticFallback.tsx`: real SEO-visible /
    no-WebGL document with all nine exhibits' copy and working links.
  - **7.4 bundle** — lazy-load `Effects` and `Outside` behind Suspense;
    three.js split into a `vendor-three` chunk. App chunk ~80 KB gzip.
  - **7.2 mobile** — touch drag-to-look + tap-to-open in the camera rig;
    `touch-action:none` on the canvas; portrait layout for HUD/panels/
    briefing. Verified under phone emulation (390×844, touch, 4x CPU
    throttle).

## What's left

### M8 — Cutover (the only remaining milestone; user-gated, public)

The deploy workflow (`.github/workflows/deploy.yml`) already builds on PRs
and, on push to `main`, builds + copies `legacy/` into `dist/legacy` +
deploys to Pages — but it only actually publishes once GitHub Pages is
switched to the "GitHub Actions" source. Sequence:

1. Final doc pass: update `README.md` / this repo's `CLAUDE.md` "new stack"
   notes to say the 3D site is now live.
2. Tag the current live site so it stays recoverable:
   `git tag legacy-2d-final <current main SHA>` and push the tag.
3. **Immediately before merge**, flip Pages source from branch to Actions:
   `gh api repos/terrelandrews-eng/Portfolio/pages -X PUT -f build_type=workflow`.
4. Merge `rebuild/3d` → `main`. The push to `main` triggers the workflow,
   which builds and deploys the new site.
5. Post-deploy smoke test: the live 3D site loads; `/Portfolio/legacy/`
   still serves the old page; the résumé download works
   (`public/assets/Terrel-Andrews-Resume-2026.docx`); no 404s.
6. **Rollback if needed (two commands):** revert the merge commit on `main`,
   and flip Pages source back to the branch
   (`gh api ... -f build_type=legacy` / re-select the branch in settings).

### Deferred to a post-launch follow-up (agreed with user, 2026-07-13)

- **M7.3 keyboard + screen-reader pass**: global A–I hotkeys to open
  exhibits, focus trap in panels/modals, ARIA on the HUD/evidence menu, a
  reduced-motion audit. Not blocking the cutover; do it as a fast follow.

## Open thread to check during the M8 smoke test

- In one mobile exhibit-panel screenshot there was a tall blank band where
  the exhibit's photo sits. It looked like the image still loading at
  capture time rather than a layout bug — confirm the panel images render
  promptly on the live site.

## Invariants (do not "fix")

See this repo's `CLAUDE.md` for the full list. The load-bearing one:
contact email is `terreldandrews@gmail.com` — the **double d is correct**,
never change it. Palette `#0B1215` / `#E8B54A` / `#EDE6D2`, Courier Prime,
the nine-exhibit A–I structure, and calm/premium motion are all product,
not incidental.
