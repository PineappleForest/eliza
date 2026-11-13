"""Soundtrack for "The Minister for Loneliness" (UK 2018, Japan 2021 -> Feeloy), 57.9 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/minister/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1736
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
# A mock-pompous brass fanfare for the ministry, then the curious D pentatonic pluck groove (as in the other shorts),
# a koto-ish pentatonic pluck for Japan, a sparse night, the warm Feeloy section and the end-card chord.
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
# hook: a pompous little brass fanfare ... that deflates on "for loneliness"
for (t, m, d) in [(0.15, 50, 0.35), (0.55, 57, 0.35), (0.95, 62, 0.7), (1.8, 57, 0.3), (2.15, 62, 0.3), (2.5, 66, 0.9)]:
    put(mus, I.brass(m2f(m), d, 0.8, R, kind="horn" if m > 55 else "tuba"), t, 0.8, 0.0)
put(mus, I.timpani(m2f(38), 0.7, R), 0.15, 0.7)
for (t, m, d) in [(3.85, 62, 0.25), (4.15, 61, 0.25), (4.45, 59, 0.6)]: put(mus, I.brass(m2f(m - 12), d, 0.7, R, kind="tuba", fall=-3.0), t, 0.8)
cue(0.15, "music: pompous brass fanfare, deflating tuba on 'for loneliness'")
# corridor -> plan: the curious groove
section(153, 660, pad=0.22, vel=0.85); cue(F(153), "music: curious pluck groove")
put(mus, I.timpani(m2f(38), 0.85, R), F(282), 0.9); cue(F(282), "music: timpani hit as the report lands")
for k, m in enumerate([74, 78, 81, 86]): put(mus, I.glock(m2f(m), 0.45, R, 1.0), F(612) + k * 0.4, 0.55, 0.2)
# the GP + the postal worker: lighter, vibes lead, no drums
t = F(660); k = 0
while t < F(960) - 0.3:
    bar(t, PROG[k % 4], None, brush=k % 2 == 1, vel=0.8, pad=0.24)
    for (o, deg, d) in MOTIF[k % 4]: put(mus, I.vibes(m2f(PENT[deg] + 12), 0.4, R, d * BEAT + 0.6), t + o * BEAT, 0.65, 0.2)
    t += 4 * BEAT; k += 1
cue(F(660), "music: vibes section (GP, postal worker)")
# Japan: a koto-ish pentatonic pluck line over a soft pad
put(mus, I.pad([m2f(n) for n in (50, 57, 62, 69)], F(1090) - F(960), 0.22, R, att=0.6, rel=0.6), F(960), 0.6)
for k, (o, m) in enumerate([(0, 74), (0.35, 76), (0.7, 81), (1.4, 79), (1.75, 76), (2.1, 74), (2.8, 69), (3.15, 71), (3.5, 74)]):
    put(mus, I.pluck(m2f(m), 0.55, R, 0.9, 0.9, 0.12), F(966) + o, 0.75, 0.25)
cue(F(966), "music: koto-ish pentatonic line (Japan)")
section(1090, 1276, pad=0.22, vel=0.85); cue(F(1090), "music: groove back (online meeting)")
put(mus, I.pad([m2f(n) for n in (47, 54, 59, 62)], F(1438) - F(1279), 0.26, R, att=0.3, rel=0.8), F(1279), 0.75)
put(mus, I.timpani(m2f(35), 0.9, R), F(1290), 0.9); cue(F(1279), "music: drop to a low chord on 'one very big problem'")
# Feeloy: warm modern section from "Feeloy", resolves on the end card
B0, BEAT2 = F(1462), 60 / 96
PROG2 = [(50, [62, 66, 69, 74]), (47, [59, 62, 66, 71]), (43, [55, 59, 62, 67]), (45, [57, 61, 64, 69])]
MEL2 = [[(0, 78, 1.5), (2, 76, 1), (3, 74, 1)], [(0, 76, 2), (2.5, 78, 1.5)], [(0, 81, 1), (1, 79, 1), (2, 76, 2)], [(0, 74, 1.5), (2, 78, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(1642):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: modern Feeloy section (D pad, pluck arps, glock)")
for m, dt in [(62, 0), (66, 0.12), (69, 0.24), (74, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(1642) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (38, 50, 54, 57, 62)], DUR - F(1642), 0.4, R, att=0.2, rel=1.0), F(1642), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(1642), 0.5, 0.3)
cue(F(1642), "music: end-card chord + music box + triangle")
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
room(0, F(810), 0.09); room(F(960), F(1342), 0.09)
put(sfx, G.creak(0.5, R, 120, 170), F(40), 0.25, -0.2); cue(F(40), "sfx: the big chair creaks")
put(sfx, mx(I.glock(m2f(88), 0.4, R, 0.8), I.triangle(0.25, R, 0.7, 2637)), F(118), 0.35, 0.0); cue(F(118), "sfx: nameplate ding on 'for loneliness'")
whoosh(F(153), 0.5, 0.7); cue(F(153), "sfx: white-flash whoosh")
for k, f in enumerate(range(222, 262, 11)): put(sfx, G.stroll_step(rng(400 + k), 0.4), F(f), 0.35, 0.2)
put(sfx, mx(G.push_thump(R), G.clink(R, 700, 0.2, 0.3)), F(282), 0.7); cue(F(282), "sfx: THUMP, the report lands")
for k in range(16): put(sfx, G.clink(R, 2400 + 40 * k, 0.04, 0.8), F(332) + k * 0.1, 0.15, 0.3)
cue(F(332), "sfx: counter ticks (nine million)")
for k in range(15): popb(F(549) + k * 0.08, 0.22, -0.3 + 0.04 * k)
cue(F(549), "sfx: fifteen little pops (cigarettes)")
for f in (612, 624, 636): squeak(F(f))
cue(F(612), "sfx: marker ticks on the plan")
for f in (719, 753, 787): popb(F(f), 0.4, 0.1); squeak(F(f) - 0.25, 0.25, 0.18)
cue(F(719), "sfx: pen scratch + pop per prescription icon")
outside(F(806), F(966), 0.35)
for k, f in enumerate(range(814, 868, 12)): put(sfx, G.stroll_step(rng(500 + k), 0.4), F(f), 0.35, -0.2)
for f in (870, 876, 882): knock(F(f), 0.45)
put(sfx, G.creak(0.5, R, 90, 140), F(886), 0.3, 0.2); cue(F(870), "sfx: knock knock knock, the door creaks open")
for k in range(5): put(sfx, I.glock(m2f([93, 96, 98, 101, 98][k]), 0.25, R, 1.5), F(970) + k * 0.23, 0.2, 0.3)
cue(F(970), "sfx: wind chime (Japan)")
for k, m in enumerate([76, 81, 76, 81]): put(sfx, I.glock(m2f(m), 0.35, R, 0.4), F(1150) + k * 0.18, 0.35, 0.0)
cue(F(1150), "sfx: video-call ringtone, then connect boop")
popb(F(1176), 0.4)
rumble = lp(colored(ns(2.2), R, 1.0), 160) * np.exp(-tt(2.2) / 0.8) * np.minimum(1, tt(2.2) / 0.05)
put(sfx, rumble, F(1282), 0.9); cue(F(1282), "sfx: thunder rumble under the grey cloud")
n = ns(F(1736) - F(1342)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(1342), 0.15)
put(sfx, G.crickets(F(1642) - F(1342), R, 3), F(1342), 0.22, 0.3)
for k in range(int((F(1445) - F(1342)) / 1.0) + 1): put(sfx, G.clink(R, 3200 if k % 2 else 2600, 0.05, 0.6), F(1342) + k * 1.0, 0.15, -0.4)
cue(F(1342), "sfx: night: crickets, hum, clock ticking")
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1445), 0.55, 0.0); cue(F(1445), "sfx: Feeloy chime (phone)")
for f in (1525, 1560, 1620): popb(F(f), 0.45)
cue(F(1525), "sfx: speech-bubble pops (note, dots, heart)")
whoosh(F(1642), 0.5, 0.45); cue(F(1642), "sfx: end-card whoosh")

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
