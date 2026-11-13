"""Soundtrack for "Asked to Leave the Room" (ELIZA -> Feeloy), 62.0 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/eliza/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1860
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
BEAT = 60 / 104
T0 = F(158)                         # the groove starts on the white flash
bar_t = lambda b: T0 + b * 4 * BEAT
# F major: F Dm Bb C | F Dm Gm C ...
PROG = [(53, [65, 69, 72]), (50, [62, 65, 69]), (46, [62, 65, 70]), (48, [64, 67, 72]),
        (53, [65, 69, 72]), (50, [62, 65, 69]), (43, [62, 67, 70]), (48, [64, 67, 72])]
THEME = [  # (beat offset in bar, midi, beats) -- a curious, tip-toe vibes tune, mostly in the gaps of the voice
    [(0, 72, 1), (1.5, 74, 0.5), (2, 77, 1), (3, 76, 1)], [(0.5, 74, 0.5), (1, 72, 1), (3, 69, 1)],
    [(0, 70, 1), (1, 72, 0.5), (1.5, 74, 0.5), (2, 77, 2)], [(1, 76, 0.5), (1.5, 74, 0.5), (2, 72, 2)],
]
# hook (0 .. 4.8 s): music box asks a question, stops dead on the door slam
for (t, m) in [(0.35, 77), (0.8, 81), (1.25, 84), (1.7, 82), (2.6, 79), (3.05, 81), (3.5, 77), (3.95, 76)]:
    put(mus, I.musicbox(m2f(m), 0.55, R, 1.2), t, 0.9, 0.15)
cue(0.35, "music: music-box question motif (hook), stops before the slam")

def groove(b0, b1, bass=True, theme=True, brush=True, vel=1.0, minor=False):
    for b in range(b0, b1):
        tb = bar_t(b)
        if tb >= F(1478) - 0.05: break
        root, ch = PROG[b % 8]
        if minor: root, ch = (50, [62, 65, 69]) if b % 2 == 0 else (45, [61, 64, 69])
        if bass:
            for k, (beat, off) in enumerate([(0, 0), (2, 7)]):
                put(mus, I.pluck(m2f(root - 12 + off), 0.75 * vel, R, 0.7, 0.35), tb + beat * BEAT, 1.0, -0.15)
        if brush:
            for beat in (1, 3): put(mus, I.brush(0.35 * vel, R), tb + beat * BEAT, 0.8, 0.25)
        put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT, 0.22 * vel, R, att=0.3, rel=0.5), tb, 0.55)
        if theme:
            for (o, m, d) in THEME[b % 4]:
                put(mus, I.vibes(m2f(m - (3 if minor and m % 12 in (9, 4) else 0)), 0.5 * vel, R, d * BEAT + 0.6), tb + o * BEAT, 0.8, 0.2)

bars = lambda t0, t1: (int(np.floor((F(t0) - T0) / (4 * BEAT) + 1e-6)), int(np.ceil((F(t1) - T0) / (4 * BEAT))))
groove(*bars(158, 851)); cue(F(158), "music: groove (pluck bass, brushes, pad, vibes theme)")
put(mus, I.timpani(m2f(41), 0.7, R), F(580), 0.9); put(mus, I.cymbal(0.35, R), F(580), 0.5, 0.3); cue(F(580), "music: timpani + cymbal on 'leave'")
put(mus, I.timpani(m2f(38), 0.75, R), F(851), 0.9); cue(F(851), "music: 'But ELIZA had a problem' -> minor, no bass")
groove(*bars(851, 985), bass=False, brush=False, minor=True, vel=0.8)
groove(*bars(985, 1036), vel=0.9)
put(mus, I.timpani(m2f(36), 0.8, R), F(1036), 1.0); cue(F(1036), "music: thud on 'Unluckily'")
groove(*bars(1036, 1105), bass=True, brush=False, theme=False, minor=True, vel=0.85)
groove(*bars(1105, 1240), bass=False, brush=False, minor=True, vel=0.75); cue(F(1105), "music: mirror, soft minor pad + vibes")
groove(*bars(1240, 1405), vel=1.0); cue(F(1240), "music: park, groove back")
# "the ELIZA effect": swell into the golden dome
put(mus, I.pad([m2f(n) for n in (58, 65, 70, 74)], F(1478) - F(1405) + 0.4, 0.4, R, att=1.2, rel=0.4), F(1405), 0.9)
[put(mus, I.snare(v, R, 0.2, buzz=True), F(1418) + t, 0.35) for t, v in I.snare_roll(0, 2.0, 0.05, 0.4, R)]; put(mus, I.cymbal(0.5, R, 3.0), F(1478) - 0.02, 0.6, 0.2)
cue(F(1405), "music: swell + roll into 'sixty years later'")
# sixty years later: warm modern section in Bb, pad + 8th-note pluck arps + glock melody, resolves on the end card
B0, BEAT2 = F(1478), 60 / 96
PROG2 = [(46, [58, 62, 65, 70]), (50, [57, 62, 65, 69]), (43, [55, 58, 62, 67]), (41, [57, 60, 65, 69])]
MEL2 = [[(0, 77, 1.5), (2, 74, 1), (3, 72, 1)], [(0, 74, 2), (2.5, 77, 1.5)], [(0, 79, 1), (1, 77, 1), (2, 74, 2)], [(0, 72, 1.5), (2, 77, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(1776):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8):
        put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: modern section (Bb pad, pluck arps, glock melody)")
# end card: resolving Bb chord, music-box sparkle, triangle
for m, dt in [(70, 0), (74, 0.12), (77, 0.24), (82, 0.36)]: put(mus, I.musicbox(m2f(m), 0.55, R, 2.2), F(1776) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (46, 58, 62, 65, 70)], DUR - F(1776), 0.4, R, att=0.2, rel=1.0), F(1776), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(1776), 0.5, 0.3)
cue(F(1776), "music: end-card chord + music box + triangle")
# a little room
ir = make_ir(1.1, 11, hf=0.8)
mus = mus * 0.82 + convolve_st(mus, ir)[:, :N] * 0.18
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)  # tail fade at the very end

# ================================================================ SFX
sfx = np.zeros((2, N))
def typing(t0, t1, rate=9.0, g=0.5, p=0.3, seed=1):
    r = rng(seed); t = t0
    while t < t1:
        put(sfx, mx(G.clink(r, f0=r.uniform(1800, 3200), dur=0.05, bright=0.6) * 0.5, G.stroll_step(r, 0.0)[: ns(0.05)] * 0.3), t, g, p)
        t += r.uniform(0.6, 1.4) / rate
    cue(t0, f"sfx: teletype typing {t0:.2f}-{t1:.2f}")
def ding(t, g=0.8, p=0.3):
    put(sfx, mx(I.glock(m2f(88), 0.6, R, 0.9), I.triangle(0.3, R, 0.8, 2637)), t, g, p); cue(t, "sfx: teletype bell / question mark")
def whoosh(t, d=0.45, g=0.6, p=0.0):
    put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def thud(t, g=1.0):
    put(sfx, mx(G.hammer_hit(R, 0.5)[: ns(0.5)] * 0.4, I.timpani(m2f(31), 0.6, R)[: ns(0.6)]), t, g)
def room(t0, t1, g=0.12):  # 1966 office air: teletype hum + mainframe whirr
    d = t1 - t0; n = ns(d); x = lp(colored(n, R, 1.0), 900) * 0.4 + np.sin(2 * np.pi * 120 * np.arange(n) / SR) * 0.05
    put(sfx, fades(x, 0.15, 0.15), t0, g)
def outside(t0, t1, g=0.35, birds=True):
    d = t1 - t0; put(sfx, fades(G.breeze(d, R, 0.6), 0.2, 0.2), t0, g * 0.5)
    if birds: put(sfx, G.bird_chirps(d, R, 0.6), t0, g * 0.8, 0.4)

# 1 hook: door opens (creak), shuffling steps, door slam, flash whoosh
put(sfx, G.creak(0.45, R, 140, 220) * 6, F(100), 0.8, 0.2); cue(F(100), "sfx: door creak open")
for k, f in enumerate(range(106, 138, 9)): put(sfx, G.stroll_step(rng(30 + k), 0.6), F(f), 0.55, 0.1)
put(sfx, mx(G.hammer_hit(R, 0.8)[: ns(0.6)] * 0.25, G.wood_crack(R) * 0.6), F(144), 1.1, 0.15); cue(F(144), "sfx: DOOR SLAM (kick)")
put(sfx, G.clink(R, 2400, 0.25, 0.8), F(146), 0.3, 0.1)  # the mug rattles
whoosh(F(158), 0.5, 0.7); cue(F(158), "sfx: white-flash whoosh")
outside(F(158), F(197), 0.3, birds=True)
room(F(197), F(600))
typing(F(205), F(289), seed=2); typing(F(289), F(327), rate=11, seed=3); ding(F(327))
typing(F(370), F(487), rate=6, g=0.25, p=0.6, seed=4)
typing(F(489), F(527), rate=11, seed=5)
whoosh(F(529), 0.35, 0.35, -0.2); cue(F(529), "sfx: chair swivel whoosh")
whoosh(F(556), 0.3, 0.45, 0.3); cue(F(556), "sfx: point swish")
put(sfx, G.clink(R, 1800, 0.3, 0.6), F(567), 0.4); cue(F(567), "sfx: mug clink on the shock")
# corridor queue: murmur; psychiatrists: pen scratches
mur = bp(colored(ns(1.9), R, 0.2), 250, 1600) * (0.6 + 0.4 * np.sin(2 * np.pi * 3.1 * tt(1.9)) ** 2)
put(sfx, fades(mur, 0.2, 0.3), F(600), 0.35); cue(F(600), "sfx: corridor murmur")
room(F(656), F(735))
for k in range(5): put(sfx, bp(colored(ns(0.18), rng(60 + k), 0.0), 2500, 7000) * np.hanning(ns(0.18)), F(670) + k * 0.6, 0.25, 0.4)
# booths: street air + many terminals typing
outside(F(735), F(850), 0.3, birds=False)
for k in range(4): typing(F(737), F(850), rate=5, g=0.12, p=-0.6 + 0.4 * k, seed=70 + k)
# 8-9 the visitor
room(F(850), F(1105))
typing(F(852), F(897), rate=10, seed=8)
put(sfx, bp(colored(ns(0.35), R, 0.3), 1200, 6000) * np.exp(-tt(0.35) / 0.12), F(899), 0.7, 0.3); cue(F(899), "sfx: paper tear (close the session)")
ding(F(934)); typing(F(987), F(1034), rate=9, g=0.4, seed=9)
thud(F(1036)); ding(F(1040), 0.6); thud(F(1066), 0.6); cue(F(1066), "sfx: second thud on 'remembered'")
# 10 mirror: shimmer
put(sfx, mx(*[I.glock(m2f(m), 0.2, R, 1.5) for m in (84, 88, 91)]), F(1176), 0.35, -0.3); cue(F(1176), "sfx: mirror shimmer on 'I'm sad'")
put(sfx, I.glock(m2f(91), 0.25, R, 1.2), F(1209), 0.35, -0.3)
# 11 park: birds, dog panting + a tiny 'hm?' on the head tilt
outside(F(1240), F(1405), 0.4)
for k in range(9): put(sfx, bp(colored(ns(0.12), rng(90 + k), 0.0), 500, 2500) * np.hanning(ns(0.12)), F(1250) + k * 0.5, 0.18, 0.3)
put(sfx, G.whoosh(0.25, R, 0.15, 600, 1600) * 0.5, F(1330), 0.4, 0.3); cue(F(1330), "sfx: dog head-tilt swish")
# 12-15 golden: river + breeze; phone chime when Feeloy listens, bubble pop on the question
outside(F(1405), F(1776), 0.3)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1512), 0.55, 0.0); cue(F(1512), "sfx: Feeloy chime (app opens)")
put(sfx, I.glock(m2f(89), 0.4, R, 0.6), F(1545), 0.35, 0.1)
room(F(1630), F(1705), 0.1)
put(sfx, G.clink(R, 2000, 0.2, 0.5), F(1660), 0.25)
put(sfx, fades(np.sin(2 * np.pi * np.linspace(500, 1100, ns(0.09)) * tt(0.09)) * np.hanning(ns(0.09)), 0.0, 0.01), F(1730), 0.5, 0.0)
cue(F(1730), "sfx: speech-bubble pop (how did the interview go?)")
whoosh(F(1776), 0.5, 0.45); cue(F(1776), "sfx: end-card whoosh")

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
