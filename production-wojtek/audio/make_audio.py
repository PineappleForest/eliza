"""Soundtrack for "Private Wojtek" (the soldier bear -> Feeloy), 30.6 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/wojtek/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 917
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
# A cheeky little military march in B-flat (snare, tuba on the beats, a piccolo-ish glock tune), a tender music box
# for the cub, the march again as he grows, a stamp hit on PRIVATE, a proud brass line at Monte Cassino and a fanfare on
# CORPORAL, then the warm Feeloy section.
def march(f0, f1, bpm=112, vel=0.8, mel=True):
    b = 60 / bpm; t = F(f0); k = 0
    TUNE = [70, 74, 77, 74, 75, 72, 70, 69]
    while t < F(f1) - 0.2:
        put(mus, I.snare(0.5 if k % 2 == 0 else 0.3, R), t, 0.4 * vel, 0.1)
        put(mus, I.brass(m2f(34 if k % 2 == 0 else 41), 0.25, 0.8, R, kind="tuba"), t, 0.55 * vel)
        if mel and k % 2 == 0: put(mus, I.glock(m2f(TUNE[(k // 2) % 8] + 12), 0.4, R, 0.5), t, 0.5 * vel, 0.2)
        t += b; k += 1
march(0, 100); cue(0.0, "music: cheeky little march (snare, tuba, glock tune)")
put(mus, mx(I.brass(m2f(58), 0.5, 0.85, R), I.brass(m2f(62), 0.5, 0.8, R), I.brass(m2f(65), 0.5, 0.8, R)), F(78), 0.6)
put(mus, I.pad([m2f(n) for n in (46, 58, 62, 65)], F(282) - F(100), 0.26, R, att=0.5, rel=0.5), F(100), 0.6)
for k, (o, m) in enumerate([(0, 82), (0.4, 86), (0.8, 89), (1.4, 87), (2.2, 82), (2.6, 86), (3.0, 84)]): put(mus, I.musicbox(m2f(m), 0.45, R, 1.4), F(200) + o, 0.5, 0.25)
cue(F(200), "music: tender music box for the cub")
march(282, 455, bpm=116, vel=0.8); put(mus, mx(I.timpani(m2f(34), 0.7, R, 1.2), I.brass(m2f(58), 0.4, 0.85, R, kind="stab")), F(432), 0.65)
cue(F(282), "music: the march returns as he grows; stab on PRIVATE")
put(mus, I.pad([m2f(n) for n in (39, 51, 55, 58)], F(630) - F(455), 0.28, R, att=0.6, rel=0.5), F(455), 0.65)
march(494, 590, bpm=104, vel=0.7, mel=False)
for k, m in enumerate((58, 62, 65, 70)): put(mus, I.brass(m2f(m), 0.35, 0.8, R), F(466) + k * 0.28, 0.5, 0.15)
for k, (o, m) in enumerate([(0, 70), (0.18, 70), (0.36, 74), (0.6, 77)]): put(mus, I.brass(m2f(m), 0.3 if k < 3 else 0.9, 0.85, R, kind="trumpet") if False else I.brass(m2f(m), 0.3 if k < 3 else 0.9, 0.85, R), F(604) + o, 0.6, 0.1)
put(mus, I.cymbal(0.35, R, 1.8), F(606), 0.35, 0.2); cue(F(604), "music: fanfare on CORPORAL")
put(mus, I.pad([m2f(n) for n in (43, 55, 58, 62)], F(730) - F(630), 0.22, R, att=0.6, rel=0.6), F(630), 0.6)
B0, BEAT2, CARD = F(727), 60 / 96, 821
PROG2 = [(46, [58, 62, 65, 70]), (43, [55, 58, 62, 67]), (39, [51, 55, 58, 63]), (41, [53, 57, 60, 65])]
MEL2 = [[(0, 74, 1.5), (2, 72, 1), (3, 70, 1)], [(0, 74, 2), (2.5, 77, 1.5)], [(0, 79, 1), (1, 77, 1), (2, 74, 2)], [(0, 72, 1.5), (2, 74, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: Feeloy section (B-flat pad, pluck arps, glock)")
for m, dt in [(58, 0), (62, 0.12), (65, 0.24), (70, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (46, 58, 62, 65, 70)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
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
def growl(t, d=0.5, g=0.3):
    n = ns(d); f = 90 + 25 * np.sin(np.linspace(0, 6, n)); x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * (0.6 + 0.4 * colored(n, R, 1.0))
    put(sfx, fades(lp(x, 900) * np.hanning(n), 0.02, 0.1), t, g, 0.2)
put(sfx, G.breeze(F(455), R, 1.0, gust=0.3, bright=700), 0, 0.15); cue(0.0, "sfx: camp wind")
popb(F(78), 0.45); growl(F(74), 0.4, 0.25)
popb(F(108), 0.35); popb(F(172), 0.35); popb(F(200), 0.4); growl(F(230), 0.3, 0.15); popb(F(252), 0.45)
cue(F(200), "sfx: the cub appears, a tiny growl")
for k in range(4): put(sfx, G.boot(R, 0.5), F(300) + k * 0.4, 0.15, -0.2)
growl(F(318), 0.4, 0.2); popb(F(332), 0.3)
popb(F(388), 0.35); popb(F(403), 0.35); put(sfx, mx(G.push_thump(R), G.clink(R, 600, 0.15, 0.3)), F(432), 0.7); cue(F(432), "sfx: PRIVATE stamp")
for t0, g in [(0.4, 0.25), (1.9, 0.18), (3.6, 0.22), (5.0, 0.15)]: put(sfx, fades(lp(colored(ns(1.2), R, 1.0), 120) * np.exp(-np.arange(ns(1.2)) / SR * 3), 0.0, 0.3), F(455) + t0, g, -0.4)
cue(F(455), "sfx: distant artillery rumbles at Monte Cassino")
popb(F(466), 0.4)
for k in range(10): put(sfx, G.boot(R, 0.6), F(494) + k * 0.4, 0.14, 0.2)
put(sfx, G.creak(0.3, R, 140, 100), F(496), 0.15); popb(F(564), 0.3); popb(F(592), 0.4); popb(F(606), 0.45)
n = ns(DUR - F(630)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(630), 0.15)
put(sfx, G.crickets(F(821) - F(630), R, 3), F(630), 0.12, 0.3); popb(F(645), 0.3); cue(F(630), "sfx: night room, crickets")
put(sfx, mx(I.glock(m2f(82), 0.5, R, 0.8), I.glock(m2f(89), 0.4, R, 0.8)), F(754), 0.55, 0.0); cue(F(754), "sfx: Feeloy chime (phone)")
popb(F(795), 0.45)
whoosh(F(821), 0.5, 0.45); cue(F(821), "sfx: end-card whoosh")
whoosh(F(100), 0.5, 0.6)

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
