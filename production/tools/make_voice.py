"""Narration for the ELIZA -> Feeloy short with Kokoro (local).
Synthesises phrase by phrase so word timings are known: within a phrase, word times are spread over the
voiced span in proportion to each word's phoneme count. Writes voice/voice.wav (48 kHz) + voice/words.json.
usage: python3 -I tools/make_voice.py <outdir> [voice] [speed]
"""
import json, re, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

OUT = sys.argv[1]; VOICE = sys.argv[2] if len(sys.argv) > 2 else "am_michael"; SPEED = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
# (phrase, pause after in seconds). Sentences end with longer pauses; the hook gets room for the flash.
LINES = [
    ("In nineteen sixty-six, a computer program got its own inventor asked to leave the room.", 0.75),
    ("M I T.", 0.3), ("Joseph Weizenbaum built ELIZA to play a therapist,", 0.12), ("because a therapist can just ask questions.", 0.55),
    ("His secretary had watched him build it for months.", 0.3), ("She knew exactly what it was.", 0.45),
    ("She typed a few lines,", 0.12), ("turned around,", 0.12), ("and asked him to leave.", 0.6),
    ("Visitors poured out their secrets.", 0.3), ("Psychiatrists predicted fully automatic therapy.", 0.3),
    ("Carl Sagan pictured rows of therapy booths,", 0.1), ("like phone booths.", 0.6),
    ("But ELIZA had a problem.", 0.3), ("Close the session,", 0.1), ("and it forgot you ever existed.", 0.55),
    ("Luckily, it never judged you.", 0.3), ("Unluckily, it never remembered you either.", 0.6),
    ("Here's the trick.", 0.2), ("ELIZA was a mirror.", 0.3), ("I'm sad,", 0.12), ("became, why are you sad?", 0.5),
    ("Like talking to your dog.", 0.2), ("He doesn't follow a word,", 0.1), ("but he looks at you like he does,", 0.1), ("so you keep talking.", 0.55),
    ("It got a name:", 0.12), ("the ELIZA effect.", 0.75),
    ("Sixty years later, Feeloy listens,", 0.12), ("and remembers.", 0.3), ("Your day, your people, the little things.", 0.55),
    ("ELIZA got its inventor sent out of the room.", 0.3), ("Feeloy just asks how your interview went.", 0.6),
    ("Search Feeloy on the App Store.", 1.2),
]
FIX = {"sˈæɡən": "sˈeɪɡən"}  # Sagan = SAY-gun

k = Kokoro("/home/claude/models/kokoro-v1.0.onnx", "/home/claude/models/voices-v1.0.bin")
SR_OUT = 48000
chunks, words, t = [np.zeros(int(0.35 * SR_OUT), np.float32)], [], 0.35
for text, pause in LINES:
    ph = k.tokenizer.phonemize(text, "en-us")
    for a, b in FIX.items(): ph = ph.replace(a, b)
    audio, sr = k.create(ph, voice=VOICE, speed=SPEED, is_phonemes=True)
    audio = np.asarray(audio, np.float32)
    # resample 24k -> 48k (linear is fine for speech at 2x)
    x = np.interp(np.arange(len(audio) * SR_OUT // sr) * sr / SR_OUT, np.arange(len(audio)), audio).astype(np.float32)
    env = np.convolve(np.abs(x), np.ones(480) / 480, "same"); thr = 0.02 * env.max()
    on = np.flatnonzero(env > thr); a0, a1 = (on[0], on[-1]) if len(on) else (0, len(x))
    x = x[max(0, a0 - 960): a1 + 2400]; lead = (a0 - max(0, a0 - 960)) / SR_OUT; span = (a1 - a0) / SR_OUT
    toks = re.findall(r"[A-Za-z0-9']+", text)
    wts = [max(1, len(k.tokenizer.phonemize(w, "en-us"))) for w in toks]; tot = sum(wts); c = 0
    for w, n in zip(toks, wts):
        words.append({"w": w, "s": round(t + lead + span * c / tot, 3), "e": round(t + lead + span * (c + n) / tot, 3)}); c += n
    pause *= 0.62; chunks += [x, np.zeros(int(pause * SR_OUT), np.float32)]; t += len(x) / SR_OUT + pause
v = np.concatenate(chunks); v = v / np.abs(v).max() * 0.89
sf.write(f"{OUT}/voice.wav", v, SR_OUT, subtype="PCM_16")
json.dump({"duration": round(len(v) / SR_OUT, 3), "voice": VOICE, "speed": SPEED, "words": words}, open(f"{OUT}/words.json", "w"), indent=0)
print("duration", round(len(v) / SR_OUT, 2), "s", len(words), "words")
