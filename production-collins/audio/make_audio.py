"""Soundtrack for "The Loneliest Man in History" (Michael Collins -> Feeloy), 33.3 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/collins/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 998
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
# A wide, slow space pad in E minor with a sparse glock "star" line, a brighter lift on the Moon walk, the pad thinning
# to a single held note behind the Moon (radio silence), a warm turn to E major when he says he wasn't lonely, the
# Feeloy section, the end card.
put(mus, I.pad([m2f(n) for n in (40, 52, 59, 64, 67)], F(305) + 0.4, 0.32, R, att=1.0, rel=0.6), 0, 0.75); cue(0.0, "music: wide E-minor space pad")
for k, (o, m) in enumerate([(0.6, 76), (1.6, 79), (2.6, 83), (3.4, 81)]): put(mus, I.glock(m2f(m), 0.35, R, 1.6), o, 0.5, 0.3 * ((k % 3) - 1))
put(mus, mx(I.brass(m2f(52), 0.6, 0.8, R), I.brass(m2f(59), 0.6, 0.75, R), I.brass(m2f(64), 0.6, 0.75, R)), F(80), 0.55)
for k, m in enumerate((64, 67, 71, 76)): put(mus, I.vibes(m2f(m), 0.4, R, 1.4), F(152) + k * 0.25, 0.5, 0.2)
put(mus, I.triangle(0.3, R, 1.6), F(171), 0.35, 0.3); cue(F(152), "music: a bright lift for the Moon walk")
for k, (o, m) in enumerate([(0, 71), (0.8, 74), (1.6, 76)]): put(mus, I.glock(m2f(m), 0.35, R, 1.4), F(228) + o, 0.45, 0.2)
put(mus, I.pad([m2f(n) for n in (40, 47, 52)], F(470) - F(305), 0.25, R, att=0.4, rel=0.5), F(305), 0.6)
put(mus, mx(I.vibes(m2f(71), 0.35, R, 2.4), I.timpani(m2f(40), 0.5, R, 1.6)), F(391), 0.55); cue(F(305), "music: thins to a bare low pad behind the Moon (radio silence)")
put(mus, I.pad([m2f(n) for n in (40, 52, 55, 59)], F(560) - F(465), 0.28, R, att=0.5, rel=0.5), F(465), 0.65)
put(mus, I.pad([m2f(n) for n in (44, 56, 59, 64, 68)], F(700) - F(560), 0.3, R, att=0.6, rel=0.6), F(560), 0.7)
for k, (f, m) in enumerate([(585, 76), (600, 80), (620, 83), (642, 88)]): put(mus, I.musicbox(m2f(m), 0.45, R, 1.6), F(f), 0.6, 0.25)
cue(F(560), "music: warm turn to E major (he wasn't lonely)")
put(mus, I.pad([m2f(n) for n in (40, 52, 56, 59)], F(812) - F(690), 0.22, R, att=0.6, rel=0.6), F(690), 0.6)
B0, BEAT2, CARD = F(809), 60 / 96, 902
PROG2 = [(40, [52, 56, 59, 64]), (37, [49, 52, 56, 61]), (33, [45, 49, 52, 57]), (35, [47, 51, 54, 59])]
MEL2 = [[(0, 76, 1.5), (2, 75, 1), (3, 73, 1)], [(0, 73, 2), (2.5, 76, 1.5)], [(0, 80, 1), (1, 78, 1), (2, 76, 2)], [(0, 71, 1.5), (2, 75, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: Feeloy section (E pad, pluck arps, glock)")
for m, dt in [(52, 0), (56, 0.12), (59, 0.24), (64, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (40, 52, 56, 59, 64)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(CARD), 0.5, 0.3)
cue(F(CARD), "music: end-card chord + music box + triangle")
ir = make_ir(2.0, 11, hf=0.7)
mus = mus * 0.75 + convolve_st(mus, ir)[:, :N] * 0.25
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def radio(t0, t1, g=0.12):
    n = ns(t1 - t0); x = colored(n, R, 0.0) * 0.4 + 0.3 * np.sin(2 * np.pi * 1200 * np.arange(n) / SR) * (np.sin(2 * np.pi * 3 * np.arange(n) / SR) > 0.6)
    put(sfx, fades(lp(x, 3000), 0.05, 0.05), t0, g, -0.3)
def beep(t, g=0.2): put(sfx, fades(np.sin(2 * np.pi * 2500 * np.arange(ns(0.18)) / SR), 0.005, 0.03), t, g, 0.3)
put(sfx, fades(lp(colored(ns(F(465)), R, 1.0), 160) * 0.5, 0.5, 0.5), 0, 0.2); cue(0.0, "sfx: low cabin hum in space")
popb(F(4), 0.4); popb(F(80), 0.45)
beep(F(170)); radio(F(170), F(222), 0.06); popb(F(238), 0.35)
cue(F(170), "sfx: Quindar beep and radio chatter on the Moon walk")
radio(F(305), F(388), 0.1); beep(F(330)); put(sfx, mx(G.push_thump(R), G.clink(R, 400, 0.1, 0.3)), F(388), 0.4); popb(F(392), 0.4)
cue(F(388), "sfx: the radio cuts out")
for k in range(10): put(sfx, G.clink(R, 1400, 0.04, 0.4), F(418) + k * 0.06, 0.06, 0.3)
put(sfx, fades(lp(colored(ns(F(690) - F(465)), R, 1.0), 300) * 0.4, 0.3, 0.3), F(465), 0.12)
popb(F(494), 0.45); popb(F(584), 0.35); popb(F(642), 0.3)
n = ns(DUR - F(690)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(690), 0.15)
put(sfx, G.crickets(F(902) - F(690), R, 3), F(690), 0.12, 0.3); popb(F(734), 0.3); cue(F(690), "sfx: night room, crickets")
put(sfx, mx(I.glock(m2f(88), 0.5, R, 0.8), I.glock(m2f(95), 0.4, R, 0.8)), F(837), 0.55, 0.0); cue(F(837), "sfx: Feeloy chime (phone)")
popb(F(871), 0.45)
whoosh(F(902), 0.5, 0.45); cue(F(902), "sfx: end-card whoosh")
whoosh(F(150), 0.5, 0.6)

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
