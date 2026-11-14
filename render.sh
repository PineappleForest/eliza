#!/usr/bin/env bash
# One-command render of the Feeloy shorts on a GPU box (RunPod etc.).
#   COMP=ElizaShort (default)  -> out/final.mp4          ("Asked to Leave the Room", ELIZA)
#   COMP=RentalShort           -> out/rental_final.mp4   ("Rent a Dad", rental families)
#   COMP=ChatShort             -> out/chat_final.mp4     ("The Slow Lane", the chat checkout)
#   COMP=MinisterShort         -> out/minister_final.mp4 ("The Minister for Loneliness")
#   COMP=SwedenShort           -> out/sweden_final.mp4   ("Call Sweden", The Swedish Number)
#   COMP=MonowiShort           -> out/monowi_final.mp4   ("Population: One", Monowi, Nebraska)
#   COMP=CardsShort            -> out/cards_final.mp4    ("100 Cards", Joe Cuba's 100th birthday)
#   COMP=PastaShort            -> out/pasta_final.mp4    ("No One to Save", Rome police cook spaghetti)
#   COMP=VoyagerShort          -> out/voyager_final.mp4  ("Still Saying Hello", Voyager 1 at one light-day)
#   COMP=PigsShort             -> out/pigs_final.mp4     ("Illegal to Be Lonely", the Swiss guinea pig law)
#   COMP=TowerShort            -> out/tower_final.mp4    ("A Town Under One Roof", Whittier, Alaska)
#   COMP=NothingShort          -> out/nothing_final.mp4  ("Rent Me. I'll Do Nothing.", Shoji Morimoto)
#   ./render.sh            -> out/final.mp4  (1440x2560, 30 fps, h264 crf 16, soundtrack muxed)
#   ./render.sh final --props='{"logo":true}'   extra options after the mode go to the renderer
#                             (logo: put your logo at public/eliza/logo.png; captions:false = no subtitles)
#   ./render.sh preview    -> out/preview.mp4 (720x1280, quick check)
#   ./render.sh remux      -> out/final.mp4 again from the already-rendered out/video.mp4 + the current
#                             production/audio/mix.wav (new narration / soundtrack; no re-render, seconds)
# Needs: Node 18+ and ffmpeg (installed automatically with apt if missing). Chrome is downloaded by Remotion.
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-final}"
COMP="${COMP:-ElizaShort}"
case "$COMP" in
  ElizaShort) MIX=production/audio/mix.wav; VID=out/video.mp4; FIN=out/final.mp4; PRE=out/preview.mp4 ;;
  RentalShort) MIX=production-rental/audio/mix.wav; VID=out/rental_video.mp4; FIN=out/rental_final.mp4; PRE=out/rental_preview.mp4 ;;
  ChatShort) MIX=production-chat/audio/mix.wav; VID=out/chat_video.mp4; FIN=out/chat_final.mp4; PRE=out/chat_preview.mp4 ;;
  MinisterShort) MIX=production-minister/audio/mix.wav; VID=out/minister_video.mp4; FIN=out/minister_final.mp4; PRE=out/minister_preview.mp4 ;;
  SwedenShort) MIX=production-sweden/audio/mix.wav; VID=out/sweden_video.mp4; FIN=out/sweden_final.mp4; PRE=out/sweden_preview.mp4 ;;
  MonowiShort) MIX=production-monowi/audio/mix.wav; VID=out/monowi_video.mp4; FIN=out/monowi_final.mp4; PRE=out/monowi_preview.mp4 ;;
  CardsShort) MIX=production-cards/audio/mix.wav; VID=out/cards_video.mp4; FIN=out/cards_final.mp4; PRE=out/cards_preview.mp4 ;;
  PastaShort) MIX=production-pasta/audio/mix.wav; VID=out/pasta_video.mp4; FIN=out/pasta_final.mp4; PRE=out/pasta_preview.mp4 ;;
  VoyagerShort) MIX=production-voyager/audio/mix.wav; VID=out/voyager_video.mp4; FIN=out/voyager_final.mp4; PRE=out/voyager_preview.mp4 ;;
  PigsShort) MIX=production-pigs/audio/mix.wav; VID=out/pigs_video.mp4; FIN=out/pigs_final.mp4; PRE=out/pigs_preview.mp4 ;;
  TowerShort) MIX=production-tower/audio/mix.wav; VID=out/tower_video.mp4; FIN=out/tower_final.mp4; PRE=out/tower_preview.mp4 ;;
  NothingShort) MIX=production-nothing/audio/mix.wav; VID=out/nothing_video.mp4; FIN=out/nothing_final.mp4; PRE=out/nothing_preview.mp4 ;;
  *) echo "unknown COMP=$COMP (ElizaShort | RentalShort | ChatShort | MinisterShort | SwedenShort | MonowiShort | CardsShort | PastaShort | VoyagerShort | PigsShort | TowerShort | NothingShort)"; exit 1 ;;
