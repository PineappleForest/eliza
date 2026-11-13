"""Soundtrack for "Illegal to Be Lonely" (Swiss guinea pig law -> Feeloy), 53.8 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/pigs/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1615
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
# A playful F-major pizzicato/oompah with a tuba for the law beats, a music box for "lonely", a pompous brass chord on
# the law book, a bouncy groove for the owner, a gentle harp when one goes and an alarm stab, a speeding loop for the
# cycle, an Alpine 3/4 oompah waltz (glock tune) for Priska's village, rising chimes when grandpa perks up, a bare night,
# the Feeloy section.
CH = {"F": [53, 57, 60], "Bb": [58, 62, 65], "C": [48, 52, 55], "Dm": [50, 53, 57], "Gm": [55, 58, 62]}
def oompah(f0, f1, prog, mel=None, bpm=120, vel=0.8, waltz=False, inst="pluck"):
    b = 60 / bpm; per = 3 if waltz else 4; t = F(f0); k = 0
    while t < F(f1) - 0.3:
        ch = CH[prog[k % len(prog)]]
        put(mus, I.brass(m2f(ch[0] - 12), 0.18, 0.55 * vel, R, kind="tuba"), t, 0.7)
        for j in range(1, per): put(mus, mx(*[I.pluck(m2f(n + 12), 0.28 * vel, R, 0.25, 0.6) for n in ch]), t + j * b, 0.45, 0.2 * (1 if j % 2 else -1))
        if not waltz: put(mus, I.brass(m2f(ch[2] - 12), 0.18, 0.45 * vel, R, kind="tuba"), t + 2 * b, 0.6)
        for (o, m, d) in (mel[k % len(mel)] if mel else []):
            x = I.glock(m2f(m), 0.4 * vel, R, d * b + 0.6) if inst == "glock" else I.pluck(m2f(m), 0.5 * vel, R, d * b + 0.4, 0.75)
            put(mus, x, t + o * b, 0.65, 0.2)
        t += per * b; k += 1
MEL4 = [[(0, 72, 1), (1, 69, 0.5), (1.5, 72, 0.5), (2, 77, 1)], [(0, 74, 1), (1, 77, 1), (2, 74, 2)], [(0, 72, 1), (1, 76, 1), (2, 79, 1)], [(0, 77, 2), (2, 72, 2)]]
MEL3 = [[(0, 72, 1), (1, 77, 1), (2, 81, 1)], [(0, 79, 2), (2, 77, 1)], [(0, 74, 1), (1, 77, 1), (2, 79, 1)], [(0, 77, 3)]]
oompah(0, 116, ["F", "C", "F", "C"], MEL4, vel=0.75); cue(0.0, "music: playful F oompah")
put(mus, mx(I.brass(m2f(41), 0.3, 0.85, R, kind="tuba"), I.brass(m2f(40), 0.6, 0.85, R, kind="tuba", fall=-3)), F(40), 0.8); cue(F(40), "music: tuba on ILLEGAL")
put(mus, I.pad([m2f(n) for n in (50, 53, 57)], F(186) - F(116), 0.24, R, att=0.4, rel=0.5), F(116), 0.7)
for o, m in [(0, 77), (0.5, 74), (1.0, 72), (1.6, 69)]: put(mus, I.musicbox(m2f(m + 12), 0.36, R, 1.6), F(160) + o, 0.6, 0.15)
cue(F(160), "music: music box on LONELY")
put(mus, mx(I.brass(m2f(53), 0.7, 0.8, R), I.brass(m2f(57), 0.7, 0.75, R), I.brass(m2f(60), 0.7, 0.75, R), I.timpani(m2f(41), 0.6, R, 1.8)), F(191), 0.7); cue(F(191), "music: pompous brass + timpani on the law book")
oompah(276, 334, ["F", "Bb"], [[(0, 77, 1), (1, 81, 1), (2, 84, 2)]], vel=0.7, inst="glock")
oompah(334, 433, ["F", "Dm", "Bb", "C"], MEL4, bpm=126, vel=0.8)
put(mus, mx(I.brass(m2f(46), 0.3, 0.8, R, kind="tuba"), I.brass(m2f(45), 0.3, 0.8, R, kind="tuba")), F(405), 0.7); put(mus, I.brass(m2f(44), 0.7, 0.8, R, kind="tuba", fall=-4), F(416), 0.7)
cue(F(405), "music: wah-wah tuba on DOESN'T COUNT")
put(mus, I.pad([m2f(n) for n in (53, 57, 60, 65)], F(614) - F(433), 0.25, R, att=0.5, rel=0.5), F(433), 0.7)
for k, m in enumerate((77, 81, 84, 89, 93)): put(mus, I.glock(m2f(m), 0.35, R, 1.4), F(517) + k * 0.12, 0.55, 0.2)
put(mus, mx(I.brass(m2f(61), 0.25, 0.85, R), I.brass(m2f(64), 0.25, 0.85, R), I.brass(m2f(67), 0.5, 0.85, R)), F(571), 0.7); cue(F(517), "music: harp sparkle as one goes; alarm stab on BREAKING THE LAW")
t = F(614); b = 0.42
while t < F(697) - 0.2:
    for j, m in enumerate((53, 57, 60, 57)): put(mus, I.pluck(m2f(m + 12), 0.4, R, 0.25, 0.6), t + j * b / 2, 0.55, 0.15)
    t += 2 * b; b = max(0.2, b * 0.9)
cue(F(614), "music: speeding loop (the cycle)")
oompah(697, 1024, ["F", "C", "C", "F", "Bb", "F", "C", "F"], MEL3, bpm=150, vel=0.85, waltz=True, inst="glock"); cue(F(697), "music: Alpine 3/4 oompah waltz (Priska's village)")
put(mus, mx(I.brass(m2f(65), 0.5, 0.8, R), I.brass(m2f(69), 0.5, 0.75, R), I.brass(m2f(72), 0.5, 0.75, R)), F(839), 0.7)
oompah(1024, 1196, ["F", "Dm", "Bb", "C"], [[(0, 77, 2), (2, 76, 1)], [(0, 74, 3)], [(0, 77, 1), (1, 79, 1), (2, 81, 1)], [(0, 79, 3)]], bpm=132, vel=0.7, waltz=True, inst="glock")
for k, m in enumerate((65, 69, 72, 77, 81, 84)): put(mus, I.glock(m2f(m + 12), 0.38, R, 1.2), F(1167) + k * 0.09, 0.55, 0.2)
cue(F(1167), "music: rising chimes as grandpa perks up")
oompah(1196, 1305, ["F", "C", "Bb", "F"], MEL3, bpm=150, vel=0.95, waltz=True, inst="glock")
put(mus, I.cymbal(0.3, R, 2.0), F(1196), 0.35, 0.2)
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(1386) - F(1305), 0.2, R, att=0.8, rel=0.6), F(1305), 0.6)
B0, BEAT2, CARD = F(1386), 60 / 96, 1515
PROG2 = [(53, [65, 69, 72, 77]), (50, [62, 65, 69, 74]), (46, [58, 62, 65, 70]), (48, [60, 64, 67, 72])]
MEL2 = [[(0, 81, 1.5), (2, 79, 1), (3, 77, 1)], [(0, 79, 2), (2.5, 81, 1.5)], [(0, 84, 1), (1, 82, 1), (2, 79, 2)], [(0, 77, 1.5), (2, 81, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: modern Feeloy section (F pad, pluck arps, glock)")
for m, dt in [(65, 0), (69, 0.12), (72, 0.24), (77, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (41, 53, 57, 60, 65)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
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
def outside(t0, t1, g=0.35):
    d = t1 - t0; put(sfx, fades(G.breeze(d, R, 0.5), 0.2, 0.2), t0, g * 0.5); put(sfx, G.bird_chirps(d, R, 0.6), t0, g * 0.8, 0.4)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def wheek(t, g=0.25, p=0.0, up=True):
    """a guinea pig squeak: a fast sine glide with a little warble"""
    d = 0.16; f = np.linspace(1700, 2900, ns(d)) if up else np.linspace(2600, 1500, ns(d)); f = f * (1 + 0.04 * np.sin(2 * np.pi * 38 * tt(d)))
    put(sfx, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(ns(d)), t, g, p)
def boing(t, g=0.25, p=0.0):
    d = 0.22; put(sfx, np.sin(2 * np.pi * np.cumsum(np.linspace(180, 520, ns(d))) / SR) * np.exp(-tt(d) / 0.08), t, g, p)
def cowbell(t, g=0.18, p=0.0): put(sfx, mx(G.clink(R, 560, 0.5, 0.4), G.clink(R, 845, 0.4, 0.3)), t, g, p)
room(0, F(697), 0.09)
wheek(F(8), 0.22, 0.2); wheek(F(44), 0.3, 0.2, up=False)
put(sfx, mx(G.push_thump(R), G.clink(R, 600, 0.15, 0.3)), F(40), 0.8); cue(F(40), "sfx: STAMP + startled squeak")
popb(F(118), 0.35); popb(F(160), 0.35); wheek(F(170), 0.18, 0.1, up=False)
for k in range(6): put(sfx, bp(colored(ns(0.05), R, 0.2), 2000, 8000) * np.hanning(ns(0.05)), F(192) + k * 0.05, 0.12, 0.2)
popb(F(278), 0.4); wheek(F(280), 0.25, 0.3); wheek(F(290), 0.22, -0.2); popb(F(298), 0.35); cue(F(192), "sfx: law book flip; new friend squeaks")
for f in (342, 354): popb(F(f), 0.35)
popb(F(401), 0.35); put(sfx, lp(np.sign(np.sin(2 * np.pi * 110 * tt(0.22))) * 0.4, 1800) * np.hanning(ns(0.22)), F(414), 0.22)
put(sfx, mx(I.triangle(0.35, R, 1.4), I.glock(m2f(93), 0.3, R, 1.2)), F(519), 0.4); cue(F(519), "sfx: soft sparkle as one goes")
for k in range(2): tone_f = 880 if k % 2 else 660; put(sfx, np.sin(2 * np.pi * tone_f * tt(0.18)) * np.hanning(ns(0.18)) * 0.5, F(571) + k * 0.2, 0.25)
popb(F(571), 0.4)
for f in (621, 644, 660, 672): popb(F(f), 0.3, 0.3); wheek(F(f) + 0.05, 0.15, 0.2)
cue(F(621), "sfx: pops + squeaks for each new guinea pig")
outside(F(697), F(889), 0.35)
for k in range(5): cowbell(F(705) + k * 1.3, 0.14, 0.6 * (1 if k % 2 else -1))
cue(F(697), "sfx: birds, breeze, distant cowbells")
for f in (735, 786, 839): popb(F(f), 0.4)
for k in range(10): wheek(F(790 + k * 3), 0.1, 0.4 * ((k % 3) - 1), up=k % 2 == 0)
room(F(889), F(1024), 0.09)
whoosh(F(899), 0.4, 0.3, 0.3); popb(F(913), 0.35); wheek(F(914), 0.22, 0.2); popb(F(915), 0.3)
put(sfx, mx(I.triangle(0.3, R, 1.4), I.glock(m2f(93), 0.25, R, 1.2)), F(960), 0.35); whoosh(F(1000), 0.4, 0.3, 0.4)
cue(F(899), "sfx: suitcase slides in; squeak; soft sparkle; suitcase slides out")
outside(F(1024), F(1305), 0.35)
for k in range(4): cowbell(F(1030) + k * 1.5, 0.12, 0.5 * (1 if k % 2 else -1))
popb(F(1041), 0.4)
for k in range(5): boing(F(1134) + k * 0.1 * 3, 0.2, 0.3)
wheek(F(1167), 0.25, 0.0); wheek(F(1172), 0.22, 0.1); popb(F(1174), 0.35); cue(F(1134), "sfx: hop boings; grandpa's happy squeaks")
for i in range(6): popb(F(1201 + i * 12), 0.3, 0.3 * ((i % 3) - 1)); wheek(F(1203 + i * 12), 0.1, 0.3 * ((i % 3) - 1))
n = ns(DUR - F(1305)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(1305), 0.15)
put(sfx, G.crickets(F(1515) - F(1305), R, 3), F(1305), 0.2, 0.3); cue(F(1305), "sfx: night: crickets, room hum")
popb(F(1338), 0.35)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1386), 0.55, 0.0); cue(F(1386), "sfx: Feeloy chime (phone)")
popb(F(1494), 0.45)
whoosh(F(1515), 0.5, 0.45); cue(F(1515), "sfx: end-card whoosh")
whoosh(F(116), 0.5, 0.6)

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
