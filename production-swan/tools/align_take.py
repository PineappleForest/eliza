"""Align a narration take (one continuous file) to its script without speech recognition.
The script is split into units (script.json: list of strings, in reading order). Speech runs are found between pauses
(>= 0.12 s); a dynamic program groups 1-3 consecutive units onto consecutive runs so each group's length matches its
expected length (phoneme count x the take's average pace), preferring group boundaries on longer pauses. Inside a group,
words are spread over its voiced runs by phoneme count.
Writes words.json ({duration, words:[{w,s,e}]}) and units.json ([{text,start,end}]).
usage: python3 -I align_take.py <take.wav|mp3> <script.json> <outdir>
"""
import json, os, re, subprocess, sys
import numpy as np

SR = 48000
take, script_json, outdir = sys.argv[1:4]
raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", take, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], check=True, capture_output=True).stdout
x = np.frombuffer(raw, np.float32).astype(np.float64)
U = json.load(open(script_json))
try:
    from kokoro_onnx.tokenizer import Tokenizer
    _tk = Tokenizer()
    def weight(w):
        w = w.replace("1966", "nineteen sixty six")
        return max(1, len(_tk.phonemize(w, "en-us")))
except Exception:
    weight = lambda w: max(1, len(w))
TOK = lambda s: re.findall(r"[A-Za-z0-9']+", s)
uw = [[weight(w) for w in TOK(u)] for u in U]
ucost = np.array([sum(a) for a in uw], float)

env = np.convolve(np.abs(x), np.ones(480) / 480, "same")
on = env > 0.03 * np.percentile(env, 99)
gaps, i, n = [], 0, len(on)
while i < n:
    if not on[i]:
        j = i
        while j < n and not on[j]: j += 1
        if (j - i) / SR >= 0.12: gaps.append((i, j))
        i = j
    else: i += 1
runs, s0 = [], 0
for a, b in gaps:
    if a > s0: runs.append((s0, a))
    s0 = b
if s0 < n: runs.append((s0, n))
runs = [(a, b) for a, b in runs if (b - a) / SR > 0.05]
gap_after = [(runs[k + 1][0] - runs[k][1]) / SR for k in range(len(runs) - 1)] + [1.0]
R, K = len(runs), len(U)
speech = sum(b - a for a, b in runs) / SR
pace = speech / ucost.sum()  # seconds per phoneme
sent_end = [u.rstrip()[-1] in ".?!:" for u in U]
INF = 1e18
dp = np.full((R + 1, K + 1), INF); bk = {}; dp[0, 0] = 0
for k in range(1, K + 1):
    for m in range(1, min(3, k) + 1):
        k0 = k - m
        exp = ucost[k0:k].sum() * pace
        for r in range(1, R + 1):
            for r0 in range(0, r):
                if dp[r0, k0] >= INF: continue
                dur = (runs[r - 1][1] - runs[r0][0]) / SR
                c = dp[r0, k0] + 3.0 * np.log(dur / exp) ** 2 + 0.05 * (m - 1)
                c -= 0.6 * min(gap_after[r - 1], 0.6) * (1.5 if sent_end[k - 1] else 1.0)
                if c < dp[r, k]: dp[r, k] = c; bk[(r, k)] = (r0, k0)
groups, r, k = [], R, K
while k > 0:
    r0, k0 = bk[(r, k)]; groups.append((k0, k, r0, r)); r, k = r0, k0
groups.reverse()
words, units, rep = [], [], []
for (k0, k1, r0, r1) in groups:
    vr = [(runs[q][0] / SR, runs[q][1] / SR) for q in range(r0, r1)]
    toks = [w for u in U[k0:k1] for w in TOK(u)]; wts = [w for a in uw[k0:k1] for w in a]
    tot, vt = sum(wts), sum(e - s for s, e in vr)
    def at(u):
        for s, e in vr:
            if u <= e - s: return s + u
            u -= e - s
        return vr[-1][1]
    c = 0.0; first = len(words)
    for w, nn in zip(toks, wts):
        words.append({"w": w, "s": round(at(vt * c / tot), 3), "e": round(at(vt * (c + nn) / tot), 3)}); c += nn
    # unit boundaries inside the group follow the same spread
    idx = first
    for u in U[k0:k1]:
        m = len(TOK(u)); units.append({"text": u, "start": words[idx]["s"], "end": words[idx + m - 1]["e"]}); idx += m
    L = vr[-1][1] - vr[0][0]; E = ucost[k0:k1].sum() * pace
    rep.append(f"{k0:2d}-{k1-1:2d} [{vr[0][0]:6.2f}-{vr[-1][1]:6.2f}] {L:5.2f}s vs expected {E:5.2f}s (x{L/E:.2f})  {' / '.join(U[k0:k1])[:80]}")
os.makedirs(outdir, exist_ok=True)
json.dump({"duration": round(len(x) / SR, 3), "words": words}, open(os.path.join(outdir, "words.json"), "w"), indent=0)
json.dump(units, open(os.path.join(outdir, "units.json"), "w"), indent=1)
print(f"take {len(x)/SR:.2f}s, {R} runs, {len(groups)} groups, pace {pace*1000:.0f} ms/phoneme")
print("\n".join(rep))
