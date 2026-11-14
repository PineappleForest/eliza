"""Soundtrack for "The Loneliest Whale" (52 Hz -> Feeloy), 41.9 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/whale/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1258
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
# A slow, wide D-minor ocean: a deep pad, a music-box motif that "calls" and gets no answer, a low pulse and sonar pings
# for the Navy, a glock for 52 Hz, a gentle walking pluck for the twelve years, the motif per season, a hollow pad for
# "no second voice", a big lonely chord on LONELIEST, then the warm Feeloy section.
CALL = [(0, 74), (0.35, 77), (0.7, 81), (1.3, 79)]
def call(t0, g=0.5, up=0):
    for o, m in CALL: put(mus, I.musicbox(m2f(m + up), 0.45, R, 1.8), t0 + o, g, 0.2)
put(mus, I.pad([m2f(n) for n in (38, 50, 57, 62, 65)], F(338) + 0.5, 0.32, R, att=1.0, rel=0.8), 0, 0.75); cue(0.0, "music: deep D-minor ocean pad")
call(F(36)); cue(F(36), "music: the whale's music-box call (no answer)")
for k in range(int((F(338) - F(118)) / 0.9)): put(mus, I.pluck(m2f(38), 0.45, R, 0.8, 0.25), F(118) + k * 0.9, 0.6)
put(mus, mx(I.vibes(m2f(74), 0.4, R, 1.6), I.vibes(m2f(81), 0.3, R, 1.6)), F(274), 0.55); cue(F(118), "music: low Navy pulse; a vibes sting on the strange song")
put(mus, I.pad([m2f(n) for n in (41, 53, 57, 60, 65)], F(600) - F(338), 0.28, R, att=0.6, rel=0.6), F(338), 0.7)
call(F(352), 0.5, 3); put(mus, mx(I.glock(m2f(88), 0.5, R, 1.4), I.timpani(m2f(38), 0.6, R, 1.4)), F(389), 0.6)
for k, m in enumerate((62, 57, 53, 50)): put(mus, I.pluck(m2f(m - 12), 0.6, R, 1.0, 0.3), F(430) + k * 0.22, 0.7)
cue(F(352), "music: glock on 52 Hz; a falling bass for far lower")
b = 60 / 92
for k in range(int((F(600) - F(480)) / b)):
    ch = [[50, 57, 62], [46, 53, 58], [48, 55, 60], [45, 52, 57]][(k // 4) % 4]
    put(mus, I.pluck(m2f(ch[k % 3]), 0.4, R, 0.6, 0.5), F(480) + k * b, 0.5, 0.3 * ((k % 3) - 1))
cue(F(480), "music: a walking pluck for the twelve years")
put(mus, I.pad([m2f(n) for n in (38, 50, 57, 62, 65)], F(800) - F(600), 0.3, R, att=0.5, rel=0.6), F(600), 0.7)
for f0, up in [(606, 0), (630, 2), (654, -2)]: call(F(f0), 0.45, up)
put(mus, I.pad([m2f(n) for n in (38, 45, 50, 53)], F(862) - F(685), 0.2, R, att=0.4, rel=0.6), F(685), 0.5)
put(mus, I.pad([m2f(n) for n in (43, 50, 55, 58)], F(960) - F(800), 0.28, R, att=0.6, rel=0.6), F(800), 0.65)
call(F(880), 0.45, -5); put(mus, I.pad([m2f(n) for n in (38, 50, 53, 57, 62)], 2.4, 0.4, R, att=0.05, rel=1.2), F(910), 0.6); put(mus, I.cymbal(0.25, R, 2.0), F(910), 0.4)
cue(F(880), "music: the call, lower; a big lonely chord on LONELIEST")
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(1048) - F(960), 0.22, R, att=0.6, rel=0.6), F(960), 0.6)
B0, BEAT2, CARD = F(1046), 60 / 96, 1162
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
cue(B0, "music: Feeloy section turns to D major (the call is answered)")
for o, m in [(0, 74), (0.35, 78), (0.7, 81), (1.3, 86)]: put(mus, I.musicbox(m2f(m), 0.45, R, 1.8), F(1100) + o, 0.55, -0.2)
for m, dt in [(62, 0), (66, 0.12), (69, 0.24), (74, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (38, 50, 54, 57, 62)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(CARD), 0.5, 0.3)
cue(F(CARD), "music: end-card chord + music box + triangle")
ir = make_ir(1.8, 11, hf=0.7)
mus = mus * 0.75 + convolve_st(mus, ir)[:, :N] * 0.25
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def room(t0, t1, g=0.1):
    n = ns(t1 - t0); put(sfx, fades(lp(colored(n, R, 1.0), 700) * 0.4, 0.15, 0.15), t0, g)
def under(t0, t1, g=0.35):
    put(sfx, fades(lp(colored(ns(t1 - t0), R, 1.0), 260) * 0.8, 0.3, 0.3), t0, g)
    put(sfx, G.bubbles(t1 - t0, R, 0.5), t0, g * 0.25, 0.3)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def song(t, d=1.4, g=0.25, f0=230):
    f = f0 * (1 + 0.08 * np.sin(np.linspace(0, 3.2, ns(d)))); x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    put(sfx, fades(x * np.hanning(ns(d)) * 0.5, 0.05, 0.2), t, g, 0.2)
def ping(t, g=0.2): put(sfx, fades(np.sin(2 * np.pi * 1400 * np.arange(ns(1.0)) / SR) * np.exp(-np.arange(ns(1.0)) / SR * 5), 0.0, 0.1), t, g, -0.2)
for a_, b_ in [(0, 250), (338, 480), (600, 685), (862, 960)]: under(F(a_), F(b_))
cue(0.0, "sfx: underwater rumble and bubbles (deep shots)")
song(F(37), 1.3); song(F(352), 1.2, 0.25, 250); song(F(606), 0.8); song(F(630), 0.8); song(F(654), 0.8); song(F(880), 1.6, 0.22, 200)
cue(F(37), "sfx: the whale's song (a high hum)")
popb(F(88), 0.3); popb(F(122), 0.4); popb(F(160), 0.35)
put(sfx, fades(lp(colored(ns(3.2), R, 1.0), 180), 0.8, 1.0), F(190), 0.5, 0.3); cue(F(190), "sfx: submarine hum passing")
room(F(250), F(338), 0.12); ping(F(252)); ping(F(300)); popb(F(280), 0.35); song(F(272), 1.0, 0.15)
cue(F(252), "sfx: sonar pings in the station")
popb(F(340), 0.35); popb(F(370), 0.45); popb(F(430), 0.4)
room(F(480), F(600), 0.08); popb(F(498), 0.35)
for k in range(12): put(sfx, G.clink(R, 1600, 0.05, 0.5), F(498) + k * 0.19, 0.06, 0.3)
for f0 in (609, 622, 635, 648): popb(F(f0), 0.25, 0.3)
room(F(685), F(800), 0.08); popb(F(772), 0.4)
put(sfx, G.water_bed(F(862) - F(800), R, 0.7, 0.7), F(800), 0.3); put(sfx, G.breeze(F(862) - F(800), R, 1.0, gust=0.3, bright=900), F(800), 0.2)
popb(F(837), 0.4); cue(F(800), "sfx: open sea, waves, wind")
popb(F(891), 0.45)
n = ns(DUR - F(960)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(960), 0.15)
put(sfx, G.crickets(F(1162) - F(960), R, 3), F(960), 0.12, 0.3); popb(F(970), 0.3); cue(F(960), "sfx: night room, crickets")
put(sfx, mx(I.glock(m2f(86), 0.5, R, 0.8), I.glock(m2f(93), 0.4, R, 0.8)), F(1076), 0.55, 0.0); cue(F(1076), "sfx: Feeloy chime (phone)")
popb(F(1100), 0.45)
whoosh(F(1162), 0.5, 0.45); cue(F(1162), "sfx: end-card whoosh")
whoosh(F(118), 0.5, 0.6)

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
