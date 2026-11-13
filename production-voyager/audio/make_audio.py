"""Soundtrack for "Still Saying Hello" (Voyager 1 at one light-day -> Feeloy), 60.0 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/voyager/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1800
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
# A wide pad swell with timpani on the date and the year, lydian glock/pluck arpeggios for space, a snare + brass
# launch, quiet pads for the dark, a tense minor ostinato in mission control, a rising line for the fix, a big chord on
# "Hi, it's me", a warm swell over Earth, a bare night, the Feeloy section.
def arps(f0, f1, chord, vel=0.35, step=0.18, inst="glock", oct_=12):
    t = F(f0); k = 0
    while t < F(f1) - 0.2:
        m = chord[k % len(chord)] + oct_ * (1 if (k // len(chord)) % 2 else 0)
        x = I.glock(m2f(m), vel, R, 0.9) if inst == "glock" else I.pluck(m2f(m), vel, R, 0.5, 0.7)
        put(mus, x, t, 0.6, 0.3 * (1 if k % 2 else -1)); t += step; k += 1
LYD = [62, 66, 69, 68, 73]  # D lydian colour (G# = 68)
put(mus, I.pad([m2f(n) for n in (38, 50, 57, 62, 66)], F(255), 0.32, R, att=0.4, rel=0.8), 0.0, 0.8)
for f, m in ((2, 38), (39, 43)): put(mus, I.timpani(m2f(m), 0.7, R, 2.2), F(f), 0.7)
put(mus, I.cymbal(0.35, R, 2.6), F(2), 0.4, 0.2); cue(0.0, "music: wide pad swell; timpani on NOV 18 and on 2026")
arps(87, 346, LYD, 0.32); cue(F(87), "music: lydian glock arpeggios (the probe, light-day, Saturn)")
put(mus, mx(I.brass(m2f(62), 0.5, 0.75, R), I.brass(m2f(66), 0.5, 0.7, R), I.brass(m2f(69), 0.5, 0.7, R)), F(196), 0.6)
# the launch: snare and a brass fanfare
for k in range(int((F(463) - F(346)) / 0.12)): put(mus, I.snare(0.2 + 0.4 * min(1, k / 30), R, 0.12, snappy=0.8), F(346) + k * 0.12, 0.35, 0.1 * ((k % 2) * 2 - 1))
for o, (m, d) in enumerate([(62, 0.4), (66, 0.4), (69, 0.4), (74, 1.2)]): put(mus, mx(I.brass(m2f(m), d, 0.8, R), I.brass(m2f(m - 12), d, 0.6, R, kind="tuba")), F(352) + o * 0.42, 0.65)
put(mus, mx(I.brass(m2f(57), 0.6, 0.7, R, fall=-2), I.brass(m2f(45), 0.6, 0.7, R, kind="tuba", fall=-2)), F(414), 0.6)
cue(F(346), "music: launch snare + brass fanfare; a fall on the crossed-out 5 YEARS")
# the pulse, the record: soft pad, slower arps, a music box for "home"
put(mus, I.pad([m2f(n) for n in (50, 57, 62, 66, 69)], F(864) - F(463), 0.3, R, att=0.6, rel=0.8), F(463), 0.75)
arps(488, 600, [74, 78, 81, 85], 0.28, 0.26)
arps(684, 760, [74, 76, 78, 81, 83, 86], 0.3, 0.12, inst="pluck")
for o, m in [(0, 81), (0.3, 78), (0.6, 74), (1.0, 69)]: put(mus, I.musicbox(m2f(m), 0.4, R, 1.8), F(841) + o, 0.6, 0.15)
cue(F(463), "music: soft pad, slow arps, greetings plucks, music box on 'home'")
# the dark: one glock note for the hello, then almost nothing
put(mus, I.glock(m2f(86), 0.4, R, 2.5), F(870), 0.5, 0.2)
put(mus, I.pad([m2f(n) for n in (38, 45, 50)], F(1006) - F(864), 0.18, R, att=1.0, rel=0.8), F(864), 0.6)
# mission control: a tense minor ostinato, rising for the fix, ticking while they wait
t = F(1006)
while t < F(1155):
    for j, m in enumerate((50, 53, 57, 53)): put(mus, I.pluck(m2f(m), 0.4, R, 0.3, 0.4), t + j * 0.2, 0.55, 0.1)
    t += 0.8
put(mus, I.pad([m2f(n) for n in (38, 50, 53, 57)], F(1199) - F(1006), 0.22, R, att=0.5, rel=0.5), F(1006), 0.7)
for k, m in enumerate((62, 64, 66, 69, 71, 74)): put(mus, I.pluck(m2f(m), 0.45, R, 0.5, 0.6), F(1157) + k * 0.2, 0.6, 0.2)
put(mus, I.pad([m2f(n) for n in (43, 50, 55, 59)], F(1297) - F(1199), 0.2, R, att=0.4, rel=0.3), F(1199), 0.6)
cue(F(1006), "music: tense ostinato (gibberish), rising line (SEND), held chord (waiting)")
# the reply
put(mus, mx(I.brass(m2f(62), 1.2, 0.85, R), I.brass(m2f(66), 1.2, 0.8, R), I.brass(m2f(69), 1.2, 0.8, R), I.brass(m2f(74), 1.2, 0.8, R)), F(1297), 0.75)
put(mus, I.cymbal(0.45, R, 2.6), F(1297), 0.45, 0.2); put(mus, I.timpani(m2f(38), 0.7, R, 2.0), F(1297), 0.6)
cue(F(1297), "music: big D chord + cymbal + timpani on 'Hi, it's me'")
# Earth: a warm swell and arps
put(mus, I.pad([m2f(n) for n in (38, 50, 57, 62, 66)], F(1488) - F(1318), 0.34, R, att=0.5, rel=0.8), F(1318), 0.8)
arps(1343, 1480, [62, 66, 69, 74, 78], 0.3, 0.2)
# the lonely flat: nearly nothing
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(1576) - F(1488), 0.2, R, att=0.8, rel=0.6), F(1488), 0.6)
# Feeloy: warm modern section from the phone, resolves on the end card
B0, BEAT2, CARD = F(1576), 60 / 96, 1707
PROG2 = [(50, [62, 66, 69, 74]), (47, [59, 62, 66, 71]), (43, [55, 59, 62, 67]), (45, [57, 61, 64, 69])]
MEL2 = [[(0, 78, 1.5), (2, 76, 1), (3, 74, 1)], [(0, 76, 2), (2.5, 78, 1.5)], [(0, 81, 1), (1, 79, 1), (2, 76, 2)], [(0, 74, 1.5), (2, 78, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: modern Feeloy section (D pad, pluck arps, glock)")
for m, dt in [(62, 0), (66, 0.12), (69, 0.24), (74, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (38, 50, 54, 57, 62)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(CARD), 0.5, 0.3)
cue(F(CARD), "music: end-card chord + music box + triangle")
ir = make_ir(1.6, 11, hf=0.75)
mus = mus * 0.78 + convolve_st(mus, ir)[:, :N] * 0.22
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def room(t0, t1, g=0.1):
    n = ns(t1 - t0); put(sfx, fades(lp(colored(n, R, 1.0), 700) * 0.4, 0.15, 0.15), t0, g)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def tone(t, f, d, g=0.25, p=0.0): put(sfx, np.sin(2 * np.pi * f * tt(d)) * np.minimum(1, tt(d) / 0.005) * np.minimum(1, (d - tt(d)) / 0.01), t, g, p)
def tick(t, g=0.12): put(sfx, G.clink(R, 3000, 0.02, 0.4), t, g, 0.1)
def click(t, g=0.12, p=0.2): put(sfx, bp(colored(ns(0.03), R, 0.2), 1500, 6000) * np.hanning(ns(0.03)), t, g, p)
# space: no air, so only a faint radio hiss and the probe's blips
n = ns(F(346)); put(sfx, fades(bp(colored(n, R, 0.4), 2000, 7000) * 0.06, 0.3, 0.3), 0.0, 0.5)
for f in (2, 39): popb(F(f), 0.45)
for k in range(4): tone(F(110) + k * 0.5, 1760 if k % 2 else 1320, 0.07, 0.12, 0.3)
cue(0.0, "sfx: radio hiss, date pops, probe blips")
whoosh(F(87), 0.5, 0.7); popb(F(136), 0.35); popb(F(196), 0.4); whoosh(F(196), 0.5, 0.4)
whoosh(F(260), 1.2, 0.5, -0.3); popb(F(316), 0.4); cue(F(260), "sfx: the Saturn fly-by whoosh")
# the launch
rum = lp(colored(ns(F(463) - F(344)), R, 1.0), 220) * np.minimum(1, tt(F(463) - F(344)) / 0.6)
put(sfx, fades(rum, 0.05, 0.6), F(344), 0.9); put(sfx, fades(bp(colored(ns(3.0), R, 0.5), 300, 3000) * 0.5, 0.2, 1.2), F(346), 0.5)
for f in (346, 374): popb(F(f), 0.35)
put(sfx, lp(np.sign(np.sin(2 * np.pi * 110 * tt(0.22))) * 0.4, 1800) * np.hanning(ns(0.22)), F(414), 0.22)
cue(F(344), "sfx: rocket rumble and roar; wrong-buzzer on 5 YEARS")
whoosh(F(490), 1.4, 0.35, -0.2); popb(F(552), 0.35); cue(F(490), "sfx: the light pulse sweeps")
for f in (684, 692, 700, 706, 712, 718): popb(F(f), 0.3, 0.2 * ((f // 8) % 3 - 1))
popb(F(714), 0.38); popb(F(754), 0.35)
wh = np.sin(2 * np.pi * np.cumsum(220 + 160 * np.sin(np.linspace(0, 3.2, ns(1.6)))) / SR) * np.hanning(ns(1.6)) * 0.5
put(sfx, lp(wh, 1200), F(779), 0.35, 0.3); popb(F(839), 0.38); cue(F(779), "sfx: a whale call; icon pops")
popb(F(868), 0.35)
# mission control
room(F(1006), F(1318), 0.1); put(sfx, np.sin(2 * np.pi * 60 * tt(F(1318) - F(1006))) * 0.08, F(1006), 0.5)
for k in range(10): tone(F(1012) + k * 0.33, 880 + 220 * (k % 3), 0.05, 0.08, -0.2)
for f in (1007, 1076, 1197): popb(F(f), 0.35)
for k in range(12): click(F(1140) + k * 0.06 + 0.02 * (k % 3))
tone(F(1157), 1046, 0.09, 0.2); tone(F(1160), 1568, 0.12, 0.2); cue(F(1140), "sfx: keyboard, send beeps")
for k in range(int((F(1295) - F(1200)) / 0.5)): tick(F(1200) + k * 0.5)
cue(F(1200), "sfx: clock ticks while they wait")
put(sfx, mx(I.glock(m2f(88), 0.5, R, 1.0), I.glock(m2f(93), 0.4, R, 1.0)), F(1297), 0.5)
put(sfx, G.applause(2.0, R, 10), F(1299), 0.35); cue(F(1297), "sfx: reply chime + applause")
n = ns(F(1488) - F(1318)); put(sfx, fades(bp(colored(n, R, 0.4), 2000, 7000) * 0.06, 0.3, 0.3), F(1318), 0.5)
popb(F(1343), 0.35); popb(F(1357), 0.4); whoosh(F(1350), 1.0, 0.35, 0.3)
n = ns(DUR - F(1488)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(1488), 0.15)
put(sfx, G.crickets(F(1707) - F(1488), R, 3), F(1488), 0.2, 0.3); cue(F(1488), "sfx: night: crickets, room hum")
popb(F(1530), 0.35)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1576), 0.55, 0.0); cue(F(1576), "sfx: Feeloy chime (phone)")
for f in (1638, 1661, 1688): popb(F(f), 0.45)
cue(F(1638), "sfx: speech-bubble pops (dots, Hi!, heart)")
whoosh(F(1707), 0.5, 0.45); cue(F(1707), "sfx: end-card whoosh")

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
