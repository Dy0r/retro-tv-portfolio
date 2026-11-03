# Dylan Prasodjo — Retro TV Portfolio

## Decisions log (keep up to date)
- Project lives in `~/retro-tv-portfolio`. Node.js is installed locally at `~/.local/node` (on PATH via `~/.zprofile`).
- Seed projects use titles/years from dylanprasodjo.com: Plinth (2025), Holocare (2024), Violetta Rebrand (2025), Design is Addition (2023), plus This Portfolio. All other text is `[COPY: …]`.
- Contact email is `dylanprasodjo@gmail.com` (the old site's mailto pointed at a wrong address — never reuse it).
- Domain: this site replaces dylanprasodjo.com.
- INSERTING may take up to ~2 s (approved). Cartridges rest next to the console before pickup.
- No hand: a first-person hand version was built and compared (Nov 2026); Dylan preferred the cartridge moving by itself, so the hand was removed. (It's in git history at b6af09b if ever needed.)
- Models in `~/Downloads` (`nintendo_64*.glb`, `japroom_14_otaku.glb`, `retro-crt-tv.zip`) are REFERENCE ONLY for proportion and style. TV, console, cartridge and room are rebuilt as original models in Blender. The console/cart must not copy a real console's shape or branding.
- Room look: lived-in bedroom with cyberpunk accents. Neon pair is red (outside: skyline signs, city light through the window) + teal (inside: LED strips). Avoid magenta/cyan and purple/blue gradients.
- Opening moment (end of BOOT, after loading): wide room shot, TV flickering to draw the eye, and an enter hint ("scroll to enter" signifier). Scroll / Enter / Space / click / tap enters → INTRO → MENU. Hint text lives in site.json (`pressStart`, `pressStartTouch`): "Scroll to switch on" / "Tap to switch on" (approved by Dylan).
- Loading screen follows `References/Loading screen.mp4`: dot-matrix olive-yellow shape on black with pixel dust, "Loading" + stepping dots. Morph plays ONCE (rounded square -> four-point star) and stays short. Progress shown as pixel blocks.
- INTRO power-on: LED on, TV black, dot -> line -> open with white flash that lights the room, menu settles; camera dollies in at the same time (~2 s, any key skips).
- MENU is a one-item-at-a-time carousel with pixel arrows on the sides (not a list). The selected project's cartridge lifts and glows in the row; clicking a cartridge selects it. About / Contact / Credits follow the projects as pages without cartridges.
- Provisional pixel font: Pixelify Sans (OFL, self-hosted via @fontsource) until directions are locked.
- Model requirement: the TV's `Screen` mesh must have UVs (the menu is drawn onto it) and sit in front of the TV body.
- Room neon: three abstract tube pieces (red ring-and-bar by the window, teal corner tube, teal wave above the shelf), each flickering rarely (every 8-20 s). No text or logos in neon.
- Resume: the poster (`ResumePoster` mesh) is clickable from the opening shot and the menu. Camera zooms to it, then a modal overlay shows the PDF in a stepped-corner teal frame with a pixel X; X / Esc / click outside closes. This is the RESUME state (returns to where it came from). PDF lives at `public/resume/dylan-prasodjo-resume.pdf` (path in site.json). Dylan is fine with it being public. Labels "Close resume" / "Open PDF" approved.
- Zoom out: from the menu, a top-left button ("Zoom out" + ESC key cap), Esc or gamepad B returns to the opening shot (MENU -> BOOT). The TV powers off (picture -> line -> dot) while the camera glides back; then the flicker and hint return. With the resume open, the first Esc closes the resume, the second zooms out.
- TV picture is deliberately minimal for readability: no scanlines, barely-there grain, a rare gentle ~0.2 s glitch every 15-30 s (none under reduced motion), and never any bloom on screen content (bloom threshold sits above pure white).
- Readability rules for the TV menu: smallest text 34px on the 1024x768 canvas (about 16-21px on screen at 1440x900); every text colour at least WCAG AAA 7:1 on --screen-bg (ink 16.4:1, dim 9.8:1, accent 10.8:1). Re-check both whenever tokens or menu layout change.
- Cartridges never glow (no emissive, matte plastic); only the selected one lifts. The arrows above them are crisp, not neon.
- Cartridge insert (INSERTING): Enter / click the screen / click the selected cartridge / gamepad A. The cartridge moves by itself (no hand).
- Selection cues: in the menu an "Insert" button (bottom-right, ENTER key cap) shows while a project is selected, and a bobbing teal pixel arrow points down at the selected cartridge. Once inserted, stacked up-arrows bob above the cartridge; clicking them or the cartridge ejects (Esc and the Eject button still work).
- PROJECT: the TV shows the project's title screen, then the case study opens in the shared framed pop-up (src/ui/framedDialog.js, same frame as the resume): header, hero, sections, links; Lenis smooth scroll inside it; indicators = progress bar, section list with current marker (click to jump), "Scroll to read" cue. Every image enlarges in the same frame (src/ui/lightbox.js). Closing the case study (X / Esc / click outside / gamepad B) ejects the cartridge back to the menu. Topmost pop-up always handles Esc first.
- Project copy lives in one file per project: src/content/projects/<slug>.json (guide: README.md in that folder). Body text is a list of paragraphs. Placeholder hero/process images come from scripts/make-placeholder-art.mjs.
- Reading font: Atkinson Hyperlegible (OFL, self-hosted) for case-study body text at 19px; pixel font for headings/labels. All case-study text colours pass WCAG AAA on --screen-bg.
- Desk lamp aims at the console, not the cartridge row (bright cartridge colours read as glowing otherwise).
- Hosting: GitHub Pages from a public repo `retro-tv-portfolio`, auto-deployed by `.github/workflows/deploy.yml`. The site lives in a sub-folder there, so all file paths go through `src/assetUrl.js`; set BASE_PATH to "/" once dylanprasodjo.com points at it.
- `References/*.mp4` stays out of git (not Dylan's work).
- Deep links: `#/project/<slug>` opens a project directly (cartridge already in); the address follows the open project; browser Back ejects.
- Link preview: title, description and tagline come verbatim from dylanprasodjo.com (site.json); share image `public/og-image.jpg` (1200x630 room shot, regenerate with `__dev.saveShareImage()` in dev); pixel-star favicon. Stay on the GitHub Pages address until Dylan says to switch to dylanprasodjo.com.
- Content from dylanprasodjo.com is used verbatim (text, hero and gallery images, YouTube/Drive links). Anything that would need rewording stays `[COPY: …]`. The Framer template device mockups on the old home page are not Dylan's work and are not used.
- About / Contact / Credits open in the same reader as the case studies (no cartridge); closing returns to the menu without ejecting.
- Sound effects: original, synthesised live (src/audio/sfx.js), on by default with no toggle. They start after the first click/tap/key (browser rule), so entering by scroll alone is silent until then.
- Music: player bottom-left (src/audio/musicPlayer.js) around Spotify's official embed, playlist in site.json `music.playlistUrl`, tracks cached in src/content/playlist.json (refresh: `node scripts/sync-playlist.mjs`). Nothing loads or plays until the visitor clicks it; a small "Click to play music" hint sits above it until then. Random song on start, shuffle button, auto-advance. Visitors not logged into Spotify hear 30-second previews.
- City life in the window: a plane with blinking lights, an elevated train every 8-14 s, office lights switching on and off. Placed where the opening shot sees them (lower half of the window). Off under reduced motion.

---

## The brief (from Dylan, verbatim)

### Who I am and how we work
I'm a designer and communications expert, not a developer. You are the engineer.

* Work in SHORT PASSES. One pass = one feature, a few minutes of work, and the site still runs with `npm run dev` and zero console errors at the end.
* End every pass with: (1) what changed, in plain English, (2) exactly what I should click/test in the browser, (3) a one-line git commit message. Then STOP and wait for me.
* Never silently delete or rewrite a working feature. If a change touches more than 3 files, show me the plan first.
* If something fails or you're unsure, say so. Don't hide errors or fake a fix.
* Vanilla Three.js only (no React / R3F) unless I ask. Keep dependencies minimal and free.
* All words, links and project data live in `src/content/` JSON files. Never hard-code project text in scene code.
* NEVER write final user-facing copy. Use `[COPY: what this text should say]` placeholders; I write the words.
* Explain new concepts in one or two lines so I learn as we go.

### Concept
A single-page 3D portfolio set in a dim late-90s bedroom at night. A boxy CRT TV sits on a low stand; in front of it is an ORIGINAL, unbranded retro console inspired by late-90s 64-bit consoles (chunky dark-grey body, top-loading cartridge slot, power LED, power and reset switches). The TV shows a loading screen with my name and a short introduction based on my website www.dylanprasodjo.com. Each "game" is one of my projects, each with its own cartridge and label. When a "game" or project is loaded a short animation plays where the hand is loading the game by picking up the cartridge and loading it in, keep this short but smooth.
No real console brand names, logos, startup animations, sounds or fonts. If a sourced model carries a logo, flag it and remove it.

### Experience flow (build as an explicit state machine in `src/state.js`)
BOOT -> INTRO -> MENU -> INSERTING -> PROJECT -> back to MENU. FALLBACK_2D reachable from any state.

1. BOOT (loading screen): full-screen HTML over a black canvas. Real load progress from THREE.LoadingManager shown as a chunky retro progress bar. My name animates in letter by letter (GSAP SplitText), then my one-line intro and 2-3 short lines about me. Prompt: "Press Start" (Enter / Space / click / tap / gamepad Start). Always-visible link: "Skip to projects" (opens FALLBACK_2D). Sound OFF by default with a toggle.
2. INTRO: CRT power-on effect (thin bright line expands to full screen, flash, settle), then a GSAP camera move from a wide room shot to a framed view of the TV and console. Under 2.5 s, skippable with any key.
3. MENU (on the TV screen): draw the UI on an offscreen 2D canvas, use it as a CanvasTexture on the curved CRT screen mesh, run it through the CRT shader. Show a list of projects as games: title, year, genre tag. A preview panel shows the selected project's thumbnail and one-line summary. Blinking cursor on the selected row.
   Input: arrow keys / WASD, Enter to select, Esc to go back, Gamepad API (d-pad + A/B + Start), mouse hover and click (raycast onto screen UV), touch swipe and tap, mouse wheel / trackpad (stepped, see Motion).
   Include menu items for About, Contact and Credits.
4. INSERTING: on select, camera eases down to the console; the project's cartridge (its colour and label from JSON) slides into the slot; LED blinks; TV shows static for ~0.4 s. Total under 1.5 s. *(Updated: up to ~2 s approved, see decisions log.)*
5. PROJECT: open the case study as an accessible HTML overlay (not inside WebGL). Sections: hero image or video, the problem, my role, process, outcome, links. Esc / back button / gamepad B returns to MENU with the cartridge ejecting. Every project has a deep link: `/#/project/<slug>`. Opening a deep link skips BOOT and INTRO.
6. FALLBACK_2D: a clean, fast HTML page listing the same projects from the same JSON. Auto-offered when WebGL is missing, the device is low-power, or prefers-reduced-motion is on.

### Look and feel
* Before building any visuals, study every image in `references/` and propose THREE distinct directions (display font + text font, 4-5 colours, motion personality). After I choose, lock them in `src/styles/tokens.css`. From then on use ONLY tokens: no stray hex values, fonts or durations.
* Lighting: warm desk-lamp key light plus the cool glow of the CRT. Dark, cosy, restrained. Add a colour-grade pass so the scene never looks like default Three.js.
* CRT shader on screen content: scanlines, slight barrel curvature, subtle chromatic aberration, vignette, phosphor glow (bloom), rare rolling bar. Expose an intensity uniform. Under prefers-reduced-motion: no flicker or roll.
* Fonts: a free OFL pixel font for TV UI (e.g. Press Start 2P or VT323 from Google Fonts) unless the chosen direction says otherwise; self-host all fonts.
* Sound: original sounds only, synthesised with the Web Audio API or supplied by me in `public/audio/`. No sampled console sounds.

### Motion and smoothness
* ONE CLOCK: GSAP's ticker drives the Three.js render, camera easing and Lenis (`lenis.raf` inside `gsap.ticker`, `gsap.ticker.lagSmoothing(0)`). No other requestAnimationFrame loops.
* Signature eases live in `src/motion/eases.js` (GSAP CustomEase), e.g. `crtSnap` (fast in, tiny overshoot, settle) and `slowDolly`. Every animation uses a named ease and a token duration. No default `power1`/0.3 s fades.
* Camera and menu cursor use frame-rate-independent damping (delta-time based), so motion feels identical at 60, 120 and 144 Hz.
* Menu wheel/trackpad input is STEPPED: accumulate delta, move exactly one row per threshold, short cooldown. Never let one trackpad flick skip several projects.
* Lenis only inside the case-study overlay, synced with ScrollTrigger; `data-lenis-prevent` on nested scroll areas; native touch scrolling; disabled under prefers-reduced-motion.
* During BOOT, precompile all shaders and upload all textures (e.g. renderer.compileAsync) so the first INTRO and INSERTING play without a hitch.
* In HTML, animate only transform and opacity. No object allocation inside the render loop.

### Originality rules (banned defaults)
Do not use: Inter or system-font-only typography; purple/blue gradients; glassmorphism; centred "Hi, I'm…" heroes; emoji or stock icon sets as decoration; uniform rounded cards or bento grids; identical fade-up-on-scroll animations; filler copy; default grey MeshStandardMaterial looks with stock bloom.
After every visual pass, run a taste review: compare the result against `references/` and this list, name anything that looks generic, and propose a fix before I commit.

### Stack
* Vite, vanilla JavaScript, Three.js, GSAP (all plugins are free now, including SplitText and CustomEase), Lenis.
* Post-processing: Three.js EffectComposer with a custom CRT ShaderPass, UnrealBloomPass and a colour-grade pass.
* Models: GLTFLoader with Meshopt/Draco decoders. Files in `public/models/`: `tv.glb`, `console.glb`, `cartridge.glb`, optional `room.glb`.
* BUILD WITH PLACEHOLDER PRIMITIVES FIRST (rounded boxes for TV, console, cartridge). Real models must be drop-in replacements: same file names, scene code finds parts by mesh name (`Screen`, `Slot`, `LED`, `Label`).
* `scripts/optimize-models.mjs`: a Node script using @gltf-transform/cli to compress models (Meshopt, textures to WebP or KTX2, max 2048 px).
* Blender is connected through MCP for Blender. For model work: ask me to save the .blend first, make the change, show me several angles, then export glTF binary to `public/models/` and run the optimise script. Never use the AI model generators.

### Folder structure
* `src/main.js` renderer, loop, resize
* `src/state.js` state machine
* `src/scene/` room, tv, console, cartridge, lights, camera rig
* `src/screen/` menu canvas UI, CRT shader
* `src/ui/` loader, project overlay, 2D fallback
* `src/input/` keyboard, gamepad, pointer/touch, wheel
* `src/audio/` Web Audio synth
* `src/motion/eases.js` named eases and durations
* `src/styles/tokens.css` locked design tokens
* `src/content/site.json` name, tagline, intro lines, socials, contact
* `src/content/projects/<slug>.json` one file per project (Dylan edits these; guide in `src/content/projects/README.md`), loaded by `src/content/projects.js`
* `public/models/`, `public/textures/`, `public/audio/`, `public/projects/<slug>/`
* `references/` my moodboard images
* `blender/` source .blend files

### Project file schema (`src/content/projects/<slug>.json`; was projects.json)
Each project: slug, title, year, role, genre (short tag), summary (max 120 chars), cartridgeColor (hex), labelImage, thumbnail, hero (image or video), sections [{heading, body, media}], links [{label, url}], featured (bool).
Generate placeholder label art and thumbnails (simple coloured cards with the title) so the menu looks complete from day one.

### Budgets (check and report these at the end of each pass that affects them)
* 60 fps on a mid-range laptop, 30+ fps on a mid-range phone. Cap devicePixelRatio at 2 (1.5 on mobile).
* No frame over 16 ms during INTRO, menu navigation or INSERTING on desktop.
* Loading screen visible in under 1.5 s. Initial download under 5 MB total; each model under 1.5 MB after compression.
* Lazy-load case-study media. Pause the render loop when the tab is hidden or the overlay fully covers the canvas.
* Dispose geometries, materials and textures when no longer needed.

### Accessibility, SEO, sharing
* Everything works by keyboard. Visible focus states. An ARIA live region announces the selected project.
* Case-study overlay uses real headings and meets WCAG AA contrast.
* index.html includes title, meta description, Open Graph image and a noscript/2D list of projects so recruiters and search engines see content without WebGL.

### Deploy
Static site. GitHub repo, deployed to Cloudflare Workers static assets (wrangler config with `assets.directory: ./dist`), auto-deploying on push to main. No server code.

### Definition of done
* Boot -> intro -> menu -> project -> back works with keyboard, mouse, trackpad, touch and a gamepad.
* Deep links work. 2D fallback works with JavaScript disabled for the project list.
* Budgets met on desktop, a 120 Hz screen and a real phone. No console errors.
* Swapping a model, texture or project entry needs zero code changes.
* Passes the taste review: nothing on the banned list, everything traceable to tokens and references.
* Lighthouse: Accessibility 90+, Best Practices 90+.
