"""Soundtrack for "Call Sweden" (The Swedish Number, 2016 -> Feeloy), 51.3 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/sweden/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1540
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
# A bouncy pluck intro under the ringing phone, the curious D pentatonic groove for the kitchen and the control room,
# a quiet music box for the lonely caller, then the warm Feeloy section and the end-card chord.
BEAT = 60 / 96
PENT = [62, 64, 66, 69, 71, 74, 76, 78, 81]
CH = {"D": [62, 66, 69], "G": [55, 59, 62], "Bm": [59, 62, 66], "A": [57, 61, 64], "Em": [52, 55, 59]}
def bar(t0, chord, lead=None, bass=True, brush=True, vel=1.0, pad=0.2):
    root = CH[chord][0] - 12
    if bass:
        for b, off in [(0, 0), (2, 7)]: put(mus, I.pluck(m2f(root + off), 0.7 * vel, R, 0.6, 0.35), t0 + b * BEAT, 0.9, -0.15)
    if brush:
        for b in (1, 3): put(mus, I.brush(0.3 * vel, R), t0 + b * BEAT, 0.7, 0.25)
    put(mus, I.pad([m2f(n) for n in CH[chord]], 4 * BEAT, pad * vel, R, att=0.3, rel=0.5), t0, 0.5)
    for (o, deg, d) in (lead or []):
        put(mus, I.pluck(m2f(PENT[deg] + 12), 0.55 * vel, R, d * BEAT + 0.5, 0.75), t0 + o * BEAT, 0.75, 0.2)
MOTIF = [[(0, 2, 0.5), (0.5, 3, 0.5), (1, 4, 1), (2.5, 3, 0.5), (3, 2, 1)], [(0.5, 1, 0.5), (1, 2, 1), (3, 0, 1)],
         [(0, 4, 0.5), (0.5, 5, 0.5), (1, 6, 1), (2.5, 5, 0.5), (3, 4, 1)], [(1, 3, 1), (2, 2, 2)]]
PROG = ["D", "Bm", "G", "A"]
def section(f0, f1, lead=True, **kw):
    t = F(f0); k = 0
    while t < F(f1) - 0.3:
        bar(t, PROG[k % 4], MOTIF[k % 4] if lead else None, **kw); t += 4 * BEAT; k += 1
# hook: bouncy plucks under the ringing phone
for (t, d) in [(0.2, 2), (0.45, 4), (0.7, 5), (1.2, 4), (1.6, 2), (1.85, 4), (2.1, 5), (2.6, 7)]: put(mus, I.pluck(m2f(PENT[d] + 12), 0.55, R, 0.5, 0.8), t, 0.75, 0.2)
put(mus, I.pad([m2f(n) for n in (62, 66, 69)], F(108), 0.18, R, att=0.3, rel=0.3), 0.0, 0.5); cue(0.2, "music: bouncy pluck intro")
# the caller at night: soft pad
put(mus, I.pad([m2f(n) for n in (50, 57, 62, 66)], F(170) - F(108), 0.2, R, att=0.4, rel=0.4), F(108), 0.6)
# kitchen + control room: the groove
section(170, 833, pad=0.22, vel=0.85); cue(F(170), "music: curious pluck groove (kitchen, control room)")
for k, m in enumerate([81, 86, 88, 93]): put(mus, I.glock(m2f(m), 0.45, R, 1.0), F(332) + k * 0.07, 0.55, 0.2)
cue(F(332), "music: glock sparkle on 'hej'")
put(mus, I.cymbal(0.3, R, 2.0), F(808), 0.35, 0.2); cue(F(808), "music: cymbal swell on '376 days'")
# the longest call: the groove keeps going, a little faster feel (vibes)
t = F(833); k = 0
while t < F(953) - 0.3:
    bar(t, PROG[k % 4], None, brush=True, vel=0.8, pad=0.22)
    for (o, deg, d) in MOTIF[k % 4]: put(mus, I.vibes(m2f(PENT[deg] + 12), 0.38, R, d * BEAT + 0.5), t + o * BEAT, 0.6, 0.2)
    t += 4 * BEAT; k += 1
# the caller alone: music box over a low pad, then nearly nothing
put(mus, I.pad([m2f(n) for n in (47, 54, 59, 62)], F(1250) - F(953), 0.22, R, att=1.0, rel=0.8), F(953), 0.7)
for k, (o, deg) in enumerate([(0, 4), (0.6, 3), (1.2, 2), (2.4, 3), (3.0, 1), (4.2, 2), (4.8, 0)]): put(mus, I.musicbox(m2f(PENT[deg] + 12), 0.3, R, 1.6), F(1000) + o, 0.6, 0.15)
cue(F(953), "music: music box over a low pad (the caller alone)")
# Feeloy: warm modern section from "Feeloy", resolves on the end card
B0, BEAT2 = F(1270), 60 / 96
PROG2 = [(50, [62, 66, 69, 74]), (47, [59, 62, 66, 71]), (43, [55, 59, 62, 67]), (45, [57, 61, 64, 69])]
MEL2 = [[(0, 78, 1.5), (2, 76, 1), (3, 74, 1)], [(0, 76, 2), (2.5, 78, 1.5)], [(0, 81, 1), (1, 79, 1), (2, 76, 2)], [(0, 74, 1.5), (2, 78, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(1446):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: modern Feeloy section (D pad, pluck arps, glock)")
for m, dt in [(62, 0), (66, 0.12), (69, 0.24), (74, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(1446) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (38, 50, 54, 57, 62)], DUR - F(1446), 0.4, R, att=0.2, rel=1.0), F(1446), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(1446), 0.5, 0.3)
cue(F(1446), "music: end-card chord + music box + triangle")
ir = make_ir(1.1, 11, hf=0.8)
mus = mus * 0.82 + convolve_st(mus, ir)[:, :N] * 0.18
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

ir = make_ir(1.1, 11, hf=0.8)
mus = mus * 0.82 + convolve_st(mus, ir)[:, :N] * 0.18
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def outside(t0, t1, g=0.35, birds=True):
    d = t1 - t0; put(sfx, fades(G.breeze(d, R, 0.6), 0.2, 0.2), t0, g * 0.5)
    if birds: put(sfx, G.bird_chirps(d, R, 0.6), t0, g * 0.8, 0.4)
def room(t0, t1, g=0.1):
    n = ns(t1 - t0); put(sfx, fades(lp(colored(n, R, 1.0), 700) * 0.4, 0.15, 0.15), t0, g)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def knock(t, g=0.5):
    put(sfx, G.push_thump(R) * 0.7 + 0, t, g, 0.2)
def squeak(t, d=0.18, g=0.25):
    x = np.sin(2 * np.pi * np.cumsum(np.linspace(1800, 2600, ns(d))) / SR) * np.hanning(ns(d)) * (0.6 + 0.4 * np.sin(2 * np.pi * 40 * tt(d))); put(sfx, x, t, g, 0.3)
def bell(t, d=0.85, g=0.5, p=0.0):
    n = ns(d); tt_ = tt(d); x = (np.sin(2 * np.pi * 1180 * tt_) + 0.7 * np.sin(2 * np.pi * 1420 * tt_)) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 20 * tt_)))
    put(sfx, x * np.minimum(1, (d - tt_) / 0.08) * 0.5, t, g, p)
def flick(t, g=0.2, p=0.3): put(sfx, bp(colored(ns(0.06), R, 0.2), 2000, 8000) * np.hanning(ns(0.06)), t, g, p)
outside(0, F(108), 0.3)
for f in (0, 48, 96): bell(F(f), 0.85 if f < 96 else 0.4, 0.55)
cue(0.0, "sfx: the giant phone rings")
whoosh(F(108), 0.5, 0.7); cue(F(108), "sfx: white-flash whoosh")
n = ns(F(170) - F(108)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.2, 0.2), F(108), 0.15)
for k, f in enumerate((118, 126, 134, 142, 150)): put(sfx, I.glock(m2f([76, 79, 74, 81, 77][k]), 0.25, R, 0.25), F(f), 0.25, -0.2)
cue(F(118), "sfx: dial tones")
for f in (156,): bell(F(f), 0.5, 0.25, 0.3)
room(F(170), F(488), 0.09)
put(sfx, mx(G.clink(R, 900, 0.08, 0.4), G.push_thump(R) * 0.3), F(184), 0.45); cue(F(184), "sfx: pick-up click")
for f in (399, 426, 452): popb(F(f), 0.4, 0.15)
cue(F(399), "sfx: thought-bubble pops (meatballs, darkness, feminism)")
room(F(488), F(833), 0.08)
for k in range(30): popb(F(500) + k * 0.038, 0.12, -0.4 + 0.027 * k)
cue(F(500), "sfx: tiny pops as the map fills")
for k in range(20): put(sfx, G.clink(R, 2500 + 30 * k, 0.04, 0.8), F(590) + k * 0.067, 0.14, 0.3)
put(sfx, I.glock(m2f(96), 0.3, R, 0.8), F(655), 0.3, 0.0); cue(F(590), "sfx: counter ticks; chime on 'night'")
for k in range(28): flick(F(700) + k * 0.13, 0.18, -0.3 + 0.02 * k)
cue(F(700), "sfx: calendar pages flicking")
room(F(833), F(953), 0.08)
for k in range(36): put(sfx, G.clink(R, 3000 if k % 2 else 2500, 0.03, 0.6), F(833) + k * 0.07, 0.16, -0.3)
put(sfx, mx(I.glock(m2f(88), 0.45, R, 0.9), I.triangle(0.25, R, 0.7, 2637)), F(906), 0.4, -0.2); cue(F(833), "sfx: fast clock ticking; ding on 4:42")
n = ns(F(1540) - F(953)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(953), 0.15)
put(sfx, G.crickets(F(1446) - F(953), R, 3), F(953), 0.2, 0.3)
put(sfx, bp(colored(ns(1.0), R, 0.5), 300, 2500) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 24 * tt(1.0)))) * np.hanning(ns(1.0)), F(962), 0.12, 0.3)
popb(F(1030), 0.35); put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(900, 300, ns(0.25))) / SR) * np.hanning(ns(0.25)), 0.0, 0.02), F(1062), 0.3)
cue(F(953), "sfx: night: crickets, hum; projector whirr; bubble pop and deflate")
for k in range(3): put(sfx, np.sin(2 * np.pi * 425 * tt(0.25)) * 0.4, F(1168) + k * 0.5, 0.25, 0.0)
cue(F(1168), "sfx: busy tone, the call has ended")
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1250), 0.55, 0.0); cue(F(1250), "sfx: Feeloy chime (phone)")
for f in (1347, 1384, 1424): popb(F(f), 0.45)
cue(F(1347), "sfx: speech-bubble pops (note, dots, heart)")
whoosh(F(1446), 0.5, 0.45); cue(F(1446), "sfx: end-card whoosh")

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
ceil = dbg(-1.6)
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
