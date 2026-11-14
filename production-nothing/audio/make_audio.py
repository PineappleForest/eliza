"""Soundtrack for "Rent Me. I'll Do Nothing." (Shoji Morimoto -> Feeloy), 41.7 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/nothing/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1250
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
# A laid-back C-major pluck groove for the Tokyo street, a wah tuba on NOTHING, a glock pop per request, a grey minor
# pad for the office with a brass stab on FIRED and a sad tuba on USELESS, the groove back for the new job (finish line,
# the train loop with a climbing glock to 17 hours, the station), a soft cafe pad, warm golden music box on the bench,
# the Feeloy section.
CH = {"C": [48, 52, 55], "Am": [45, 48, 52], "F": [53, 57, 60], "G": [55, 59, 62], "Dm": [50, 53, 57], "Em": [52, 55, 59]}
def groove(f0, f1, prog, mel=None, bpm=104, vel=0.8):
    b = 60 / bpm; t = F(f0); k = 0
    while t < F(f1) - 0.3:
        ch = CH[prog[k % len(prog)]]
        put(mus, I.pluck(m2f(ch[0] - 12), 0.7 * vel, R, 1.2, 0.3), t, 0.85, -0.1)
        put(mus, I.brush(0.4 * vel, R), t + b, 0.35, 0.2); put(mus, I.brush(0.4 * vel, R), t + 3 * b, 0.35, 0.2)
        for j in range(8): put(mus, I.pluck(m2f(ch[j % 3] + 12), 0.3 * vel, R, 0.4, 0.6), t + j * b / 2, 0.5, 0.3 * (1 if j % 2 else -1))
        for (o, m, d) in (mel[k % len(mel)] if mel else []): put(mus, I.vibes(m2f(m), 0.42 * vel, R, d * b + 0.6), t + o * b, 0.6, 0.15)
        t += 4 * b; k += 1
MEL = [[(0, 76, 1), (1, 79, 1), (2, 84, 2)], [(0, 81, 1.5), (2, 79, 2)], [(0, 77, 1), (1, 76, 1), (2, 74, 2)], [(0, 74, 1), (1, 79, 3)]]
groove(0, 183, ["C", "Am", "F", "G"], MEL, vel=0.75); cue(0.0, "music: laid-back C pluck groove + vibes (Tokyo street)")
put(mus, mx(I.brass(m2f(36), 0.25, 0.85, R, kind="tuba"), I.brass(m2f(35), 0.6, 0.85, R, kind="tuba", fall=-3)), F(92), 0.75); cue(F(92), "music: wah tuba on NOTHING")
for k, (x, y, f0) in enumerate([(0, 0, 128), (0, 0, 134), (0, 0, 140), (0, 0, 146), (0, 0, 152), (0, 0, 158), (0, 0, 164), (0, 0, 168)]): put(mus, I.glock(m2f(72 + [0, 2, 4, 5, 7, 9, 11, 12][k]), 0.35, R, 0.7), F(f0), 0.5, 0.3 * ((k % 3) - 1))
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(362) - F(183), 0.25, R, att=0.5, rel=0.5), F(183), 0.7)
for k, m in enumerate((69, 67, 64, 62)): put(mus, I.vibes(m2f(m), 0.3, R, 1.6), F(200) + k * 0.9, 0.45, 0.2)
put(mus, mx(I.brass(m2f(49), 0.25, 0.9, R, kind="stab"), I.brass(m2f(52), 0.25, 0.9, R, kind="stab"), I.brass(m2f(55), 0.5, 0.9, R, kind="stab"), I.timpani(m2f(37), 0.7, R, 1.4)), F(256), 0.7)
put(mus, mx(I.brass(m2f(40), 0.3, 0.8, R, kind="tuba"), I.brass(m2f(39), 0.3, 0.8, R, kind="tuba")), F(337), 0.7); put(mus, I.brass(m2f(38), 0.7, 0.8, R, kind="tuba", fall=-4), F(348), 0.7)
cue(F(183), "music: grey A-minor office pad; stab on FIRED; sad tuba on USELESS")
groove(362, 655, ["C", "F", "G", "C", "Am", "F", "G", "C"], MEL, bpm=116, vel=0.85); cue(F(362), "music: groove back, brighter (the new job)")
for k, m in enumerate((72, 76, 79, 84)): put(mus, I.glock(m2f(m), 0.45, R, 1.0), F(391) + k * 0.07, 0.55, 0.2)
for k in range(9): put(mus, I.glock(m2f(72 + [0, 2, 4, 5, 7, 9, 11, 12, 14][k]), 0.35, R, 0.6), F(562) + k * 0.075, 0.5, 0.25)
put(mus, I.cymbal(0.3, R, 1.6), F(584), 0.3, 0.2)
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64)], F(763) - F(655), 0.24, R, att=0.5, rel=0.5), F(655), 0.7)
for k, (o, m) in enumerate([(0, 76), (0.6, 74), (1.2, 72), (2.4, 69), (3.0, 72)]): put(mus, I.pluck(m2f(m), 0.4, R, 0.8, 0.6), F(660) + o, 0.5, 0.2)
put(mus, mx(I.glock(m2f(84), 0.4, R, 1.2), I.glock(m2f(88), 0.35, R, 1.2)), F(741), 0.55); cue(F(655), "music: soft cafe pad; a relieved chime")
put(mus, I.pad([m2f(n) for n in (41, 53, 57, 60, 64)], F(960) - F(763), 0.3, R, att=0.6, rel=0.6), F(763), 0.75)
for k, (f, m) in enumerate([(770, 76), (800, 77), (830, 81), (870, 76), (900, 74), (924, 79), (935, 84)]): put(mus, I.musicbox(m2f(m), 0.45, R, 1.6), F(f), 0.6, 0.3 * ((k % 3) - 1))
cue(F(763), "music: warm golden pad + music box (the bench)")
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(990) - F(960), 0.2, R, att=0.5, rel=0.6), F(960), 0.6)
B0, BEAT2, CARD = F(987), 60 / 96, 1154
PROG2 = [(48, [60, 64, 67, 72]), (45, [57, 60, 64, 69]), (41, [53, 57, 60, 65]), (43, [55, 59, 62, 67])]
MEL2 = [[(0, 76, 1.5), (2, 74, 1), (3, 72, 1)], [(0, 74, 2), (2.5, 76, 1.5)], [(0, 79, 1), (1, 77, 1), (2, 74, 2)], [(0, 72, 1.5), (2, 76, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: modern Feeloy section (C pad, pluck arps, glock)")
for m, dt in [(60, 0), (64, 0.12), (67, 0.24), (72, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (36, 48, 52, 55, 60)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(CARD), 0.5, 0.3)
cue(F(CARD), "music: end-card chord + music box + triangle")
ir = make_ir(1.1, 11, hf=0.8)
mus = mus * 0.82 + convolve_st(mus, ir)[:, :N] * 0.18
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def room(t0, t1, g=0.1):
    n = ns(t1 - t0); put(sfx, fades(lp(colored(n, R, 1.0), 700) * 0.4, 0.15, 0.15), t0, g)
def street(t0, t1, g=0.3):
    d = t1 - t0; put(sfx, fades(lp(colored(ns(d), R, 1.0), 500) * 0.5, 0.2, 0.2), t0, g * 0.6)
    put(sfx, fades(G.babble(d, R, 260, 1.3, rate=4.0, active=0.4), 0.2, 0.2), t0, g * 0.25, 0.3)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def ding(t, g=0.2, p=0.0): put(sfx, mx(G.clink(R, 1800, 0.25, 0.6), G.clink(R, 2400, 0.2, 0.4)), t, g, p)
street(0, F(183), 0.3); cue(0.0, "sfx: street hum and distant chatter")
popb(F(40), 0.35); popb(F(92), 0.45)
for f in (128, 134, 140, 146, 152, 158, 164, 168): ding(F(f), 0.16, 0.4 * ((f % 3) - 1))
cue(F(128), "sfx: a message ding per request")
room(F(183), F(362), 0.1); put(sfx, G.babble(F(362) - F(190), R, 240, 1.2, rate=3.5, active=0.25), F(190), 0.04)
popb(F(190), 0.35); put(sfx, mx(G.push_thump(R), G.clink(R, 600, 0.15, 0.3)), F(256), 0.8); cue(F(256), "sfx: FIRED stamp")
popb(F(335), 0.4)
street(F(362), F(500), 0.28); whoosh(F(391), 0.35, 0.35); popb(F(391), 0.45)
put(sfx, G.applause(1.8, R, 20), F(484), 0.12)
for k in range(8): put(sfx, G.stroll_step(R, 0.3), F(452) + k * 0.16, 0.12, -0.3)
cue(F(452), "sfx: runner's steps; a small cheer at the finish")
room(F(500), F(603), 0.18)
for k in range(int((F(603) - F(500)) / 0.55)):
    t = F(500) + k * 0.55; put(sfx, G.clink(R, 180, 0.08, 0.2), t, 0.18); put(sfx, G.clink(R, 160, 0.08, 0.2), t + 0.12, 0.14)
popb(F(538), 0.35); popb(F(584), 0.4); cue(F(500), "sfx: train hum and rail clacks")
room(F(603), F(655), 0.1)
for k, m in enumerate((79, 76, 72, 74, 79)): put(sfx, I.glock(m2f(m), 0.3, R, 0.5), F(605) + k * 0.18, 0.25, 0.4)
put(sfx, fades(lp(colored(ns(1.8), R, 1.0), 260), 0.5, 0.6), F(616), 0.45, -0.3); popb(F(633), 0.3)
cue(F(605), "sfx: platform chime; the train pulls away")
room(F(655), F(763), 0.08); put(sfx, G.babble(F(763) - F(655), R, 280, 1.3, rate=4.0, active=0.3), F(655), 0.05)
for t0 in (2.0, 4.6): put(sfx, G.clink(R, 2600, 0.12, 0.5), F(655) + t0, 0.12, -0.4)
whoosh(F(720), 0.25, 0.15); popb(F(744), 0.3); cue(F(655), "sfx: cafe murmur, cup clinks, papers slide")
street(F(763), F(960), 0.2); put(sfx, G.bird_chirps(F(960) - F(763), R, 0.4), F(763), 0.15, 0.4)
popb(F(790), 0.3); popb(F(830), 0.35)
for k in range(5): put(sfx, G.stroll_step(R, 0.5), F(890) + k * 0.5, 0.15, -0.4)
popb(F(922), 0.4); popb(F(935), 0.35); cue(F(763), "sfx: golden street, birds; his footsteps")
n = ns(DUR - F(960)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(960), 0.15)
put(sfx, G.crickets(F(1154) - F(960), R, 3), F(960), 0.15, 0.3); cue(F(960), "sfx: night: room hum, crickets")
popb(F(966), 0.3)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1015), 0.55, 0.0); cue(F(1015), "sfx: Feeloy chime (phone)")
popb(F(1118), 0.45)
whoosh(F(1154), 0.5, 0.45); cue(F(1154), "sfx: end-card whoosh")
whoosh(F(120), 0.5, 0.6)

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
