"""Speech bursts (energy > max-38 dB, gaps >= 60 ms) with syllable-peak counts, grouped by aligned unit, plus the
aligned words of each unit. usage: python3 -I tools/bursts.py take/mono.wav voice/units.json voice/words.json"""
import json, sys, numpy as np, wave
from scipy.signal import find_peaks, butter, sosfilt
w = wave.open(sys.argv[1]); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float)
h = 160; n = len(x) // h
e = 10 * np.log10(np.array([np.mean(x[i*h:(i+1)*h]**2) + 1 for i in range(n)])); on = e > e.max() - 38
y = sosfilt(butter(4, [300, 2500], 'bandpass', fs=16000, output='sos'), x)
eb = np.convolve(10 * np.log10(np.array([np.mean(y[i*h:(i+1)*h]**2) + 1 for i in range(n)])), np.ones(5) / 5, 'same')
pk, _ = find_peaks(eb, height=eb.max() - 24, prominence=3.5, distance=9)
bs = []; i = 0
while i < n:
    if on[i]:
        j = i
        while j < n and (on[j] or on[j:j+6].any()): j += 1
        if j - i > 4: bs.append((i / 100, j / 100))
        i = j
    else: i += 1
U = json.load(open(sys.argv[2])); W = json.load(open(sys.argv[3]))['words']
for u in U:
    a, b = u['start'] - 0.3, u['end'] + 0.3
    print(f"\n[{u['start']:.2f}-{u['end']:.2f}] {u['text']}")
    print('  bursts:', '  '.join(f"{s:.2f}-{t:.2f}({sum(1 for p in pk if s*100 <= p < t*100)})" for s, t in bs if s >= a and t <= b))
    print('  words :', ' '.join(f"{i}:{d['w']}@{d['s']:.2f}" for i, d in enumerate(W) if u['start'] - 0.01 <= d['s'] < u['end']))
