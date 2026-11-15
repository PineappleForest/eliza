"""Soundtrack for "The Swan Who Loved a Boat" (Petra -> Feeloy), 30.3 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/swan/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 908
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
# A lilting F-major waltz on the lake (pluck bass, vibes tune, glock sparkles) - a little love song - with a pluck
# "hiss" sting, a wintry music box when the snow comes, the waltz warmly back for TOGETHER, then the Feeloy section.
cF, cBb, cC, cDm = [53, 57, 60], [58, 62, 65], [48, 52, 55], [50, 53, 57]
WALTZ = [[(0, 72, 2), (2, 74, 1)], [(0, 77, 3)], [(0, 76, 2), (2, 74, 1)], [(0, 72, 3)]]
def waltz(f0, f1, prog, vel=0.8):
    b = 60 / 132; t = F(f0); k = 0
    while t < F(f1) - 0.3:
        ch = prog[k % len(prog)]
        put(mus, I.pluck(m2f(ch[0] - 12), 0.65 * vel, R, 1.0, 0.3), t, 0.8, -0.1)
        for j in (1, 2): put(mus, I.pluck(m2f(ch[j % 3] + 12), 0.3 * vel, R, 0.4, 0.6), t + j * b, 0.5, 0.3 * (1 if j % 2 else -1))
        for (o, m, d) in WALTZ[k % 4]: put(mus, I.vibes(m2f(m), 0.42 * vel, R, d * b + 0.4), t + o * b, 0.55, 0.15)
        t += 3 * b; k += 1
waltz(0, 442, [cF, cBb, cC, cF, cDm, cBb, cC, cF]); cue(0.0, "music: a lilting F-major lake waltz (a little love song)")
for k, m in enumerate((84, 88, 91)): put(mus, I.glock(m2f(m), 0.4, R, 1.0), F(58) + k * 0.08, 0.5, 0.25)
for k, m in enumerate((84, 88, 91)): put(mus, I.glock(m2f(m), 0.4, R, 1.0), F(192) + k * 0.08, 0.5, 0.25)
put(mus, mx(I.brass(m2f(49), 0.18, 0.8, R, kind="stab"), I.brass(m2f(55), 0.18, 0.8, R, kind="stab")), F(388), 0.55); cue(F(388), "music: a sting on HISS")
put(mus, I.pad([m2f(n) for n in (41, 53, 57, 60)], F(530) - F(442), 0.26, R, att=0.6, rel=0.5), F(442), 0.65)
for k, m in enumerate((84, 81, 77, 76, 72)): put(mus, I.musicbox(m2f(m), 0.4, R, 1.4), F(446) + k * 0.55, 0.5, 0.25 * ((k % 3) - 1))
cue(F(442), "music: wintry music box")
waltz(528, 630, [cF, cBb, cC, cF], vel=0.9); put(mus, mx(I.glock(m2f(89), 0.5, R, 1.2), I.triangle(0.3, R, 1.4)), F(595), 0.55)
put(mus, I.pad([m2f(n) for n in (45, 53, 57, 60)], F(722) - F(628), 0.22, R, att=0.6, rel=0.6), F(628), 0.6)
B0, BEAT2, CARD = F(720), 60 / 96, 812
PROG2 = [(41, [53, 57, 60, 65]), (38, [50, 53, 57, 62]), (46, [58, 62, 65, 70]), (48, [55, 60, 64, 67])]
MEL2 = [[(0, 77, 1.5), (2, 76, 1), (3, 72, 1)], [(0, 74, 2), (2.5, 77, 1.5)], [(0, 81, 1), (1, 79, 1), (2, 77, 2)], [(0, 76, 1.5), (2, 79, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: Feeloy section (F pad, pluck arps, glock)")
for m, dt in [(53, 0), (57, 0.12), (60, 0.24), (65, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (41, 53, 57, 60, 65)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
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
def honk(t, g=0.25, p=0.0):
    d = 0.22; f = 420 * (1 - 0.15 * np.linspace(0, 1, ns(d))); x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5
    put(sfx, fades(lp(x, 1600) * np.hanning(ns(d)), 0.01, 0.05), t, g, p)
put(sfx, G.water_bed(F(442), R, 0.5, 0.5), 0, 0.18); put(sfx, G.bird_chirps(F(442), R, 0.4), 0, 0.08, 0.4)
cue(0.0, "sfx: lapping water, birds")
popb(F(58), 0.35); honk(F(60), 0.2, -0.3)
popb(F(113), 0.35); popb(F(177), 0.35); honk(F(194), 0.22, -0.3); popb(F(194), 0.3); popb(F(280), 0.35)
for k in range(int((F(400) - F(314)) / 0.45)): put(sfx, G.bubbles(0.2, R, 0.6), F(314) + k * 0.45, 0.06, 0.2)
honk(F(388), 0.35); put(sfx, G.whoosh(0.3, R, peak=0.15), F(388), 0.2); cue(F(388), "sfx: HISS and flap")
put(sfx, G.breeze(F(528) - F(442), R, 1.0, gust=0.4, bright=600), F(442), 0.3); cue(F(442), "sfx: winter wind")
put(sfx, G.breeze(F(628) - F(528), R, 1.0, gust=0.2, bright=700), F(528), 0.12); put(sfx, G.water_bed(F(628) - F(528), R, 0.4, 0.4), F(528), 0.1)
for f in (560, 575, 595, 600): popb(F(f), 0.3, 0.2)
honk(F(580), 0.18)
n = ns(DUR - F(628)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(628), 0.15)
put(sfx, G.crickets(F(812) - F(628), R, 3), F(628), 0.12, 0.3); popb(F(642), 0.3); cue(F(628), "sfx: night room, crickets")
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(747), 0.55, 0.0); cue(F(747), "sfx: Feeloy chime (phone)")
popb(F(781), 0.45)
whoosh(F(812), 0.5, 0.45); cue(F(812), "sfx: end-card whoosh")
whoosh(F(108), 0.5, 0.5)

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
