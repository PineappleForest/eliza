"""Fit a user-supplied narration take (one continuous file) into the locked picture's phrase slots.
1. find pauses (>= 0.12 s) in the take; speech runs between them
2. dynamic programming: group the runs into the script's phrases so each phrase's length matches its slot length
   (scaled by the take's overall pace), preferring boundaries on longer pauses (sentence ends)
3. each phrase is time-fitted with ffmpeg atempo into its slot and placed at the slot start
4. word timings for captions: each group's words are spread over its voiced runs (after the fit), weighted by
   phoneme count (espeak via kokoro_onnx when available, else letters) -> <out voice>.words.json
usage: python3 -I fit_voice.py <take audio> <phrases.json> <out voice.wav> [report.txt]
"""
import json, os, subprocess, sys, tempfile, wave
import numpy as np

SR = 48000
take, phrases_json, out_wav = sys.argv[1:4]
report_path = sys.argv[4] if len(sys.argv) > 4 else None

def load(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)

def save(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())

def atempo(x, k):
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        save(a, x)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a, "-filter:a", f"atempo={k:.5f}", b], check=True)
        return load(b)

x = load(take)
P = json.load(open(phrases_json))["phrases"]
env = np.convolve(np.abs(x), np.ones(480) / 480, "same")
on = env > 0.03 * np.percentile(env, 99)
# speech runs separated by gaps >= 0.12 s
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
R, K = len(runs), len(P)
slots = np.array([p["end"] - p["start"] for p in P])
speech = sum((b - a) for a, b in runs) / SR
pace = speech / slots.sum()  # take seconds per slot second (overall)
sent_end = [p["text"].rstrip()[-1] in ".?!:" for p in P]
# DP over (speech runs used, phrases used): one step = a group of 1-4 consecutive phrases read as 1+ consecutive runs.
# A group is fitted as a whole into [first phrase start, last phrase end], so sync holds at every group boundary.
INF = 1e18
dp = np.full((R + 1, K + 1), INF); bk = {}; dp[0, 0] = 0
for k in range(1, K + 1):
    for m in range(1, min(4, k) + 1):
        k0 = k - m
        exp = (P[k - 1]["end"] - P[k0]["start"]) * pace
        for r in range(1, R + 1):
            for r0 in range(0, r):
                if dp[r0, k0] >= INF: continue
                dur = (runs[r - 1][1] - runs[r0][0]) / SR
                c = dp[r0, k0] + 3.0 * np.log(dur / exp) ** 2 + 0.04 * (m - 1)
                c -= 0.12 * min(gap_after[r - 1], 0.6) * (1.5 if sent_end[k - 1] else 1.0)
                if c < dp[r, k]: dp[r, k] = c; bk[(r, k)] = (r0, k0)
groups, r, k = [], R, K
while k > 0:
    r0, k0 = bk[(r, k)]; groups.append((k0, k, runs[r0][0], runs[r - 1][1])); r, k = r0, k0
groups.reverse()
out = np.zeros(int(round(61.548 * SR)))
import re
try:
    from kokoro_onnx.tokenizer import Tokenizer
    _tk = Tokenizer()
    weight = lambda w: max(1, len(_tk.phonemize(w.replace(".", " ").replace("1966", "nineteen sixty six"), "en-us")))
except Exception:
    weight = lambda w: max(1, len(w))
WORDS = []
lines = [f"take {len(x)/SR:.2f}s, {R} speech runs, overall pace x{pace:.3f}, {len(groups)} groups"]
for (k0, k1, a, b) in groups:
    start, end = P[k0]["start"], P[k1 - 1]["end"]
    seg = x[max(0, a - 240): b + 480]
    slot = end - start; L = (b - a) / SR
    t = min(1.5, max(0.7, L / slot))
    y = atempo(seg, t) if abs(t - 1) > 0.01 else seg
    i0 = max(0, int(start * SR) - int(240 / t)); m = min(len(y), len(out) - i0)
    y = y[:m] * np.r_[np.linspace(0, 1, 96), np.ones(max(0, m - 192)), np.linspace(1, 0, 96)][:m]
    out[i0: i0 + m] += y
    spill = len(y) / SR - slot - 0.015
    # caption word timings: voiced runs of this group mapped into the picture's time, words spread over them
    vr = [((max(ra, a) - a) / SR / t + start, (min(rb, b) - a) / SR / t + start) for ra, rb in runs if rb > a and ra < b]
    toks = [w for p in P[k0:k1] for w in re.findall(r"[A-Za-z0-9'.-]+", p["text"].replace("M I T.", "M.I.T."))]
    wt = [weight(w) for w in toks]; tot = sum(wt); vt = sum(e - s_ for s_, e in vr)
    def at(u):  # u in [0, vt] voiced seconds -> picture time
        for s_, e in vr:
            if u <= e - s_: return s_ + u
            u -= e - s_
        return vr[-1][1]
    c = 0.0
    for w, n in zip(toks, wt):
        WORDS.append({"w": w, "s": round(at(vt * c / tot), 3), "e": round(at(vt * (c + n) / tot), 3)}); c += n
    txt = " / ".join(p["text"] for p in P[k0:k1])
    lines.append(f"{k0:2d}-{k1-1:2d} take [{a/SR:6.2f}-{b/SR:6.2f}] {L:5.2f}s -> slot {start:6.2f}-{end:6.2f} ({slot:5.2f}s) tempo x{t:.2f}{'  SPILL %+.2fs' % spill if spill > 0.08 else ''}  {txt[:70]}")
out = out / max(1e-9, np.abs(out).max()) * 0.89
save(out_wav, out)
txt = "\n".join(lines)
print(txt)
if report_path: open(report_path, "w").write(txt + "\n")
json.dump({"words": WORDS}, open(out_wav.rsplit(".", 1)[0] + ".words.json", "w"), indent=0)
print(len(WORDS), "caption words")
