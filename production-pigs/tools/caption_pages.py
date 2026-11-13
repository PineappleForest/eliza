"""Caption pages for the karaoke subtitles: script lines -> pages of <= 3 words / <= 16 characters, split inside each
line so the pages are balanced (no orphan single words where avoidable). Word times come from fit_voice.py.
usage: python3 caption_pages.py <phrases.json> <voice.words.json> <out captions.json>"""
import json, re, sys
P = json.load(open(sys.argv[1]))["phrases"]; W = json.load(open(sys.argv[2]))["words"]
def split(disp):
    n = len(disp); best = {0: (0.0, [])}
    for j in range(1, n + 1):
        for i in range(max(0, j - 3), j):
            txt = " ".join(d["t"] for d in disp[i:j])
            if len(txt) > 16 and j - i > 1: continue
            c = best[i][0] + (2.0 if j - i == 1 and n > 1 else 0) + (0.6 if j - i == 2 else 0) + 0.2 * max(0, len(txt) - 12)
            if j not in best or c < best[j][0]: best[j] = (c, best[i][1] + [(i, j)])
    return [disp[i:j] for i, j in best[n][1]]
pages, k = [], 0
for p in P:
    toks = [w.replace("lightday", "light-day").replace("rentaguineapig", "rent-a-guinea-pig") for w in re.findall(r"\$?[A-Za-z0-9']+(?:,[0-9]+)*", p["text"])]
    ws = W[k:k + len(toks)]; k += len(toks)
    assert [w["w"] for w in ws] == toks
    disp = []
    for w in ws:
        t = w["w"] if w["w"] == "M.I.T." else w["w"].rstrip(".")
        if t == "sixty-six" and disp and disp[-1]["t"] == "nineteen": disp[-1] = {"t": "1966", "s": disp[-1]["s"], "e": w["e"]}; continue
        disp.append({"t": t, "s": w["s"], "e": w["e"]})
    pages += split(disp)
out = [{"s": pg[0]["s"], "e": pg[-1]["e"], "w": [[d["t"], d["s"], d["e"]] for d in pg]} for pg in pages]
json.dump(out, open(sys.argv[3], "w"), separators=(",", ":"))
print(len(out), "pages:", " | ".join(" ".join(w[0] for w in pg["w"]) for pg in out))
