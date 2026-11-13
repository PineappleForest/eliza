"""Soundtrack for "The Slow Lane" (Jumbo's chat checkout -> Feeloy), 71.5 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/chat/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 2145
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
# D major pentatonic again (pluck lead, vibes, pluck bass, brushes): a lazy, slow hook; a frantic race that stops dead
# on "But"; a relaxed shop groove; a rising arpeggio as the map fills; a sparse home; the warm Feeloy section.
BEAT = 60 / 92
PENT = [62, 64, 66, 69, 71, 74, 76, 78, 81]
CH = {"D": [62, 66, 69], "G": [55, 59, 62], "Bm": [59, 62, 66], "A": [57, 61, 64], "Em": [52, 55, 59]}
def bar(t0, chord, lead=None, bass=True, brush=True, vel=1.0, pad=0.2, beat=None):
    B = beat or BEAT; root = CH[chord][0] - 12
    if bass:
        for b, off in [(0, 0), (2, 7)]: put(mus, I.pluck(m2f(root + off), 0.7 * vel, R, 0.6, 0.35), t0 + b * B, 0.9, -0.15)
    if brush:
        for b in (1, 3): put(mus, I.brush(0.3 * vel, R), t0 + b * B, 0.7, 0.25)
    put(mus, I.pad([m2f(n) for n in CH[chord]], 4 * B, pad * vel, R, att=0.3, rel=0.5), t0, 0.5)
    for (o, deg, d) in (lead or []):
        put(mus, I.pluck(m2f(PENT[deg] + 12), 0.55 * vel, R, d * B + 0.5, 0.75), t0 + o * B, 0.75, 0.2)
MOTIF = [[(0, 2, 0.5), (0.5, 3, 0.5), (1, 4, 1), (2.5, 3, 0.5), (3, 2, 1)], [(0.5, 1, 0.5), (1, 2, 1), (3, 0, 1)],
         [(0, 4, 0.5), (0.5, 5, 0.5), (1, 6, 1), (2.5, 5, 0.5), (3, 4, 1)], [(1, 3, 1), (2, 2, 2)]]
PROG = ["D", "Bm", "G", "A"]
def section(f0, f1, lead=True, **kw):
    t = F(f0); k = 0
    while t < F(f1) - 0.3:
        bar(t, PROG[k % 4], MOTIF[k % 4] if lead else None, **kw); t += 4 * (kw.get("beat") or BEAT); k += 1
# hook: a lazy, slow pluck line (slow on purpose), vibes underneath
for (t, d) in [(0.2, 2), (0.9, 3), (1.6, 4), (2.6, 3), (3.3, 2), (3.9, 1)]: put(mus, I.pluck(m2f(PENT[d] + 12), 0.55, R, 1.2, 0.7), t, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (62, 66, 69)], F(143), 0.22, R, att=0.6, rel=0.3), 0.0, 0.6); cue(0.2, "music: lazy pluck line (slow on purpose)")
# the race: double-time stabs + hi plucks, stops dead before "But"
t = F(143); k = 0
while t < F(240):
    put(mus, I.pluck(m2f([50, 57, 55, 57][k % 4]), 0.75, R, 0.25, 0.4), t, 0.9, -0.1)
    put(mus, I.pluck(m2f(PENT[(k * 3) % 9] + 12), 0.45, R, 0.2, 0.8), t + 0.11, 0.6, 0.3)
    if k % 2: put(mus, I.brush(0.4, R, 0.15), t, 0.6, 0.25)
    t += 0.215; k += 1
cue(F(143), "music: frantic double-time race (stops dead at 'But')")
# golden quay: vibes, no drums
t = F(244); k = 0
while t < F(402) - 0.3:
    bar(t, PROG[k % 4], None, brush=False, vel=0.8, pad=0.26)
    for (o, deg, d) in MOTIF[k % 4]: put(mus, I.vibes(m2f(PENT[deg] + 12), 0.4, R, d * BEAT + 0.6), t + o * BEAT, 0.7, 0.2)
    t += 4 * BEAT; k += 1
cue(F(244), "music: golden quay (vibes)")
# the shop: relaxed groove; a glock flourish on the Kletskassa sign
for k, m in enumerate([81, 83, 86, 88]): put(mus, I.glock(m2f(m), 0.45, R, 1.2), F(456) + k * 0.09, 0.6, 0.2)
cue(F(456), "music: glock flourish (Kletskassa sign)")
section(402, 1294, pad=0.24, vel=0.85); cue(F(402), "music: relaxed shop groove")
put(mus, I.cymbal(0.3, R, 2.0), F(972), 0.4, 0.2); cue(F(972), "music: cymbal swell on 'loved it'")
for k in range(16): put(mus, I.pluck(m2f(PENT[k % 9] + 12 + (12 if k >= 9 else 0)), 0.4, R, 0.5, 0.8), F(1116) + k * 0.1, 0.5, -0.3 + 0.04 * k)
cue(F(1116), "music: rising arpeggio as the map fills")
# home at dusk: soft pad + vibes; one low chord on "lonely"
t = F(1294); k = 0
while t < F(1460) - 0.3:
    put(mus, I.pad([m2f(n) for n in CH[PROG[k % 4]]], 4 * BEAT + 0.3, 0.28, R, att=0.5, rel=0.6), t, 0.7)
    for (o, deg, d) in MOTIF[(k + 1) % 4][:3]: put(mus, I.vibes(m2f(PENT[deg] + 12), 0.32, R, d * BEAT + 0.8), t + o * BEAT, 0.55, -0.15)
    t += 4 * BEAT; k += 1
put(mus, I.pad([m2f(n) for n in (47, 54, 59, 62)], F(1767) - F(1460), 0.22, R, att=1.2, rel=0.8), F(1460), 0.7)
for k, (o, deg) in enumerate([(0, 4), (0.6, 3), (1.2, 2), (2.4, 3), (3.0, 1)]): put(mus, I.musicbox(m2f(PENT[deg] + 12), 0.3, R, 1.6), F(1500) + o, 0.6, 0.15)
cue(F(1294), "music: home, soft pad + vibes -> one low chord on 'lonely'")
# Feeloy: warm modern section from "Feeloy", resolves on the end card
B0, BEAT2 = F(1798), 60 / 96
PROG2 = [(50, [62, 66, 69, 74]), (47, [59, 62, 66, 71]), (43, [55, 59, 62, 67]), (45, [57, 61, 64, 69])]
MEL2 = [[(0, 78, 1.5), (2, 76, 1), (3, 74, 1)], [(0, 76, 2), (2.5, 78, 1.5)], [(0, 81, 1), (1, 79, 1), (2, 76, 2)], [(0, 74, 1.5), (2, 78, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(2056):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: modern Feeloy section (D pad, pluck arps, glock)")
for m, dt in [(62, 0), (66, 0.12), (69, 0.24), (74, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(2056) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (38, 50, 54, 57, 62)], DUR - F(2056), 0.4, R, att=0.2, rel=1.0), F(2056), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(2056), 0.5, 0.3)
cue(F(2056), "music: end-card chord + music box + triangle")
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
def beep(t, f0=2700, d=0.11, g=0.5, p=0.1):
    x = np.sin(2 * np.pi * f0 * tt(d)) * np.minimum(1, np.minimum(tt(d) / 0.004, (d - tt(d)) / 0.01)); put(sfx, x, t, g, p)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def rustle(t, d=0.35, g=0.35, p=0.3):
    put(sfx, bp(colored(ns(d), R, 0.3), 1500, 7000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 9 * tt(d)))) * np.hanning(ns(d)), t, g, p)
room(0, F(1294), 0.1); murmur(0, F(1294), 0.18); cue(0.0, "sfx: shop room tone + soft murmur")
put(sfx, G.clink(R, 1500, 0.1, 0.6), F(30), 0.2, -0.3)
whoosh(F(143), 0.5, 0.7); cue(F(143), "sfx: white-flash whoosh")
for f in (187, 202): beep(F(f)); cue(F(f), "sfx: scanner BEEP")
rustle(F(215)); cue(F(215), "sfx: bag rustle")
beep(F(227), 1800, 0.07, 0.45); beep(F(229.5), 2400, 0.09, 0.45); cue(F(227), "sfx: card-pay double beep")
put(sfx, mx(G.clink(R, 900, 0.25, 0.4), G.push_thump(R) * 0.6), F(233), 0.5, 0.0); cue(F(233), "sfx: till drawer slam on 'Next!'")
for f in (190, 205, 218): whoosh(F(f), 0.2, 0.3, 0.4)
outside(F(244), F(402), 0.35)
for k, f in enumerate(range(250, 400, 20)): put(sfx, G.stroll_step(rng(300 + k), 0.4), F(f), 0.35, -0.1)
put(sfx, G.clink(R, 2600, 0.35, 0.9), F(402), 0.3, 0.2); cue(F(402), "sfx: shop door bell")
put(sfx, G.clink(R, 1400, 0.12, 0.5), F(552), 0.3, -0.1); cue(F(552), "sfx: banana on the belt")
for f in (748, 762, 783, 813): popb(F(f), 0.4, 0.2 if f % 2 else -0.2)
cue(F(748), "sfx: thought-bubble pops (weather, knees, grandkids, cat)")
put(sfx, G.rattle(1.4, R, 26.0), F(905), 0.3, 0.3); cue(F(905), "sfx: trolley rattle to the next till")
for k in range(24): put(sfx, G.clink(R, 2000 + 60 * k, 0.05, 0.8), F(1118) + k * 0.06, 0.12, -0.4 + 0.035 * k)
cue(F(1118), "sfx: little ticks as the map dots pop in")
put(sfx, G.clink(R, 2400, 0.25, 0.7), F(1240), 0.3, 0.2); put(sfx, G.clink(R, 2100, 0.25, 0.7), F(1262), 0.3, -0.2); cue(F(1240), "sfx: coffee cups clink")
room(F(1294), F(1608), 0.07)
for k in range(int((F(1608) - F(1294)) / 1.0)): put(sfx, G.clink(R, 3200 if k % 2 else 2600, 0.05, 0.6), F(1294) + k * 1.0, 0.18, -0.4)
cue(F(1294), "sfx: kitchen clock ticking")
outside(F(1608), F(1767), 0.25, birds=False)
sh = colored(ns(1.75), R, 0.5); sh = bp(sh, 200, 3000) * (0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 14 * tt(1.75)))) * np.minimum(1, (1.75 - tt(1.75)) / 0.15)
put(sfx, sh, F(1698), 0.4); put(sfx, G.push_thump(R), F(1750), 0.5); cue(F(1698), "sfx: shutter rattles down, thump")
n = ns(F(2145) - F(1767)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(1767), 0.15)
put(sfx, G.crickets(F(2056) - F(1767), R, 3), F(1767), 0.22, 0.3); cue(F(1767), "sfx: night: crickets + room hum")
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1800), 0.55, 0.0); cue(F(1800), "sfx: Feeloy chime (phone)")
for f in (1889, 1934, 1987, 2031): popb(F(f), 0.45)
cue(F(1889), "sfx: speech-bubble pops (cat, question, dots, heart)")
whoosh(F(2056), 0.5, 0.45); cue(F(2056), "sfx: end-card whoosh")

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
