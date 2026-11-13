# Feeloy shorts: guide for a new session

This repo makes 60-second vertical animated ads for **Feeloy**, the user's AI companion app (the companion is "Jenny").
Each short tells one surprising true story and ends on Feeloy. Read this whole file before you start.

## What exists
| Composition | Story | Code | Production files | Output |
|---|---|---|---|---|
| `ElizaShort` | ELIZA, 1966: the first chatbot; Weizenbaum's secretary asked him to leave the room | `src/videos/eliza/` | `production/` | `out/final.mp4` |
| `RentalShort` | Japan's rental families: "Rent a Dad" | `src/videos/rental/` | `production-rental/` | `out/rental_final.mp4` |
| `ChatShort` | Jumbo's chat checkout (Kletskassa): "The Slow Lane", 71.5 s | `src/videos/chat/` | `production-chat/` | `out/chat_final.mp4` |

All are 1080x1920 at 30 fps, registered in `src/Root.tsx`. The final render is 1440x2560 (`--scale 1.3333`).

## Stack
- Remotion 4.0.290, @remotion/three, three.js 0.169, postprocessing. Exact versions are pinned in `package.json`; don't upgrade.
- 3D world (town, quay, rooms) with ink outlines.
- Characters are flat 2D billboard cards drawn with Canvas2D (`toon.ts`, the `Pen` API, 600x1000 design space). They sit on the `NOINK` layer and carry their own plum ink.
- Post chain: ink, then lens blur, then bloom, then NEUTRAL tone map, then grade.
- The method comes from the skill `anthropic-skills:cartoon-3d-short` (source: github.com/mromidev/claude-animated-shorts). Load it before building a new short.

## Files in each `src/videos/<name>/`
- **`story.ts`**: timing and camera.
  - `SHOTS` (frame ranges and light), `TOTAL`, `FLASH_AT`, `CARD_AT`, `XFADE`.
  - Camera keys `CAMS` (`dolly` + `pushK`), `KICKS`, `dofAt`.
  - Room offsets: `ROOMS`/`R(room,x,y,z)` place interiors far from the town.
- **`cast.ts`**: who stands where in each shot.
  - `stage(id, t, cam)` switches on the shot id.
  - Helpers `put`, `putSide`, `tag`, `wob`, `q`.
- **`toon.ts`**: character drawing, expressions, props, and effect cards (`fxPhone`, `fxTag`, ...).
- **`build.ts`**: the town, quay, benches and rooms (`buildRooms`).
- **`world.ts`**: per-frame setup: the per-shot sun `SUN_SHOT`, shadows, sky and fog.
- **`lights.ts` / `grade.ts` / `shade.ts`**: light presets `day` / `golden` / `night`, and the colour grade.
- **`Rental.tsx` / `Eliza.tsx`**: the composer, karaoke captions, and the end card (`logo` prop shows `public/eliza/logo.png` plus the "Feeloy" wordmark).
- **`captions.json`**: caption pages with word times (generated, see below).

## Where rendering happens
- The Claude workspace has **no GPU**: use it only for still checks.
- Final renders happen on the user's **RunPod GPU pod**. Claude has no SSH, so the handoff is: **push to GitHub `PineappleForest/eliza`, then the user runs on the pod:**
  ```
  git pull
  COMP=RentalShort ./render.sh final --props='{"logo":true}'   # or COMP=ElizaShort (default)
  ./render.sh preview      # 720p quick check
  ./render.sh remux        # new audio only, no re-render (seconds)
  ```
  Extra arguments after the mode go to `remotion render` (e.g. `--frames=0-120`). `render.sh` installs ffmpeg, Node and the Chrome libraries, and picks the WebGL backend in this order: angle-egl, then vulkan, then swangle.
- **Still checks in the workspace** (CPU, about 25 s per frame):
  ```
  export REMOTION_TMP=/home/claude/rtmp   # bundles pile up: delete remotion-webpack-bundle-* between runs
  COMP=RentalShort PROPS='{"post":{"dpr":0.5}}' node scripts/stills.mjs out/x_ 20,400,900 0.5
  ```
  Always look at the stills before pushing.