esac
case "$MODE" in final|preview|remux) shift || true ;; *) MODE=final ;; esac
EXTRA=("$@")
if printf '%s ' "${EXTRA[@]}" | grep -q '"logo" *: *true' && [ ! -f public/eliza/logo.png ]; then
  echo "logo:true needs your logo at public/eliza/logo.png (PNG with transparency works best). Add it or drop the option."; exit 1
fi
if [ "$MODE" = remux ]; then
  [ -f "$VID" ] || { echo "$VID missing: run ./render.sh first"; exit 1; }
  ffmpeg -y -loglevel error -i "$VID" -i "$MIX" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "$FIN"
  echo "done: $FIN"; exit 0
fi
export DEBIAN_FRONTEND=noninteractive
APT_UPDATED=0
apt_install() { if [ $APT_UPDATED = 0 ]; then apt-get update -qq; APT_UPDATED=1; fi; apt-get install -y -qq --no-install-recommends "$@"; }
command -v ffmpeg >/dev/null || { echo "installing ffmpeg"; apt_install ffmpeg >/dev/null; }
command -v node >/dev/null || { echo "installing node 20"; apt_install curl ca-certificates >/dev/null; curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null; apt-get install -y -qq nodejs >/dev/null; }
# Chrome's shared libraries (bare CUDA images have none of them); libasound2 was renamed libasound2t64 on Ubuntu 24.04
LIBS="libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libegl1 libgl1 libvulkan1 libx11-xcb1 libxshmfence1 fonts-liberation"
if ! ldconfig -p | grep -q libnss3.so; then
  echo "installing Chrome libraries"
  apt_install $LIBS >/dev/null
  apt_install libasound2t64 >/dev/null 2>&1 || apt_install libasound2 >/dev/null 2>&1 || true
fi
[ -d node_modules ] || npm ci --no-audit --no-fund
npx remotion browser ensure
export TEMP="$PWD/remotion-tmp" TMP="$PWD/remotion-tmp"; mkdir -p "$TEMP" out
SCALE=1.3333; [ "$MODE" = preview ] && SCALE=0.6667
# pick the fastest working WebGL backend: GPU (angle-egl, then vulkan), else CPU (swangle)
GL=""
for g in angle-egl vulkan swangle; do
  if timeout 300 npx remotion still src/index.ts "$COMP" out/_probe.jpg --frame=250 --gl=$g --scale=0.25 >/tmp/probe_$g.log 2>&1; then GL=$g; break; fi
done
if [ -z "$GL" ]; then
  echo "no WebGL backend worked. Last lines of each probe:"
  for g in angle-egl vulkan swangle; do echo "----- $g"; grep -v "GL Driver Message" /tmp/probe_$g.log | tail -n 15; done
  exit 1
fi
echo "WebGL backend: $GL"
CONC=$( [ "$GL" = swangle ] && nproc || echo 4 )
npx remotion render src/index.ts "$COMP" "$VID" --codec h264 --crf 16 --scale $SCALE --gl=$GL --concurrency=$CONC --timeout=240000 "${EXTRA[@]}"
OUT=$FIN; [ "$MODE" = preview ] && OUT=$PRE
ffmpeg -y -loglevel error -i "$VID" -i "$MIX" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
echo "done: $OUT"
