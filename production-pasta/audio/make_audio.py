"""Soundtrack for "No One to Save" (Rome police cook spaghetti -> Feeloy), 61.0 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/pasta/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1830
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
# A nervous A-minor ostinato for the cries, an urgent snare + brass run, a comic tuba deflate on "no crime at all",
# a warm D-major mandolin tremolo for the couple, a sad pad + music box for the news and the empty August, the mandolin
# back for the cooking and the chairs, glock for the note, a brass "always there", a bare night, the Feeloy section.
def mando(f, d, vel=0.4, rate=11.0):
    """mandolin tremolo: fast repeated plucks over d seconds"""
    n = max(1, int(d * rate)); out = np.zeros(ns(d + 0.5))
    for k in range(n):
        x = I.pluck(f, vel * (0.75 + 0.25 * (k % 2)), R, 0.3, 0.8); a = ns(k / rate); out[a:a + len(x)] += x[: len(out) - a]
    return out
CH = {"D": [62, 66, 69], "G": [55, 59, 62], "A": [57, 61, 64], "Bm": [59, 62, 66], "Am": [57, 60, 64], "Dm": [62, 65, 69], "E": [52, 56, 59]}
def waltz(f0, f1, prog, mel, vel=0.8, bpm=132):
    b = 60 / bpm; t = F(f0); k = 0
    while t < F(f1) - 0.4:
        ch = CH[prog[k % len(prog)]]
        put(mus, I.pluck(m2f(ch[0] - 12), 0.7 * vel, R, 0.7, 0.35), t, 0.9, -0.15)
        for j in (1, 2): put(mus, mx(*[I.pluck(m2f(n), 0.35 * vel, R, 0.4, 0.5) for n in ch]), t + j * b, 0.5, 0.2)
        m = mel[k % len(mel)]
        if m: put(mus, mando(m2f(m), 2.6 * b, 0.4 * vel), t, 0.7, 0.25)
        t += 3 * b; k += 1
# hook: nervous A minor ostinato over a low pad
t = 0.0
while t < F(141) - 0.2:
    for j, m in enumerate((57, 60, 64, 60)): put(mus, I.pluck(m2f(m), 0.45, R, 0.4, 0.4), t + j * 0.23, 0.6, 0.1)
    t += 0.92
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(141), 0.24, R, att=0.5, rel=0.4), 0.0, 0.7)
cue(0.0, "music: nervous A-minor pluck ostinato")
# the run: snare roll + brass hits
for k in range(int((F(240) - F(141)) / 0.115)): put(mus, I.snare(0.25 + 0.3 * k / 60, R, 0.12, snappy=0.8), F(141) + k * 0.115, 0.4, 0.1 * ((k % 2) * 2 - 1))
for f, m in ((141, 57), (176, 60), (194, 64), (211, 69)): put(mus, mx(I.brass(m2f(m), 0.22, 0.75, R), I.brass(m2f(m + 3), 0.22, 0.7, R)), F(f), 0.6)
cue(F(141), "music: snare run + brass hits")
# no crime: the tuba deflates
for f, m in ((250, 45), (286, 43), (322, 40)): put(mus, I.brass(m2f(m), 0.45, 0.8, R, kind="tuba", fall=-2), F(f + 10), 0.75)
put(mus, I.brass(m2f(38), 0.9, 0.8, R, kind="tuba", fall=-5), F(331), 0.7); cue(F(260), "music: tuba deflates on each crossed-out word")
# Michele and Jole: a warm D-major waltz with mandolin tremolo
waltz(356, 539, ["D", "Bm", "G", "A"], [78, 74, 71, 73], vel=0.75); cue(F(356), "music: D-major mandolin waltz (the couple)")
for o, m in [(0, 86), (0.25, 90), (0.5, 93)]: put(mus, I.glock(m2f(m), 0.45, R, 1.2), F(495) + o, 0.6, 0.2)
# the news, August, alone: a sad pad and a music box
put(mus, I.pad([m2f(n) for n in (50, 57, 62, 65)], F(914) - F(539), 0.26, R, att=0.8, rel=0.8), F(539), 0.7)
for o, m in [(0, 74), (0.6, 72), (1.2, 69), (1.9, 65), (2.6, 64), (3.3, 62)]: put(mus, I.musicbox(m2f(m + 12), 0.32, R, 1.6), F(600) + o, 0.6, 0.15)
for o, m in [(0, 69), (0.7, 67), (1.4, 65), (2.2, 62)]: put(mus, I.musicbox(m2f(m + 12), 0.3, R, 1.6), F(772) + o, 0.6, 0.15)
put(mus, I.timpani(m2f(38), 0.35, R, 2.0), F(560), 0.35); cue(F(539), "music: sad D-minor pad + music box (news, August, alone)")
# the cooking and the chairs: the mandolin waltz back, brighter
waltz(914, 1138, ["G", "D", "A", "D"], [79, 78, 76, 74], vel=0.9, bpm=144); cue(F(914), "music: bright mandolin waltz (spaghetti, chairs)")
for f, m in ((986, 83), (1004, 86)): put(mus, I.glock(m2f(m), 0.5, R, 1.0), F(f), 0.6, 0.2)
# the note: tender pad, glock
put(mus, I.pad([m2f(n) for n in (50, 57, 62, 66)], F(1313) - F(1138), 0.28, R, att=0.6, rel=0.6), F(1138), 0.7)
for o, m in [(0, 78), (0.5, 76), (1.0, 74), (1.6, 78), (2.2, 81)]: put(mus, I.glock(m2f(m), 0.35, R, 1.4), F(1182) + o, 0.6, 0.15)
cue(F(1138), "music: tender pad + glock (the note)")
# always there: the waltz once more + a brass chord
waltz(1313, 1430, ["D", "G", "A", "D"], [74, 78, 81, 78], vel=0.85)
put(mus, mx(I.brass(m2f(62), 0.7, 0.8, R), I.brass(m2f(66), 0.7, 0.75, R), I.brass(m2f(69), 0.7, 0.75, R)), F(1382), 0.7); cue(F(1382), "music: brass chord on WE'RE ALWAYS THERE")
# the lonely flat: nearly nothing
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(1550) - F(1430), 0.2, R, att=0.8, rel=0.6), F(1430), 0.6)
# Feeloy: warm modern section from the phone, resolves on the end card
B0, BEAT2, CARD = F(1550), 60 / 96, 1731
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
ir = make_ir(1.1, 11, hf=0.8)
mus = mus * 0.82 + convolve_st(mus, ir)[:, :N] * 0.18
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def outside(t0, t1, g=0.35):
    d = t1 - t0; put(sfx, fades(G.breeze(d, R, 0.5), 0.2, 0.2), t0, g * 0.5); put(sfx, G.crickets(d, R, 2), t0, g * 0.5, 0.3)
def room(t0, t1, g=0.1):
    n = ns(t1 - t0); put(sfx, fades(lp(colored(n, R, 1.0), 700) * 0.4, 0.15, 0.15), t0, g)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def flick(t, g=0.2, p=0.3): put(sfx, bp(colored(ns(0.06), R, 0.2), 2000, 8000) * np.hanning(ns(0.06)), t, g, p)
def tone(t, f, d, g=0.25, p=0.0): put(sfx, np.sin(2 * np.pi * f * tt(d)) * np.minimum(1, tt(d) / 0.005) * np.minimum(1, (d - tt(d)) / 0.01), t, g, p)
def buzz(t, g=0.3): put(sfx, lp(np.sign(np.sin(2 * np.pi * 110 * tt(0.22))) * 0.4, 1800) * np.hanning(ns(0.22)), t, g)
def tick(t, g=0.12): put(sfx, G.clink(R, 3000, 0.02, 0.4), t, g, 0.1)
outside(0, F(244), 0.35); cue(0.0, "sfx: summer evening street: breeze, crickets")
for k in range(3): tone(F(100) + k * 0.16, 1400, 0.09, 0.2, -0.3)
for k in range(2): tone(F(112) + k * 0.5, 425, 0.35, 0.18, -0.3)
cue(F(100), "sfx: dial tones, ringing")
whoosh(F(141), 0.5, 0.7)
sir = np.zeros(ns(3.4)); tsr = tt(3.4); fsr = np.where((tsr * 1.6) % 1 < 0.5, 660, 880); sir = np.sin(2 * np.pi * np.cumsum(fsr) / SR) * 0.3
put(sfx, fades(bp(sir, 400, 3000), 0.6, 0.8), F(141), 0.12, 0.4); cue(F(141), "sfx: distant two-tone siren")
for k in range(int((F(240) - F(145)) / 0.125)): put(sfx, G.boot(R, 0.5), F(145) + k * 0.125, 0.22, 0.2 * ((k % 4) - 1.5))
cue(F(145), "sfx: running boots on cobbles")
put(sfx, G.creak(0.6, R, 90, 150), F(240), 0.3, -0.2); cue(F(240), "sfx: the door creaks open")
room(F(244), F(1313), 0.09)
for f in (250, 286, 322): popb(F(f), 0.35); buzz(F(f + 10), 0.22)
cue(F(250), "sfx: badge pop + wrong-buzzer per crossed-out word")
for f in (385, 435, 495): popb(F(f), 0.38)
put(sfx, G.babble(F(596) - F(539), R, 120, 0.9), F(539), 0.15, -0.2); cue(F(539), "sfx: muffled TV news")
flick(F(696), 0.3); flick(F(700), 0.25); cue(F(696), "sfx: calendar page flip")
for f in (734, 742, 750): popb(F(f), 0.35)
for k in range(3): tick(F(772) + k * 0.9)
cue(F(772), "sfx: clock ticks (alone)")
put(sfx, G.bubbles(F(1040) - F(920), R, 14, 300, 1400), F(920), 0.18, -0.2); cue(F(920), "sfx: the pot boils")
put(sfx, G.clink(R, 2400, 0.1, 0.7), F(942), 0.25, -0.2)
for f in (986, 1004): popb(F(f), 0.38)
for k in range(2): put(sfx, G.clink(R, 1900 + 300 * k, 0.15, 0.6), F(1040) + k * 0.12, 0.3, 0.1)
put(sfx, mx(G.babble(F(1138) - F(1046), R, 130, 1.0), G.babble(F(1138) - F(1046), R, 200, 1.0) * 0.8), F(1046), 0.14)
cue(F(1040), "sfx: plates clink, table chatter")
for f in (1180, 1236): popb(F(f), 0.35)
outside(F(1313), F(1430), 0.3)
popb(F(1382), 0.45); put(sfx, G.applause(1.6, R, 6), F(1386), 0.22); cue(F(1382), "sfx: banner pop, a little applause")
n = ns(DUR - F(1430)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(1430), 0.15)
put(sfx, G.crickets(F(1731) - F(1430), R, 3), F(1430), 0.2, 0.3); cue(F(1430), "sfx: night: crickets, room hum")
popb(F(1495), 0.35)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1550), 0.55, 0.0); cue(F(1550), "sfx: Feeloy chime (phone)")
for f in (1637, 1662, 1685): popb(F(f), 0.45)
cue(F(1637), "sfx: speech-bubble pops (note, dots, heart)")
whoosh(F(1731), 0.5, 0.45); cue(F(1731), "sfx: end-card whoosh")

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
