"""Soundtrack for "A Town Under One Roof" (Whittier, Alaska -> Feeloy), 64.7 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/tower/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1942
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
# A bright D-major pluck groove with a glock tune for the snowy harbour town, a tuba hit on ONE BUILDING, rising glock
# for the floors and a brass stab on 14 FLOORS, a snare march + bugle for the army, a warm pad for the family, a ding per
# floor of the cutaway, a cold windy pad with a timpani on 6 METRES, a rumbling low pulse for the tunnel, a cosy 3/4
# glock waltz for the hallway, a music box over the tower at night, a bare night, the Feeloy section.
CH = {"D": [50, 54, 57], "G": [55, 59, 62], "A": [57, 61, 64], "Bm": [59, 62, 66], "Em": [52, 55, 59]}
def groove(f0, f1, prog, mel=None, bpm=112, vel=0.8, waltz=False):
    b = 60 / bpm; per = 3 if waltz else 4; t = F(f0); k = 0
    while t < F(f1) - 0.3:
        ch = CH[prog[k % len(prog)]]
        put(mus, I.pluck(m2f(ch[0] - 12), 0.7 * vel, R, 1.2, 0.3), t, 0.85, -0.1)
        for j in range(per * 2): put(mus, I.pluck(m2f(ch[j % 3] + 12), 0.3 * vel, R, 0.4, 0.6), t + j * b / 2, 0.5, 0.3 * (1 if j % 2 else -1))
        for (o, m, d) in (mel[k % len(mel)] if mel else []): put(mus, I.glock(m2f(m), 0.42 * vel, R, d * b + 0.6), t + o * b, 0.65, 0.15)
        t += per * b; k += 1
MELA = [[(0, 74, 1), (1, 78, 1), (2, 81, 2)], [(0, 79, 1), (1, 78, 1), (2, 76, 2)], [(0, 74, 1), (1, 76, 1), (2, 78, 1), (3, 81, 1)], [(0, 78, 2), (2, 74, 2)]]
MEL3 = [[(0, 74, 1), (1, 78, 1), (2, 81, 1)], [(0, 79, 2), (2, 78, 1)], [(0, 76, 1), (1, 78, 1), (2, 79, 1)], [(0, 78, 3)]]
groove(0, 303, ["D", "G", "Bm", "A"], MELA, vel=0.75); cue(0.0, "music: bright D pluck groove + glock (snowy harbour)")
put(mus, mx(I.brass(m2f(38), 0.6, 0.9, R, kind="tuba"), I.timpani(m2f(38), 0.6, R, 1.6)), F(112), 0.8); cue(F(112), "music: tuba + timpani on ONE BUILDING")
for k in range(14): put(mus, I.glock(m2f(62 + [0, 2, 4, 5, 7, 9, 11][k % 7] + 12 * (k // 7)), 0.32, R, 0.6), F(243 + k * 2), 0.5, 0.25 * ((k % 3) - 1))
put(mus, mx(I.brass(m2f(62), 0.5, 0.8, R), I.brass(m2f(66), 0.5, 0.75, R), I.brass(m2f(69), 0.5, 0.75, R)), F(272), 0.7); cue(F(243), "music: rising glock per floor; brass stab on 14 FLOORS")
# the army: a snare march and a little bugle call, then a warm pad as the family moves in
b = 60 / 116
for k in range(int((F(420) - F(308)) / (b / 2))):
    t = F(308) + k * b / 2; put(mus, I.snare(0.55 if k % 4 == 0 else 0.32, R), t, 0.5, 0.1)
    if k % 2 == 0: put(mus, I.pluck(m2f(CH["D"][0] - 12 if (k // 8) % 2 == 0 else CH["A"][0] - 12), 0.6, R, 0.5, 0.3), t, 0.7)
for o, m, d in [(0, 62, 0.25), (0.26, 62, 0.25), (0.52, 69, 0.5), (1.04, 66, 0.25), (1.3, 69, 0.7)]: put(mus, I.brass(m2f(m), d, 0.7, R, kind="stab"), F(340) + o, 0.45, 0.2)
cue(F(308), "music: snare march + bugle (the army)")
put(mus, I.pad([m2f(n) for n in (50, 57, 62, 66)], F(458) - F(420), 0.28, R, att=0.4, rel=0.5), F(420), 0.7)
groove(458, 760, ["D", "Bm", "G", "A"], MELA, bpm=116, vel=0.8); cue(F(458), "music: groove returns (cutaway, school)")
for k, f in enumerate((494, 529, 547, 566, 594)): put(mus, I.glock(m2f(81 + [0, 2, 4, 5, 7][k]), 0.45, R, 1.2), F(f), 0.6, 0.2)
cue(F(494), "music: a glock ding per floor of the cutaway")
put(mus, I.pad([m2f(n) for n in (47, 54, 59, 62)], F(890) - F(760), 0.3, R, att=0.5, rel=0.6), F(760), 0.7)
for k, m in enumerate((74, 71, 69, 66)): put(mus, I.vibes(m2f(m), 0.35, R, 1.8), F(770) + k * 0.6, 0.5, 0.2)
put(mus, mx(I.timpani(m2f(38), 0.8, R, 2.0), I.brass(m2f(50), 0.6, 0.8, R, kind="tuba")), F(838), 0.8); put(mus, I.cymbal(0.35, R, 2.0), F(838), 0.3, 0.2)
cue(F(760), "music: cold vibes descending; timpani on 6 METRES")
t = F(890)
while t < F(1072) - 0.3:
    put(mus, I.pluck(m2f(38), 0.65, R, 0.9, 0.25), t, 0.85); put(mus, I.pluck(m2f(45), 0.4, R, 0.6, 0.3), t + 0.25, 0.6); t += 0.5
put(mus, I.pad([m2f(n) for n in (50, 55, 59)], F(1072) - F(890), 0.22, R, att=0.4, rel=0.4), F(890), 0.6)
put(mus, mx(I.brass(m2f(56), 0.25, 0.85, R), I.brass(m2f(59), 0.25, 0.85, R), I.brass(m2f(62), 0.6, 0.85, R)), F(1056), 0.7); cue(F(890), "music: low tunnel pulse; stab on CLOSED")
put(mus, I.pad([m2f(n) for n in (50, 57, 62, 66)], F(1168) - F(1072), 0.3, R, att=0.6, rel=0.5), F(1072), 0.7)
for o, m in [(0, 78), (0.8, 76), (1.6, 74)]: put(mus, I.musicbox(m2f(m + 12), 0.35, R, 1.4), F(1080) + o, 0.5, 0.2)
groove(1168, 1394, ["D", "G", "A", "D", "Bm", "G", "A", "D"], MEL3, bpm=138, vel=0.8, waltz=True); cue(F(1168), "music: cosy 3/4 glock waltz (the hallway)")
put(mus, mx(I.brass(m2f(62), 0.5, 0.8, R), I.brass(m2f(66), 0.5, 0.75, R), I.brass(m2f(69), 0.5, 0.75, R), I.cymbal(0.3, R, 1.6)), F(1371), 0.7)
put(mus, I.pad([m2f(n) for n in (50, 57, 62, 66)], F(1512) - F(1394), 0.25, R, att=0.6, rel=0.6), F(1394), 0.7)
for k, (f, m) in enumerate([(1418, 78), (1432, 81), (1446, 83), (1458, 81), (1468, 78), (1478, 76), (1494, 86)]): put(mus, I.musicbox(m2f(m), 0.45, R, 1.6), F(f), 0.65, 0.3 * ((k % 3) - 1))
cue(F(1394), "music: music box per heart (the tower at night)")
put(mus, I.pad([m2f(n) for n in (47, 54, 59, 62)], F(1738) - F(1512), 0.2, R, att=0.8, rel=0.6), F(1512), 0.6)
B0, BEAT2, CARD = F(1704), 60 / 96, 1846
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
def room(t0, t1, g=0.1):
    n = ns(t1 - t0); put(sfx, fades(lp(colored(n, R, 1.0), 700) * 0.4, 0.15, 0.15), t0, g)
def wind(t0, t1, g=0.35, bright=700):
    d = t1 - t0; put(sfx, fades(G.breeze(d, R, 1.0, gust=0.35, bright=bright), 0.3, 0.3), t0, g)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def gull(t, g=0.15, p=0.0):
    d = 0.35; f = np.r_[np.linspace(1500, 2300, ns(0.1)), np.linspace(2300, 1300, ns(d) - ns(0.1))]
    put(sfx, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(ns(d)) * (1 + 0.3 * np.sin(2 * np.pi * 30 * tt(d))), t, g, p)
def horn(t, d=1.2, g=0.4):
    x = sum(np.sign(np.sin(2 * np.pi * f * tt(d))) * a for f, a in [(277, 0.5), (349, 0.4), (415, 0.35)])
    put(sfx, fades(lp(x, 2200) * 0.35, 0.05, 0.25), t, g)
wind(0, F(303), 0.28, 900); put(sfx, G.water_bed(F(303), R, 0.6, 0.6), 0, 0.12)
for t0 in (0.8, 2.6, 5.9, 8.4): gull(t0, 0.12, 0.5 * (1 if t0 > 3 else -1))
cue(0.0, "sfx: harbour wind, water, gulls")
popb(F(72), 0.4); popb(F(112), 0.5); put(sfx, G.push_thump(R), F(112), 0.6); popb(F(140), 0.4)
for k in range(14): put(sfx, G.clink(R, 1200 + 60 * k, 0.08, 0.6), F(243 + k * 2), 0.12, -0.4)
popb(F(272), 0.45)
wind(F(303), F(458), 0.18)
for k in range(int((F(345) - F(308)) / 0.36)): put(sfx, G.boot(R, 0.6), F(308) + k * 0.36, 0.25, 0.2 * (k % 2) - 0.1)
for k in range(int((F(440) - F(404)) / 0.36)): put(sfx, G.boot(R, 0.6), F(404) + k * 0.36, 0.25, 0.3)
popb(F(345), 0.4); cue(F(308), "sfx: marching boots on snow")
for k in range(6): put(sfx, G.stroll_step(R, 0.6), F(420) + k * 0.5, 0.18, -0.2)
popb(F(452), 0.35); room(F(458), F(608), 0.07)
popb(F(461), 0.45); whoosh(F(461), 0.4, 0.35)
for f in (494, 529, 547, 566, 594): popb(F(f), 0.4, 0.2)
wind(F(608), F(670), 0.22); popb(F(616), 0.4); whoosh(F(642), 0.35, 0.3, 0.3)
room(F(670), F(760), 0.12)
for k in range(10): put(sfx, G.stroll_step(R, 0.4), F(672) + k * 0.42, 0.14, 0.3 * ((k % 3) - 1))
put(sfx, G.babble(F(760) - F(680), R, 330, 1.5, rate=5.0, active=0.5), F(680), 0.08)
popb(F(722), 0.35); cue(F(670), "sfx: kids' footsteps and chatter echo in the tunnel")
wind(F(760), F(890), 0.55, 600); cue(F(760), "sfx: snow storm wind")
put(sfx, fades(lp(colored(ns(1.8), R, 1.0), 900) * 0.6, 0.3, 0.4), F(790), 0.35)
put(sfx, G.push_thump(R), F(838), 0.5); popb(F(838), 0.45); whoosh(F(862), 0.4, 0.4); popb(F(866), 0.4)
room(F(890), F(1072), 0.14); popb(F(971), 0.4)
put(sfx, fades(lp(colored(ns(F(1046) - F(990)), R, 1.0), 220) * 1.0, 0.6, 0.3), F(990), 0.5); horn(F(1004), 1.3, 0.35)
cue(F(1004), "sfx: train rumble + horn out of the tunnel")
put(sfx, G.creak(0.4, R, 120, 70), F(1040), 0.25); put(sfx, mx(G.push_thump(R), G.clink(R, 500, 0.2, 0.3)), F(1052), 0.5)
put(sfx, mx(G.push_thump(R), G.clink(R, 600, 0.15, 0.3)), F(1056), 0.75); popb(F(1062), 0.35); cue(F(1052), "sfx: barrier thunk; STAMP")
room(F(1072), F(1394), 0.08)
put(sfx, fades(G.breeze(1.0, R, 1.0, gust=0.5, bright=900), 0.05, 0.4), F(1116), 0.6, 0.4); whoosh(F(1116), 0.4, 0.4, 0.4); popb(F(1122), 0.3)
cue(F(1116), "sfx: a blast of wind and snow at the door")
for f, p in [(1174, 0.35), (1206, 0.0), (1240, -0.35)]: popb(F(f), 0.4, p); put(sfx, G.creak(0.3, R, 160, 200), F(f) - 0.2, 0.1, p)
for k in range(3): popb(F(1264 + k * 3), 0.3, 0.3 * (k - 1))
put(sfx, G.babble(F(1394) - F(1290), R, 300, 1.4, rate=4.5, active=0.3), F(1290), 0.05)
popb(F(1296), 0.4); popb(F(1371), 0.45); popb(F(1380), 0.3)
wind(F(1394), F(1512), 0.2, 600)
for f in (1418, 1432, 1446, 1458, 1468, 1478, 1494): popb(F(f), 0.25, 0.3)
n = ns(DUR - F(1512)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(1512), 0.15)
wind(F(1512), F(1846), 0.08, 500); cue(F(1512), "sfx: night: room hum, faint wind")
for f in (1530, 1589, 1624, 1650): popb(F(f), 0.3)
put(sfx, mx(I.glock(m2f(86), 0.5, R, 0.8), I.glock(m2f(93), 0.4, R, 0.8)), F(1738), 0.55, 0.0); cue(F(1738), "sfx: Feeloy chime (phone)")
popb(F(1806), 0.45)
whoosh(F(1846), 0.5, 0.45); cue(F(1846), "sfx: end-card whoosh")
whoosh(F(138), 0.5, 0.6)

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
