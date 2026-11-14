"""Soundtrack for "Happy to Chat" (the chat bench -> Feeloy), 26.7 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/bench/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 801
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
# A gentle seaside G-major ukulele-ish pluck: alone at first (sparse), the groove fills in when the sign goes on, a glock
# per pin on the map, a soft pad for the flat, the Feeloy section, the end card.
CH = {"G": [55, 59, 62], "Em": [52, 55, 59], "C": [48, 52, 55], "D": [50, 54, 57]}
def groove(f0, f1, prog, bpm=104, vel=0.8, full=True):
    b = 60 / bpm; t = F(f0); k = 0
    while t < F(f1) - 0.3:
        ch = CH[prog[k % len(prog)]]
        put(mus, I.pluck(m2f(ch[0] - 12), 0.7 * vel, R, 1.2, 0.3), t, 0.85, -0.1)
        for j in range(8 if full else 4): put(mus, I.pluck(m2f(ch[j % 3] + 12), 0.3 * vel, R, 0.4, 0.6), t + j * b / (2 if full else 1), 0.5, 0.3 * (1 if j % 2 else -1))
        if full: put(mus, I.brush(0.35 * vel, R), t + b, 0.3, 0.2); put(mus, I.brush(0.35 * vel, R), t + 3 * b, 0.3, 0.2)
        t += 4 * b; k += 1
groove(0, 190, ["Em", "C", "G", "D"], vel=0.65, full=False); cue(0.0, "music: sparse seaside pluck (alone)")
for o, m in [(0, 71), (0.5, 74), (1.0, 76)]: put(mus, I.vibes(m2f(m), 0.35, R, 1.4), F(72) + o, 0.45, 0.2)
for k, m in enumerate((67, 71, 74, 79)): put(mus, I.glock(m2f(m + 12), 0.45, R, 1.0), F(190) + k * 0.07, 0.55, 0.2)
groove(190, 512, ["G", "Em", "C", "D"], vel=0.85); cue(F(190), "music: the groove fills in when the sign goes on")
for f in (433, 451, 482): put(mus, I.glock(m2f(86), 0.4, R, 0.9), F(f), 0.5, 0.25)
put(mus, I.pad([m2f(n) for n in (40, 52, 55, 59)], F(616) - F(512), 0.22, R, att=0.5, rel=0.6), F(512), 0.6)
B0, BEAT2, CARD = F(614), 60 / 96, 705
PROG2 = [(43, [55, 59, 62, 67]), (40, [52, 55, 59, 64]), (36, [48, 52, 55, 60]), (38, [50, 54, 57, 62])]
MEL2 = [[(0, 74, 1.5), (2, 71, 1), (3, 74, 1)], [(0, 76, 2), (2.5, 74, 1.5)], [(0, 79, 1), (1, 76, 1), (2, 74, 2)], [(0, 71, 1.5), (2, 74, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: Feeloy section (G pad, pluck arps, glock)")
for m, dt in [(55, 0), (59, 0.12), (62, 0.24), (67, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (43, 55, 59, 62, 67)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(CARD), 0.5, 0.3)
cue(F(CARD), "music: end-card chord + music box + triangle")
ir = make_ir(1.1, 11, hf=0.8)
mus = mus * 0.82 + convolve_st(mus, ir)[:, :N] * 0.18
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def gull(t, g=0.15, p=0.0):
    d = 0.35; f = np.r_[np.linspace(1500, 2300, ns(0.1)), np.linspace(2300, 1300, ns(d) - ns(0.1))]
    put(sfx, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(ns(d)) * (1 + 0.3 * np.sin(2 * np.pi * 30 * tt(d))), t, g, p)
put(sfx, G.water_bed(F(512), R, 0.6, 0.5), 0, 0.22); put(sfx, G.breeze(F(512), R, 1.0, gust=0.3, bright=900), 0, 0.15)
for t0 in (0.6, 3.3, 7.9, 12.6, 15.2): gull(t0, 0.12, 0.5 * (1 if t0 > 5 else -1))
cue(0.0, "sfx: seaside: waves, wind, gulls")
popb(F(70), 0.35); popb(F(113), 0.4)
for k in range(6): put(sfx, G.boot(R, 0.4), F(120) + k * 0.42, 0.15, 0.4)
whoosh(F(160), 0.3, 0.2); put(sfx, mx(G.push_thump(R), G.clink(R, 900, 0.1, 0.3)), F(190), 0.4); popb(F(190), 0.4)
cue(F(190), "sfx: the sign goes on")
for k in range(4): put(sfx, G.stroll_step(R, 0.5), F(338) + k * 0.25, 0.14, 0.4)
put(sfx, G.creak(0.3, R, 160, 120), F(358), 0.15); popb(F(362), 0.4); popb(F(380), 0.3)
put(sfx, G.babble(1.2, R, 300, 1.4, rate=5.0, active=0.7), F(362), 0.08)
popb(F(402), 0.35)
for f in (433, 451, 482): popb(F(f), 0.4, 0.3)
n = ns(DUR - F(512)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(512), 0.15)
put(sfx, G.crickets(F(705) - F(512), R, 3), F(512), 0.12, 0.3); popb(F(526), 0.3); cue(F(512), "sfx: night room, crickets")
put(sfx, mx(I.glock(m2f(83), 0.5, R, 0.8), I.glock(m2f(90), 0.4, R, 0.8)), F(640), 0.55, 0.0); cue(F(640), "sfx: Feeloy chime (phone)")
popb(F(669), 0.45)
whoosh(F(705), 0.5, 0.45); cue(F(705), "sfx: end-card whoosh")
whoosh(F(108), 0.5, 0.6)

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
