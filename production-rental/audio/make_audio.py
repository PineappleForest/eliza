"""Soundtrack for "Rent a Dad" (Japan's rental families -> Feeloy), 62.2 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/rental/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1866
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
# A light, curious score in D major pentatonic (plucked "koto-ish" lead + vibes, walking pluck bass, brushes),
# with section changes on the picture: wedding chimes, office stop-time, a sting on the proposal, a music-box lullaby
# for the nightlight, then the warm modern Feeloy section and the end-card chord.
BEAT = 60 / 100
PENT = [62, 64, 66, 69, 71, 74, 76, 78, 81]           # D major pentatonic
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
def section(f0, f1, **kw):
    t = F(f0); k = 0
    while t < F(f1) - 0.3:
        bar(t, PROG[k % 4], MOTIF[k % 4] if kw.pop("lead", True) is not False else None, **kw) if False else bar(t, PROG[k % 4], MOTIF[k % 4], **kw)
        t += 4 * BEAT; k += 1
# hook: plucked pentatonic question, then the groove starts on the white flash
for (t, d) in [(0.15, 4), (0.45, 5), (0.75, 6), (1.35, 5), (1.65, 4), (2.25, 3)]: put(mus, I.pluck(m2f(PENT[d] + 12), 0.6, R, 0.8, 0.8), t, 0.9, 0.2)
cue(0.15, "music: plucked pentatonic question (hook)")
section(84, 207); cue(F(84), "music: groove (pluck bass, brushes, pad, pentatonic lead)")
# wedding: chimes + a warm organ-ish pad, a triangle on 'sing', a glock sigh on 'speech'
for k in range(4): put(mus, I.glock(m2f([86, 83, 81, 78][k]), 0.45, R, 1.4), F(207) + k * 0.35, 0.7, 0.3)
section(207, 481, brush=False, pad=0.32); cue(F(207), "music: wedding (chimes, fuller pad)")
put(mus, I.triangle(0.35, R, 1.6), F(318), 0.6, 0.3)
for k, m in enumerate([81, 78, 76]): put(mus, I.glock(m2f(m), 0.35, R, 1.4), F(373) + k * 0.28, 0.6, -0.2)
put(mus, I.cymbal(0.3, R, 2.0), F(441), 0.45, 0.2); cue(F(441), "music: cymbal swell on 'thirty' (all guests wave)")
# office: stop-time stabs on the bows
for f in (491, 540, 602): put(mus, I.timpani(m2f(38), 0.6, R), F(f), 0.8); put(mus, I.pluck(m2f(50), 0.7, R, 0.5), F(f), 0.7)
cue(F(491), "music: office stop-time stabs (bow, 'apologize', 'boss')")
# park, golden: gentle, vibes lead
t = F(620); k = 0
while t < F(760) - 0.3:
    bar(t, PROG[k % 4], None, brush=False, vel=0.8, pad=0.26)
    for (o, deg, d) in MOTIF[k % 4]: put(mus, I.vibes(m2f(PENT[deg] + 12), 0.4, R, d * BEAT + 0.6), t + o * BEAT, 0.7, 0.2)
    t += 4 * BEAT; k += 1
cue(F(620), "music: park, golden (vibes, no drums)")
section(760, 975); cue(F(760), "music: groove back (rules)")
put(mus, I.timpani(m2f(45), 0.85, R), F(980), 1.0); put(mus, I.cymbal(0.5, R, 2.2), F(980), 0.6, -0.2); cue(F(980), "music: STING on 'proposing'")
# apartment: soft pad + vibes, slower
t = F(1005); k = 0
while t < F(1218) - 0.3:
    put(mus, I.pad([m2f(n) for n in CH[PROG[k % 4]]], 4 * BEAT + 0.3, 0.3, R, att=0.5, rel=0.6), t, 0.7)
    for (o, deg, d) in MOTIF[(k + 1) % 4][:3]: put(mus, I.vibes(m2f(PENT[deg] + 12), 0.35, R, d * BEAT + 0.8), t + o * BEAT, 0.6, -0.15)
    t += 4 * BEAT; k += 1
cue(F(1005), "music: apartment, soft pad + vibes")
# nightlight: music-box lullaby
for k, (o, deg) in enumerate([(0, 4), (0.5, 3), (1, 2), (2, 3), (2.5, 2), (3, 0), (4, 2), (4.5, 3), (5, 4), (6, 5), (7, 4)]):
    put(mus, I.musicbox(m2f(PENT[deg] + 12), 0.45, R, 1.6), F(1222) + o * 0.62, 0.8, 0.15)
put(mus, I.pad([m2f(n) for n in (50, 57, 62, 66)], F(1365) - F(1222), 0.2, R, att=1.0, rel=0.6), F(1222), 0.6)
cue(F(1222), "music: music-box lullaby (nightlight)")
# founder: one sustained low chord, nearly nothing
put(mus, I.pad([m2f(n) for n in (47, 54, 59, 62)], F(1484) - F(1365), 0.22, R, att=1.2, rel=0.8), F(1365), 0.7); cue(F(1365), "music: sparse low chord (founder)")
# Feeloy: warm modern section (as in the ELIZA short), resolves on the end card
B0, BEAT2 = F(1484), 60 / 96
PROG2 = [(50, [62, 66, 69, 74]), (47, [59, 62, 66, 71]), (43, [55, 59, 62, 67]), (45, [57, 61, 64, 69])]
MEL2 = [[(0, 78, 1.5), (2, 76, 1), (3, 74, 1)], [(0, 76, 2), (2.5, 78, 1.5)], [(0, 81, 1), (1, 79, 1), (2, 76, 2)], [(0, 74, 1.5), (2, 78, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(1792):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: modern Feeloy section (D pad, pluck arps, glock)")
for m, dt in [(62, 0), (66, 0.12), (69, 0.24), (74, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(1792) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (38, 50, 54, 57, 62)], DUR - F(1792), 0.4, R, att=0.2, rel=1.0), F(1792), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(1792), 0.5, 0.3)
cue(F(1792), "music: end-card chord + music box + triangle")
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
def murmur(t0, t1, g=0.35):
    d = t1 - t0; x = bp(colored(ns(d), R, 0.2), 250, 1600) * (0.6 + 0.4 * np.sin(2 * np.pi * 3.1 * tt(d)) ** 2)
    put(sfx, fades(x, 0.2, 0.3), t0, g)
def ding(t, m=88, g=0.6, p=0.2): put(sfx, mx(I.glock(m2f(m), 0.5, R, 0.8), I.triangle(0.25, R, 0.7, 2637)), t, g, p)
room(0, F(84)); put(sfx, I.glock(m2f(93), 0.4, R, 0.6), F(40), 0.4, 0.1); cue(F(40), "sfx: sparkle on the rental dad's grin")
for k, f in enumerate([4, 22, 40]): put(sfx, G.clink(R, 1600 + 300 * k, 0.15, 0.6), F(f), 0.25, -0.3 + 0.3 * k)  # price tags swinging
whoosh(F(84), 0.5, 0.7); cue(F(84), "sfx: white-flash whoosh")
outside(F(84), F(207), 0.35)
for k, f in enumerate(range(90, 178, 13)): put(sfx, G.stroll_step(rng(200 + k), 0.4), F(f), 0.45, -0.2)
put(sfx, G.clink(R, 3000, 0.08, 1.0), F(192), 0.35, 0.1); cue(F(192), "sfx: watch tick on 'an hour'")
murmur(F(207), F(481), 0.3); cue(F(207), "sfx: wedding hall murmur")
put(sfx, G.applause(1.6, R, 28), F(441), 0.35); cue(F(441), "sfx: applause as all the guests wave")
put(sfx, bp(colored(ns(0.6), R, 0.0), 300, 3000) * np.exp(-tt(0.6) / 0.3), F(380), 0.25, -0.3)  # a sniffle in the speech
room(F(481), F(620))
for f in (491, 540): whoosh(F(f), 0.3, 0.45, -0.2)
cue(F(491), "sfx: bow swishes")
outside(F(620), F(760), 0.35)
put(sfx, G.whoosh(0.2, R, 0.1, 900, 2200) * 0.4, F(729), 0.3)
outside(F(760), F(1005), 0.35)
put(sfx, G.clink(R, 2200, 0.2, 0.8), F(860), 0.3, 0.3); cue(F(860), "sfx: hands meet (soft clink)")
for f in (830, 845): put(sfx, bp(colored(ns(0.14), rng(f), 0.0), 2500, 7000) * np.hanning(ns(0.14)), F(f), 0.25, 0.5)  # pen ticks on the clipboard
put(sfx, mx(I.glock(m2f(96), 0.5, R, 1.0), I.triangle(0.4, R, 1.0, 3136)), F(905), 0.5, -0.2); cue(F(905), "sfx: ring box sparkle")
room(F(1005), F(1218), 0.08)
put(sfx, G.clink(R, 2400, 0.25, 0.7), F(1060), 0.3, -0.2); cue(F(1060), "sfx: teacup clink")
n = ns(F(1365) - F(1218)); put(sfx, fades(np.sin(2 * np.pi * 60 * tt(F(1365) - F(1218))) * 0.02 + lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.3), F(1218), 0.15)
put(sfx, G.crickets(F(1365) - F(1218), R, 3), F(1218), 0.25, 0.3); cue(F(1218), "sfx: night: crickets + room hum")
room(F(1365), F(1484), 0.1); put(sfx, G.clink(R, 1200, 0.3, 0.4), F(1420), 0.15)
outside(F(1484), F(1792), 0.3)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1567), 0.55, 0.0); cue(F(1567), "sfx: Feeloy chime (shows up)")
put(sfx, I.glock(m2f(89), 0.4, R, 0.6), F(1626), 0.35, 0.1)
for f in (1655, 1686): put(sfx, fades(np.sin(2 * np.pi * np.linspace(500, 1100, ns(0.09)) * tt(0.09)) * np.hanning(ns(0.09)), 0.0, 0.01), F(f), 0.45, 0.0)
cue(F(1655), "sfx: speech-bubble pops")
room(F(1752), F(1866), 0.08)
for k, f in enumerate([1756, 1760, 1765, 1769, 1773]): put(sfx, G.clink(R, 2800 + 150 * k, 0.06, 1.0), F(f), 0.25, -0.5 + 0.25 * k)
cue(F(1756), "sfx: five watch ticks (No booking required)")
whoosh(F(1792), 0.5, 0.45); cue(F(1792), "sfx: end-card whoosh")

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
