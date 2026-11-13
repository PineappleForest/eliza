#!/usr/bin/env bash
# One-command render of the Feeloy x ELIZA short on a GPU box (RunPod etc.).
#   ./render.sh            -> out/final.mp4  (1440x2560, 30 fps, h264 crf 16, soundtrack muxed)
#   ./render.sh preview    -> out/preview.mp4 (720x1280, quick check)
#   ./render.sh remux      -> out/final.mp4 again from the already-rendered out/video.mp4 + the current
#                             production/audio/mix.wav (new narration / soundtrack; no re-render, seconds)
# Needs: Node 18+ and ffmpeg (installed automatically with apt if missing). Chrome is downloaded by Remotion.
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-final}"
if [ "$MODE" = remux ]; then
  [ -f out/video.mp4 ] || { echo "out/video.mp4 missing: run ./render.sh first"; exit 1; }
  ffmpeg -y -loglevel error -i out/video.mp4 -i production/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/final.mp4
  echo "done: out/final.mp4"; exit 0
fi
command -v ffmpeg >/dev/null || { echo "installing ffmpeg"; (apt-get update -qq && apt-get install -y -qq ffmpeg) >/dev/null; }
command -v node >/dev/null || { echo "installing node 20"; (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y -qq nodejs) >/dev/null; }
# Chrome needs a few shared libraries on bare CUDA images
(apt-get install -y -qq libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 libegl1 >/dev/null 2>&1) || true
[ -d node_modules ] || npm ci --no-audit --no-fund
npx remotion browser ensure >/dev/null
export TEMP="$PWD/remotion-tmp" TMP="$PWD/remotion-tmp"; mkdir -p "$TEMP" out
SCALE=1.3333; [ "$MODE" = preview ] && SCALE=0.6667
# pick the fastest working WebGL backend: GPU (angle-egl, then vulkan), else CPU (swangle)
GL=""
for g in angle-egl vulkan swangle; do
  if timeout 300 npx remotion still src/index.ts ElizaShort out/_probe.jpg --frame=250 --gl=$g --scale=0.25 >/tmp/probe_$g.log 2>&1; then GL=$g; break; fi
done
[ -n "$GL" ] || { echo "no WebGL backend worked, see /tmp/probe_*.log"; exit 1; }
echo "WebGL backend: $GL"
CONC=$( [ "$GL" = swangle ] && nproc || echo 4 )
npx remotion render src/index.ts ElizaShort out/video.mp4 --codec h264 --crf 16 --scale $SCALE --gl=$GL --concurrency=$CONC --timeout=240000
OUT=out/final.mp4; [ "$MODE" = preview ] && OUT=out/preview.mp4
ffmpeg -y -loglevel error -i out/video.mp4 -i production/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
echo "done: $OUT"
