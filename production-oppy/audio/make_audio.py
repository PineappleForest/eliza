"""Soundtrack for "My Battery Is Low" (Opportunity -> Feeloy), 31.9 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/oppy/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 956
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
# A lonely D-minor Mars drone with a sparse music box, a soft swell for "fifteen years", wind takes over in the storm,
# a slow fading battery line, cold control-room pulses, then an original gentle waltz for the last song (NOT the real
# tune), and the warm Feeloy section.
mus = np.zeros((2, N))
put(mus, I.pad([m2f(n) for n in (38, 45, 50, 53)], F(300), 0.25, R, att=1.0, rel=1.5, warm=700), 0.0, 0.7)
for k, m in enumerate((74, 77, 81, 79, 77, 74, 72, 74)): put(mus, I.musicbox(m2f(m), 0.45, R, 1.6), 0.4 + k * 0.62, 0.5, 0.2 * ((k % 3) - 1))
cue(0.0, "music: D-minor Mars drone + music box")
put(mus, I.pad([m2f(n) for n in (46, 53, 58, 62, 65)], F(169) - F(122), 0.4, R, att=0.3, rel=0.8), F(122), 0.8); cue(F(122), "music: swell on FIFTEEN YEARS")
put(mus, I.pad([m2f(n) for n in (38, 45, 50)], F(468) - F(310), 0.2, R, att=1.2, rel=1.2, warm=500), F(310), 0.6)
for k, m in enumerate((74, 72, 69, 65, 62)): put(mus, I.musicbox(m2f(m), 0.4 - k * 0.05, R, 1.8), F(389) + k * 0.5, 0.5)
cue(F(389), "music: a falling music-box line under 'battery is low'")
put(mus, I.pad([m2f(n) for n in (43, 50, 55, 58)], F(605) - F(468), 0.22, R, att=0.5, rel=0.6, warm=600), F(468), 0.55)
# the last song: an original slow 3/4 lullaby in F
BT = 60 / 84; S0 = F(606)
SONG = [(0, 72, 2), (2, 69, 1), (3, 70, 2), (5, 67, 1), (6, 69, 3), (9, 65, 1.5), (10.5, 67, 1.5), (12, 69, 2), (14, 72, 1), (15, 74, 3)]
for (o, m, d) in SONG: put(mus, I.vibes(m2f(m), 0.55, R, d * BT + 1.0), S0 + o * BT, 0.7, 0.1)
for bar, ch in enumerate([(53, 57, 60), (46, 50, 53), (48, 52, 55), (53, 57, 60), (50, 53, 57), (46, 50, 53)]):
    put(mus, I.pad([m2f(n) for n in ch], 3 * BT + 0.4, 0.3, R, att=0.3, rel=0.7), S0 + bar * 3 * BT, 0.6)
    put(mus, I.pluck(m2f(ch[0] - 12), 0.6, R, 1.4, 0.3), S0 + bar * 3 * BT, 0.7)
cue(S0, "music: the last song (an original waltz on vibes)")
B0, BEAT2, CARD = F(735), 60 / 96, 860
PROG2 = [(41, [53, 57, 60, 65]), (38, [50, 53, 57, 62]), (46, [58, 62, 65, 70]), (48, [55, 60, 64, 67])]
MEL2 = [[(0, 77, 1.5), (2, 76, 1), (3, 72, 1)], [(0, 74, 2), (2.5, 77, 1.5)], [(0, 81, 1), (1, 79, 1), (2, 77, 2)], [(0, 76, 1.5), (2, 79, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: Feeloy section (F pad, pluck arps, glock)")
for m, dt in [(53, 0), (57, 0.12), (60, 0.24), (65, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (41, 53, 57, 60, 65)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(CARD), 0.5, 0.3)
cue(F(CARD), "music: end-card chord + music box + triangle")
ir = make_ir(1.4, 11, hf=0.8)
mus = mus * 0.78 + convolve_st(mus, ir)[:, :N] * 0.22
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def beep(t, f=1400.0, d=0.08, g=0.3, p=0.0):
    x = np.sin(2 * np.pi * f * np.arange(ns(d)) / SR); put(sfx, fades(x, 0.004, 0.02), t, g, p)
def whirr(t, d=0.5, g=0.2, p=0.0):
    n = ns(d); f = 180 + 120 * np.sin(np.linspace(0, np.pi, n)); x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.3
    put(sfx, fades(lp(x, 900) * np.hanning(n), 0.02, 0.05), t, g, p)
put(sfx, G.breeze(F(205), R, 0.6, gust=0.15, bright=500), 0, 0.2); cue(0.0, "sfx: thin Martian wind")
for f in (40, 160): whirr(F(f), 0.5, 0.25)
beep(F(53), 1600); beep(F(57), 1900)
put(sfx, G.whoosh(0.25, R, peak=0.1), F(100), 0.3); beep(F(100), 500, 0.18, 0.3); cue(F(100), "sfx: buzzer on the X")
for k in range(5): popb(F(122) + k * 0.13, 0.25)
whoosh(F(169), 0.5, 0.5); popb(F(175), 0.4)
put(sfx, G.breeze(F(310) - F(205), R, 1.0, gust=0.7, bright=900), F(205), 0.55); cue(F(205), "sfx: dust storm")
for k in range(4): beep(F(276) + k * 0.22, 1200 - k * 220, 0.12, 0.25 - k * 0.04)
cue(F(276), "sfx: power-down beeps (went quiet)")
put(sfx, G.breeze(F(468) - F(310), R, 0.5, gust=0.2, bright=400), F(310), 0.22)
for k in range(3): beep(F(318) + k * 0.25, 1700, 0.06, 0.18)
for k in range(4): beep(F(395) + k * 0.5, 900, 0.1, 0.22)
beep(F(445), 300, 0.6, 0.25); cue(F(445), "sfx: a last low tone (getting dark)")
n = ns(F(701) - F(468)); put(sfx, fades(lp(colored(n, R, 1.0), 300) * 0.3, 0.2, 0.4), F(468), 0.15); cue(F(468), "sfx: control-room hum")
for k in range(9): beep(F(500) + k * 0.33, 1050, 0.14, 0.18, 0.3); beep(F(500) + k * 0.33 + 0.15, 780, 0.14, 0.14, 0.3)
cue(F(500), "sfx: repeated calls, no answer")
for f in (475, 540): popb(F(f), 0.35)
put(sfx, G.clink(R), F(603), 0.3); cue(F(603), "sfx: play button")
put(sfx, G.breeze(F(701) - F(650), R, 0.4, gust=0.1, bright=400), F(650), 0.15); popb(F(676), 0.35)
n = ns(DUR - F(701)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(701), 0.15)
put(sfx, G.crickets(F(860) - F(701), R, 3), F(701), 0.1, 0.3); cue(F(701), "sfx: night room, crickets")
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(804), 0.55, 0.0); cue(F(804), "sfx: Feeloy chime (phone)")
popb(F(833), 0.45)
whoosh(F(860), 0.5, 0.45); cue(F(860), "sfx: end-card whoosh")

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
