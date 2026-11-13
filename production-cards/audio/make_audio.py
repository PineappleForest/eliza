"""Soundtrack for "100 Cards" (Joe Cuba's 100th birthday -> Feeloy), 56.7 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/cards/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1700
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
# A bouncy G-major pluck + vibes groove for the mail, brass stabs on each counter, glock dings on the map pins, a little
# fanfare on fifty thousand, a tuba for "I bet I have", a music box for the evening, a bare night, the Feeloy section.
BEAT = 60 / 104
PENT = [67, 69, 71, 74, 76, 79, 81, 83, 86]
CH = {"G": [55, 59, 62], "Em": [52, 55, 59], "C": [48, 52, 55], "D": [50, 54, 57]}
def bar(t0, chord, lead=None, bass=True, brush=True, vel=1.0, pad=0.2, inst="pluck"):
    root = CH[chord][0] - 12
    if bass:
        for b, off in [(0, 0), (2, 7)]: put(mus, I.pluck(m2f(root + off), 0.7 * vel, R, 0.6, 0.35), t0 + b * BEAT, 0.9, -0.15)
    if brush:
        for b in (1, 3): put(mus, I.brush(0.3 * vel, R), t0 + b * BEAT, 0.7, 0.25)
    put(mus, I.pad([m2f(n) for n in CH[chord]], 4 * BEAT, pad * vel, R, att=0.3, rel=0.5), t0, 0.5)
    for (o, deg, d) in (lead or []):
        x = I.vibes(m2f(PENT[deg]), 0.4 * vel, R, d * BEAT + 0.6) if inst == "vibes" else I.pluck(m2f(PENT[deg]), 0.55 * vel, R, d * BEAT + 0.5, 0.75)
        put(mus, x, t0 + o * BEAT, 0.72, 0.2)
MOTIF = [[(0, 2, 0.5), (0.5, 4, 0.5), (1, 5, 1), (2.5, 4, 0.5), (3, 2, 1)], [(0.5, 1, 0.5), (1, 2, 1), (3, 0, 1)],
         [(0, 3, 0.5), (0.5, 4, 0.5), (1, 6, 1), (2.5, 5, 0.5), (3, 4, 1)], [(1, 2, 1), (2, 1, 2)]]
PROG = ["G", "Em", "C", "D"]
def section(f0, f1, lead=True, k0=0, **kw):
    t = F(f0); k = k0
    while t < F(f1) - 0.3:
        bar(t, PROG[k % 4], MOTIF[k % 4] if lead else None, **kw); t += 4 * BEAT; k += 1
section(0, 261, inst="vibes", vel=0.8, pad=0.22); cue(0.0, "music: bouncy G vibes groove")
put(mus, I.brass(m2f(43), 0.5, 0.8, R, kind="tuba"), F(150), 0.75); put(mus, I.brass(m2f(42), 0.6, 0.8, R, kind="tuba", fall=-3), F(160), 0.7)
cue(F(150), "music: tuba slump under the sack")
# the caregiver asks: soft vibes only, a music box on "just happiness"
section(261, 407, lead=False, brush=False, vel=0.6, pad=0.26)
for k, (o, deg) in enumerate([(0, 5), (0.4, 4), (0.8, 2), (1.3, 5)]): put(mus, I.musicbox(m2f(PENT[deg] + 12), 0.4, R, 1.6), F(372) + o, 0.6, 0.15)
cue(F(372), "music: music box on 'just happiness'")
# the photo and the flood: the groove, fuller, with stabs on each counter and dings on the map pins
section(407, 1061, pad=0.22, vel=0.9); cue(F(407), "music: pluck groove (photo, cards, map, express, room)")
for f, m in ((616, 55), (729, 59), (1094, 62)): put(mus, mx(I.brass(m2f(m), 0.35, 0.8, R), I.brass(m2f(m + 4), 0.35, 0.7, R), I.brass(m2f(m + 7), 0.35, 0.7, R)), F(f), 0.7)
cue(F(616), "music: brass stab per counter (2,500 / 16,000 / 50,000)")
for f, m in zip((759, 776, 805, 816), (79, 83, 86, 91)): put(mus, I.glock(m2f(m), 0.5, R, 1.2), F(f), 0.6, 0.2)
cue(F(759), "music: glock ding per map pin")
# the birthday: the groove brighter, a fanfare + cymbal on 50,000 and the confetti
section(1061, 1229, pad=0.28, vel=1.0, k0=0)
put(mus, mx(I.brass(m2f(67), 0.25, 0.8, R), I.brass(m2f(71), 0.25, 0.8, R), I.brass(m2f(74), 0.7, 0.85, R)), F(1124), 0.7)
put(mus, I.cymbal(0.4, R, 2.2), F(1124), 0.4, 0.2); cue(F(1124), "music: fanfare + cymbal (confetti)")
put(mus, I.brass(m2f(43), 0.22, 0.8, R, kind="tuba"), F(1196), 0.7); put(mus, I.brass(m2f(50), 0.4, 0.8, R, kind="tuba"), F(1208), 0.7)
cue(F(1196), "music: tuba wink 'I bet I have'")
# evening: a music box over a warm pad
put(mus, I.pad([m2f(n) for n in (52, 55, 59, 62)], F(1321) - F(1229), 0.26, R, att=0.6, rel=0.6), F(1229), 0.7)
for o, deg in [(0, 5), (0.5, 4), (1.0, 3), (1.6, 2), (2.2, 4), (2.8, 5)]: put(mus, I.musicbox(m2f(PENT[deg] + 12), 0.35, R, 1.6), F(1236) + o, 0.6, 0.15)
cue(F(1236), "music: music box (evening)")
# the lonely flat: nearly nothing
put(mus, I.pad([m2f(n) for n in (40, 47, 52, 55)], F(1420) - F(1321), 0.2, R, att=0.8, rel=0.6), F(1321), 0.6)
# Feeloy: warm modern section from the phone, resolves on the end card
B0, BEAT2 = F(1420), 60 / 96
PROG2 = [(43, [55, 59, 62, 67]), (40, [52, 55, 59, 64]), (36, [48, 52, 55, 60]), (38, [50, 54, 57, 62])]
MEL2 = [[(0, 79, 1.5), (2, 76, 1), (3, 74, 1)], [(0, 76, 2), (2.5, 79, 1.5)], [(0, 83, 1), (1, 81, 1), (2, 79, 2)], [(0, 74, 1.5), (2, 78, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD := 1604):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: modern Feeloy section (G pad, pluck arps, glock)")
for m, dt in [(67, 0), (71, 0.12), (74, 0.24), (79, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (43, 55, 59, 62, 67)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(CARD), 0.5, 0.3)
cue(F(CARD), "music: end-card chord + music box + triangle")
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
def flick(t, g=0.2, p=0.3): put(sfx, bp(colored(ns(0.06), R, 0.2), 2000, 8000) * np.hanning(ns(0.06)), t, g, p)
def paper(t, g=0.35, p=0.0):
    """an envelope landing: a soft papery slap"""
    d = 0.12; x = bp(colored(ns(d), R, 0.3), 800, 6000) * np.exp(-tt(d) / 0.03); put(sfx, mx(x, G.push_thump(R) * 0.25), t, g, p)
def marker(t0, d, g=0.22):
    x = bp(colored(ns(d), R, 0.2), 2500, 7000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 6 * tt(d)))); put(sfx, fades(x, 0.02, 0.05), t0, g, 0.1)
def shutter(t, g=0.5):
    put(sfx, mx(G.clink(R, 3200, 0.03, 0.6), bp(colored(ns(0.05), R, 0.2), 1500, 7000) * np.hanning(ns(0.05))), t, g, 0.2)
    put(sfx, G.clink(R, 2400, 0.04, 0.5), t + 0.07, g * 0.7, 0.2)
def tick(t, g=0.18): put(sfx, G.clink(R, 3000, 0.02, 0.4), t, g, 0.1)
room(0, F(127), 0.09)
marker(F(25), 0.6); cue(F(25), "sfx: marker circles the 100")
popb(F(99), 0.4, 0.2); cue(F(99), "sfx: envelope pop")
whoosh(F(127), 0.5, 0.7)
outside(F(127), F(261), 0.35); cue(F(127), "sfx: outside: breeze + birds")
for k in range(5): put(sfx, G.boot(R, 0.8), F(140 + 13 * k), 0.4, -0.2 if k % 2 else 0.2)
put(sfx, mx(G.push_thump(R), G.rattle(0.3, R, 40)), F(150), 0.6); put(sfx, G.oof(R, "oof"), F(152), 0.35); cue(F(150), "sfx: sack sags, oof, heavy steps")
popb(F(235), 0.4); cue(F(235), "sfx: TEXAS badge pop")
room(F(261), F(1061), 0.09); cue(F(261), "sfx: lounge room tone")
for f in (280, 338, 370): popb(F(f), 0.4)
shutter(F(427)); cue(F(427), "sfx: phone camera shutter")
popb(F(451), 0.35); marker(F(509), 0.6); cue(F(509), "sfx: marker circles 100 on the sign")
for f in (600, 616, 640, 660, 676, 700): paper(F(f), 0.4, 0.3)
for k in range(28): tick(F(616) + k * (F(700) - F(616)) / 28)
popb(F(616), 0.45); cue(F(600), "sfx: envelope piles land; counter ticks up")
popb(F(729), 0.45); for_ = [tick(F(729) + k * 0.05) for k in range(14)]
cue(F(729), "sfx: 16,000 pop")
outside(F(835), F(973), 0.35)
for k in range(19): put(sfx, G.boot(R, 0.6), F(838) + k * F(7), 0.35, -0.15 if k % 2 else 0.15)
whoosh(F(845), 0.4, 0.45, -0.3)
for f in (853, 898, 942): popb(F(f), 0.4, 0.1)
cue(F(835), "sfx: running steps, whoosh, tag pops")
put(sfx, G.creak(0.5, R, 90, 140), F(978), 0.3, 0.2); cue(F(978), "sfx: the door creaks")
for k in range(9): paper(F(1022 + 3 * k), 0.45, 0.4 * ((k % 3) - 1))
for k in range(30): flick(F(1020) + k * 0.03, 0.15, 0.2 * ((k % 5) - 2))
cue(F(1022), "sfx: an avalanche of mail")
room(F(1061), F(1321), 0.09)
put(sfx, G.babble(F(1153) - F(1061), R, 180, 1.0), F(1061), 0.12, 0.0)
popb(F(1094), 0.45)
put(sfx, mx(bp(colored(ns(0.12), R, 0.4), 600, 5000) * np.exp(-tt(0.12) / 0.03), G.push_thump(R) * 0.4), F(1124), 0.55)
put(sfx, G.applause(1.8, R, 8), F(1126), 0.3)
cue(F(1061), "sfx: party murmur; popper + small applause on the confetti")
popb(F(1153), 0.4); popb(F(1299), 0.4)
for k in range(9): tick(F(1240) + k * 1.0, 0.1)
cue(F(1240), "sfx: clock ticks (evening)")
n = ns(DUR - F(1321)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(1321), 0.15)
put(sfx, G.crickets(F(1604) - F(1321), R, 3), F(1321), 0.2, 0.3); cue(F(1321), "sfx: night: crickets, room hum")
popb(F(1352), 0.35)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1420), 0.55, 0.0); cue(F(1420), "sfx: Feeloy chime (phone)")
for f in (1518, 1552, 1574): popb(F(f), 0.45)
cue(F(1518), "sfx: speech-bubble pops (note, mail, heart)")
whoosh(F(1604), 0.5, 0.45); cue(F(1604), "sfx: end-card whoosh")

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