- Type-check: `npx tsc --noEmit`.
- Debugging flicker: freeze the camera (temporarily call `camAt(id, fixedFrame)` in world.ts), render consecutive frames, and diff them. Real flicker survives with a frozen camera; motion doesn't.

## Voice, captions and sound (per short, in `production*/`)
1. The script with sources lives in `SCRIPT.md`; the lines are in `voice/script.json`. The user generates the narration in **ElevenLabs** (voice "Mark") and uploads the mp3. **Never ask for or handle their ElevenLabs key.**
2. Align without speech recognition: `python3 -I tools/align_take.py take.mp3 voice/script.json voice/`. This writes `words.json` and `units.json`. Check the word times against the picture: fast lists ("Beep. Beep. Bag.") and long pauses drift, so find the speech bursts in the waveform and hand-fix those words. Convert the take to `voice/voice.wav` (48 kHz stereo) for the mix.
3. Captions: build `voice/phrases.json` (sentences, long ones split at commas), then `python3 tools/caption_pages.py voice/phrases.json voice/words.json src/videos/<name>/captions.json`. Spoken numbers ("twenty-nineteen") are merged into digits for the captions only (see `production-chat/voice/*_captions.json`). Pages hold at most 3 words / 16 characters, Montserrat Black, with the spoken word highlighted pink `#ff5fae`. The user wants these (the style of YouTube short N2p_WCBkkaA).
4. Sound: `python3 -I audio/make_audio.py <repo dir>` writes `audio/mix.wav`, stems and `cues.md`. The audio is an original synthesized score plus SFX.
   - Mix levels: music +3 dB and SFX -6 dB relative to their base levels; music ducked -3 dB under speech; -15 LUFS integrated.
   - The picture timing is mirrored inside make_audio.py, so any change to shot timing means re-running it.
5. Lock the picture timing to the words: every visual reaction lands 0-3 frames before its word.

## Story recipe that worked
- Hook (an absurd true fact), then the setting, then three or four escalating beats, then the twist, then the turn to the lonely person, then Feeloy, then the CTA.
- **CTA spoken: "Search Feeloy on the App Store."** End card: logo plus wordmark.
- Length 60-62 s, about 3.7 words/s. English only. All facts sourced in SCRIPT.md.
- Jenny (the companion) has silver hair with pink/blue streaks, a black outfit, and the standard ink-dot eyes like everyone else. Long hair must never read as a beard.

## Known pitfalls (already hit)
- Rows of overlapping people standing on a stage flickered on the pod GPU. The `RentalShort` opening was replaced with a single dad on the quay. **Prefer one or two characters per shot outdoors**; the closing showroom shot 14 still uses the stage, so watch it.
- Thin geometry (a 2 cm disc rim, a 3 cm wainscot top) draws jagged, crawling ink. Use flat quads/circles instead.
- Coarse quantization in a canvas cache key (`q(v, 12)`) makes props snap: use fine steps (`q(v, 120+)`).
- The shadow box must stay fixed for the whole shot and snap to shadow texels (already done in `world.ts`).
- A billboard bowing sideways gets clipped at the canvas edge: shift the drawing and the card (`putSide`).
- `fx.ink.dispose` must stay guarded (it crashed a render at frame 1411).
- `--props` must reach the renderer (render.sh passes extra arguments through).
- The logo PNG has a fake checkerboard background, so it's clipped with a rounded mask.
- Workspace network: npm, pip and GitHub only (no HuggingFace, ElevenLabs or RunPod).

## Working rules
- Push only to `PineappleForest/eliza`. End commit messages with the attribution lines the session gives you.
- The user may be away while the pod renders: make every fix complete, check it with stills, push, then give the exact pod command.
- Before giving code, give a short overview of the architecture or approach (user preference).

## Making the next short
1. Pick a surprising true story with a clear link to loneliness or companionship (offer 3-4 options; the user picks).
2. Write `production-<name>/SCRIPT.md` and `voice/script.json`, and give the user the plain narration text for ElevenLabs.
3. Copy `src/videos/chat/` (the newest) to `src/videos/<name>/`, rename the component and composition, and register it in `src/Root.tsx`. Add a `COMP` case to `render.sh`.
4. Once the take arrives: align, set `SHOTS`/`CAMS` to the words, then cast, build, captions, audio, stills, push.
