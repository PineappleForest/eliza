# Feeloy × ELIZA — "Asked to Leave the Room" (62 s vertical short)

A ~62 s, 1440×2560 cartoon short: the true 1966 story of ELIZA, the first chatbot, whose creator's own secretary asked him
to leave the room, handing off to Feeloy, the companion that listens and remembers. Rendered with three.js inside Remotion
(flat ink-outlined characters in a painted 3D world), original synthesized score and effects, local neural narration.

## Render (GPU box, e.g. RunPod)
```bash
git clone <this repo> && cd <repo>
./render.sh            # -> out/final.mp4  (2K, with sound; ~10-20 min on a GPU)
./render.sh preview    # -> out/preview.mp4 (720p quick check)
./render.sh remux      # after a new production/audio/mix.wav lands: re-attach sound, no re-render
```
The picture is cut to the narration slots in `production/voice/phrases.json`; a replacement voice is fitted into them.
`render.sh` installs ffmpeg/Node if missing, downloads Chrome, probes for a GPU WebGL backend (angle-egl, vulkan) and falls
back to CPU (swangle, much slower), renders, and muxes `production/audio/mix.wav`.

## Layout
- `src/videos/eliza/` — the short: `story.ts` (shots, cameras, kicks, lens blur, timed to the narration), `cast.ts`
  (who is where, poses, expressions), `toon.ts` (character + prop drawing, incl. the Feeloy companion and the phone screen),
  `world.ts` / `build.ts` (town, domed institute, booth street, 1966 office + corridor), `Eliza.tsx` (composition, flash,
  end card). Look modules (`ink.ts`, `lensblur.ts`, `grade.ts`, `shade.ts`, `lights.ts`, `cardshade.ts`, `paint.ts`) come
  from the claude-animated-shorts template (MIT).
- `public/eliza/feeloy_art.png` — app-icon art on the end card. Drop a logo at `public/eliza/logo.png` and render with
  `--props='{"logo":true}'` to replace the "Feeloy" wordmark.
- `production/` — `SCRIPT.md` (script + sources), `voice/` (narration + word timings), `audio/` (score/SFX/mix
  generator, `mix.wav`, `cues.md`), `tools/` (voice + contact-sheet scripts).
- Stills for checking: `node scripts/stills.mjs out/x_ 250,1560 0.5` (set `GL=angle-egl` on a GPU box).
