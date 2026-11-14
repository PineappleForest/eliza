"""Soundtrack for "Greyfriars Bobby" (the dog who stayed -> Feeloy), 32.3 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/bobby/story.ts + cast.ts (frames at 30 fps).
usage: python3 -I make_audio.py <eliza-short dir>
"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
from dsp import SR, ns, tt, rng, dbg, lp, hp, bp, pan, place, fades, make_ir, convolve_st, integrated, true_peak, read_wav, write_wav, colored
import instruments as I
import sfx_gen as G

ROOT = sys.argv[1]
FPS, TOTAL = 30, 969
DUR = TOTAL / FPS
N = ns(DUR)
F = lambda f: f / FPS
m2f = I.m2f
R = rng(7)
cues = []

def cue(t, what):
    cues.append((t, what))

def mx(*xs):
    """sum mono signals of different lengths (zero-padded)"""
    n = max(len(x) for x in xs); out = np.zeros(n)
    for x in xs: out[: len(x)] += x
    return out

def put(buf, x, t, g=1.0, p=0.0):
    """mono or stereo x into a stereo buffer at time t"""
    if x.ndim == 1: x = pan(x, p)
    place(buf, x, t, g)

# ================================================================ music
mus = np.zeros((2, N))
# A gentle Scottish-flavoured D-major lilt (a pluck in 6/8 with a fiddle-ish vibes tune), warm for the memory walk,
# a held pad for the grave, a sad minor for rain and snow, bright again when the town helps and the collar arrives,
# a warm swell for the statue, the Feeloy section.
def lilt(f0, f1, prog, mel, vel=0.75):
    b = 60 / 120; t = F(f0); k = 0
    while t < F(f1) - 0.3:
        ch = prog[k % len(prog)]
        put(mus, I.pluck(m2f(ch[0] - 12), 0.65 * vel, R, 1.2, 0.3), t, 0.8, -0.1)
        for j in range(6): put(mus, I.pluck(m2f(ch[j % 3] + 12), 0.28 * vel, R, 0.4, 0.6), t + j * b / 2, 0.45, 0.3 * (1 if j % 2 else -1))
        for (o, m, d) in mel[k % len(mel)]: put(mus, I.vibes(m2f(m), 0.42 * vel, R, d * b + 0.5), t + o * b / 2, 0.55, 0.15)
        t += 3 * b; k += 1
cD, cG, cA, cBm, cEm = [50, 54, 57], [55, 59, 62], [57, 61, 64], [59, 62, 66], [52, 55, 59]
MEL = [[(0, 74, 2), (2, 76, 1), (3, 78, 2), (5, 76, 1)], [(0, 74, 3), (3, 71, 3)], [(0, 76, 2), (2, 78, 1), (3, 81, 3)], [(0, 78, 2), (2, 76, 1), (3, 74, 3)]]
put(mus, I.pad([m2f(n) for n in (47, 59, 62, 66)], F(118) + 0.3, 0.25, R, att=0.6, rel=0.4), 0, 0.65)
for k, (o, m) in enumerate([(0.4, 74), (1.4, 71), (2.4, 69), (3.2, 71)]): put(mus, I.musicbox(m2f(m + 12), 0.35, R, 1.6), o, 0.5, 0.25)
cue(0.0, "music: a soft music box over a low pad (the dog by the grave)")
lilt(118, 215, [cD, cG, cA, cD], MEL, vel=0.8); cue(F(118), "music: a warm Scottish 6/8 lilt for the memory walk")
put(mus, I.pad([m2f(n) for n in (47, 54, 59, 62)], F(336) - F(215), 0.26, R, att=0.6, rel=0.5), F(215), 0.65)
for k, (f, m) in enumerate([(244, 71), (270, 69), (311, 66)]): put(mus, I.vibes(m2f(m), 0.35, R, 1.6), F(f), 0.5, 0.2)
put(mus, I.pad([m2f(n) for n in (40, 52, 55, 59)], F(498) - F(336), 0.28, R, att=0.5, rel=0.5), F(336), 0.65)
for k, m in enumerate((71, 67, 66, 64, 62, 64)): put(mus, I.musicbox(m2f(m + 12), 0.4, R, 1.6), F(345) + k * 0.9, 0.5, 0.25 * ((k % 3) - 1))
put(mus, mx(I.timpani(m2f(40), 0.5, R, 1.4), I.vibes(m2f(71), 0.4, R, 1.8)), F(472), 0.55); cue(F(336), "music: sad minor for rain and snow; a hit on 14 YEARS")
lilt(498, 638, [cD, cBm, cG, cA], MEL, vel=0.85); put(mus, mx(I.glock(m2f(86), 0.5, R, 1.2), I.glock(m2f(90), 0.45, R, 1.2), I.triangle(0.3, R, 1.4)), F(609), 0.55)
cue(F(498), "music: the lilt returns (the town helps); a glock and triangle on LICENSED")
put(mus, I.pad([m2f(n) for n in (50, 57, 62, 66, 69)], F(705) - F(638), 0.32, R, att=0.4, rel=0.6), F(638), 0.7)
for k, m in enumerate((74, 78, 81, 86)): put(mus, I.vibes(m2f(m), 0.4, R, 1.4), F(642) + k * 0.2, 0.5, 0.2)
put(mus, I.pad([m2f(n) for n in (47, 54, 59, 62)], F(800) - F(702), 0.22, R, att=0.6, rel=0.6), F(702), 0.6)
B0, BEAT2, CARD = F(795), 60 / 96, 873
PROG2 = [(50, [62, 66, 69, 74]), (47, [59, 62, 66, 71]), (43, [55, 59, 62, 67]), (45, [57, 61, 64, 69])]
MEL2 = [[(0, 78, 1.5), (2, 76, 1), (3, 74, 1)], [(0, 76, 2), (2.5, 78, 1.5)], [(0, 81, 1), (1, 79, 1), (2, 76, 2)], [(0, 74, 1.5), (2, 78, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: Feeloy section (D pad, pluck arps, glock)")
for m, dt in [(62, 0), (66, 0.12), (69, 0.24), (74, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (38, 50, 54, 57, 62)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(CARD), 0.5, 0.3)
cue(F(CARD), "music: end-card chord + music box + triangle")
ir = make_ir(1.4, 11, hf=0.75)
mus = mus * 0.8 + convolve_st(mus, ir)[:, :N] * 0.2
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def paws(t0, n, dt=0.18, g=0.08, p=0.2):
    for k in range(n): put(sfx, G.clink(R, 900 + 80 * (k % 3), 0.03, 0.3), t0 + k * dt, g, p)
put(sfx, G.breeze(F(118), R, 1.0, gust=0.3, bright=700), 0, 0.15); put(sfx, G.bird_chirps(F(118), R, 0.3), 0, 0.08, 0.4)
popb(F(8), 0.35); popb(F(96), 0.3); cue(0.0, "sfx: quiet kirkyard: wind, a few birds")
for k in range(8): put(sfx, G.boot(R, 0.5), F(120) + k * 0.4, 0.14, 0.2)
paws(F(120), 16, 0.2, 0.06); popb(F(125), 0.35); put(sfx, G.babble(F(215) - F(118), R, 280, 1.3, rate=4, active=0.3), F(118), 0.04)
cue(F(120), "sfx: footsteps and little paws on the cobbles")
put(sfx, G.breeze(F(336) - F(215), R, 1.0, gust=0.4, bright=600), F(215), 0.18); paws(F(244), 10, 0.18, 0.07, 0.4); popb(F(312), 0.3)
rain = fades(lp(colored(ns(F(366) - F(336)), R, 0.0), 5000) * 0.6, 0.2, 0.4); put(sfx, rain, F(336), 0.35); cue(F(336), "sfx: rain, then snow wind")
put(sfx, G.breeze(F(498) - F(364), R, 1.0, gust=0.5, bright=500), F(364), 0.35); popb(F(456), 0.4)
put(sfx, G.breeze(F(638) - F(498), R, 1.0, gust=0.2, bright=800), F(498), 0.12)
put(sfx, G.clink(R, 700, 0.15, 0.3), F(527), 0.3); put(sfx, G.clink(R, 1500, 0.1, 0.5), F(600), 0.2); popb(F(609), 0.45)
for k in range(5): put(sfx, G.boot(R, 0.5), F(556) + k * 0.12, 0.12, 0.4)
cue(F(527), "sfx: the bowl set down; the collar's brass clink")
put(sfx, G.bird_chirps(F(702) - F(638), R, 0.4), F(638), 0.1, 0.4); popb(F(678), 0.3)
n = ns(DUR - F(702)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(702), 0.15)
put(sfx, G.crickets(F(873) - F(702), R, 3), F(702), 0.12, 0.3); popb(F(716), 0.3); cue(F(702), "sfx: night room, crickets")
put(sfx, mx(I.glock(m2f(86), 0.5, R, 0.8), I.glock(m2f(93), 0.4, R, 0.8)), F(823), 0.55, 0.0); cue(F(823), "sfx: Feeloy chime (phone)")
popb(F(846), 0.45)
whoosh(F(873), 0.5, 0.45); cue(F(873), "sfx: end-card whoosh")
whoosh(F(118), 0.5, 0.5)

# ================================================================ mix
v_raw, v_sr = read_wav(os.path.join(ROOT, "voice", "voice.wav"))
assert v_sr == SR, v_sr
v = v_raw.mean(0)
voice = np.zeros(N); voice[: min(N, len(v))] = v[:N]
words = json.load(open(os.path.join(ROOT, "voice", "words.json")))["words"]
V = np.vstack([voice, voice])
Lv = integrated(V)
# base levels relative to the voice, then the standard offsets: music +3 dB, SFX -6 dB
def to(x, lu):
    L = integrated(x); return x * dbg(lu - L) if np.isfinite(L) else x
mus_b = to(mus, Lv - 15.0) * dbg(+3.0)
sfx_b = to(sfx, Lv - 12.0) * dbg(-6.0)
# duck the music -3 dB while the voice speaks (key = word timings)
duck = np.zeros(N)
for w in words:
    a, b2 = ns(max(0, w["s"] - 0.08)), ns(w["e"] + 0.12); duck[a:b2] = 1
k = ns(0.12); duck = np.convolve(duck, np.ones(k) / k, "same")
mus_d = mus_b * dbg(-3.0 * duck)[None, :]
mix = V + mus_d + sfx_b
g = dbg(-15.0 - integrated(mix)); mix *= g
# limiter (look-ahead peak follower) to -1.2 dBTP
ceil = dbg(-1.9)
pk = np.max(np.abs(mix), 0); env = np.maximum.accumulate(pk[::-1])[::-1] if False else pk
win = ns(0.004); env = np.array([0.0])
from scipy.ndimage import maximum_filter1d, uniform_filter1d
env = maximum_filter1d(pk, size=2 * win + 1)
gain = np.minimum(1.0, ceil / np.maximum(env, 1e-9))
gain = uniform_filter1d(np.minimum.accumulate(np.r_[gain, 1.0][::-1])[::-1][:N] if False else gain, size=win)
gain = np.minimum(gain, ceil / np.maximum(pk, 1e-9))
mix *= gain[None, :]
os.makedirs(os.path.join(ROOT, "audio", "stems"), exist_ok=True)
write_wav(os.path.join(ROOT, "audio", "mix.wav"), mix)
for name, x in [("voice", V * g), ("music", mus_d * g), ("sfx", sfx_b * g)]: write_wav(os.path.join(ROOT, "audio", "stems", name + ".wav"), x)
rep = f"integrated {integrated(mix):.2f} LUFS, true peak {true_peak(mix):.2f} dBTP, length {mix.shape[1]/SR:.3f} s"
with open(os.path.join(ROOT, "audio", "cues.md"), "w") as fh:
    fh.write("# Cues (seconds)\n\n" + rep + "\n\nMix: voice unchanged; music base voice-15 LU then +3 dB, ducked -3 dB under words; SFX base voice-12 LU then -6 dB.\n\n")
    for t, w in sorted(cues): fh.write(f"- {t:6.2f}  {w}\n")
print(rep)
