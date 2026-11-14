// Our own flat 2D cartoon cast (riflemen, officer, townsfolk, kid, parent) + 2D effects, drawn on a canvas.
// Construction v2 (characters.md, our own cast): superellipse heads (pointed crown 1.75 / full jaw 2.3, chin taper,
// seeded side bulge + tilt), bean torsos, single-stroke limbs with ink-dot hands, a thick-thin plum outline weighted
// away from the light, soft painted crescents, deadpan lidded eyes, no blush, no catchlights.
// Design space 600 x 1000 units (soles at y = 975); the canvas transform scales it.
export const INK = "#241726";
export const SKIN = "#ffe2c2";
const WHITE = "#ffffff";
const MOUTH = "#5a1e28";
const TONGUE = "#e86e78";
type C3 = [number, number, number];
const SH_SKIN: C3 = [0.96, 0.86, 0.84]; // measured shadow/lit ratio on skin heads
const SH_CLOTH: C3 = [0.64, 0.66, 0.74]; // torsos: lit side -> far side ~0.65
const SH_FELT: C3 = [0.62, 0.62, 0.7];

export type Build = "adult" | "stout" | "kid";
export type Outfit = {
  jacket: string; pants: string; boots: string; hat?: string | null; belt?: string | null; buttons?: string; rifle?: boolean;
  sash?: string; sword?: boolean; moustache?: string; skin?: string; head?: number; cap?: string; hair?: string; dress?: string;
  build?: Build;
  /** long hair hanging behind the head to the shoulders (colour), a high ponytail (colour), coloured streaks over the hair,
   *  iris colour (eyes drawn as coloured ovals with an ink rim), round glasses, a shirt collar colour */
  longHair?: string; ponytail?: string; streak?: string; eyes?: string; glasses?: boolean; collar?: string;
};
type P2 = [number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const mul = (c: string, m: C3) => {
  const n = parseInt(c.slice(1), 16);
  const ch = (v: number, k: number) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255, m[0])}${ch((n >> 8) & 255, m[1])}${ch(n & 255, m[2])}`;
};
export const shade = (c: string, k: number) => mul(c, [k, k, k]);
export const mix = (a: string, b: string, t: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
/** deterministic per-character random in [0, 1) */
const rnd = (seed: number, k: number) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const rotPts = (pts: P2[], a: number, cx: number, cy: number): P2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
const rotAbout = (q: P2, a: number, c: P2): P2 => rotPts([q], a, c[0], c[1])[0];
const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** smooth curve from a through (near) k to b, as a polyline */
const curve = (a: P2, k: P2, b: P2, n = 10): P2[] => {
  const c: P2 = [2 * k[0] - (a[0] + b[0]) / 2, 2 * k[1] - (a[1] + b[1]) / 2], out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t;
    out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]);
  }
  return out;
};

export const RIFLEMAN: Outfit = { jacket: "#357650", pants: "#3d4440", boots: INK, hat: "shako", belt: "#f1efe6", buttons: "#d9dde0", rifle: true };
export const OFFICER: Outfit = { ...RIFLEMAN, hat: "shako_tall", buttons: "#e8c45a", sash: "#c0353a", sword: true, moustache: "#4a3020", rifle: false, belt: null, build: "stout" };
export const KID: Outfit = { jacket: "#f08a2c", pants: "#3b5b9a", boots: "#f4f1ea", hat: "cap", cap: "#e2453c", build: "kid" };
export const PARENT: Outfit = { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#5a3b2a" };
export const SKINS = [SKIN, "#f5c9a0", "#ecd0b6", "#c99067"];

export const soldier = (v = 0, extra: Partial<Outfit> = {}): Outfit => {
  const o: Outfit = { ...RIFLEMAN, skin: SKINS[v % 4] };
  if (v % 4 === 1) o.moustache = "#4a3426";
  if (v % 4 === 3) o.moustache = "#2a201a";
  return { ...o, ...extra };
};

export const townsfolk = (v = 0): Outfit => {
  const coats = ["#3f6fb5", "#8c3b4a", "#5d7a3a", "#b5653f", "#2f5f6a", "#7b5ac9"];
  const o: Outfit = { jacket: coats[v % 6], pants: "#3b3f52", boots: "#4a3426", skin: SKINS[v % 4] };
  return v % 2 ? { ...o, hat: "bonnet", dress: ["#d9a441", "#c25a7a", "#5a8fc2"][v % 3] } : { ...o, hat: "tophat" };
};

export class Pen {
  g: CanvasRenderingContext2D;
  ol = 12;
  /** [angle, cx, cy] rotation about (cx, cy), optional post-translation [.., dx, dy] */
  rot: number[] | null = null;
  constructor(g: CanvasRenderingContext2D) { this.g = g; }
  P(x: number, y: number): P2 {
    if (!this.rot) return [x, y];
    const r = this.rot, a = r[0], cx = r[1], cy = r[2], dx = r.length > 3 ? r[3] : 0, dy = r.length > 4 ? r[4] : 0, c = Math.cos(a), s = Math.sin(a);
    return [cx + (x - cx) * c - (y - cy) * s + dx, cy + (x - cx) * s + (y - cy) * c + dy];
  }
  path(pts: P2[], close: boolean) {
    const g = this.g;
    g.beginPath();
    pts.forEach((p, i) => { const [x, y] = this.P(p[0], p[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    if (close) g.closePath();
  }
  /** filled shape with an ink outline; fill=null draws the outline only */
  poly(pts: P2[], fill: string | null, ol?: number) {
    const g = this.g, w = ol ?? this.ol;
    this.path(pts, true);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (w) { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke(); }
  }
  ell(cx: number, cy: number, rx: number, ry: number, fill: string | null, ol?: number, a0 = 0, a1 = 360, rot = 0) {
    this.poly(ellPts(cx, cy, rx, ry, a0, a1, rot), fill, ol);
  }
  /** thick round-capped limb with an ink rim (effects, rope) */
  line(pts: P2[], fill: string, w: number, ink = true) {
    const g = this.g;
    g.lineCap = "round"; g.lineJoin = "round";
    if (ink) { this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * this.ol * 0.9; g.stroke(); }
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  stroke(pts: P2[], w: number, fill = INK) {
    const g = this.g;
    g.lineCap = "round"; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, w: number, fill = INK) {
    const pts: P2[] = [];
    for (let i = 0; i <= 24; i++) pts.push([cx + rx * Math.cos(rad(a0 + ((a1 - a0) * i) / 24)), cy + ry * Math.sin(rad(a0 + ((a1 - a0) * i) / 24))]);
    this.stroke(pts, w, fill);
  }
  dot(cx: number, cy: number, r: number, fill = INK) {
    const [x, y] = this.P(cx, cy);
    this.g.beginPath(); this.g.arc(x, y, r, 0, Math.PI * 2); this.g.fillStyle = fill; this.g.fill();
  }
  /** draw with a closed shape as clip */
  clip(pts: P2[], fn: () => void) { const g = this.g; g.save(); this.path(pts, true); g.clip(); fn(); g.restore(); }
  /** flat fill + soft crescent on the side away from the light (light = canvas angle the light comes FROM).
   *  Radial ramp centred `shift` R toward the light: flat out to ~0.6 R on the far side, full shadow by ~0.8 R. */
  shadedFill(pts: P2[], base: string, shadow: string, light: number, R: number, shift = 0.45, r0 = 1.05, r1 = 1.25) {
    const g = this.g, n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const [gx, gy] = this.P(cx + Math.cos(light) * shift * R, cy + Math.sin(light) * shift * R);
    const gr = g.createRadialGradient(gx, gy, 0, gx, gy, r1 * R);
    gr.addColorStop(0, base); gr.addColorStop(r0 / r1, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  /** broad gradient across a shape along the light: lit edge = base, far edge = shadow (torsos, coats) */
  gradFill(pts: P2[], base: string, shadow: string, light: number, flat = 0.22) {
    const g = this.g, dx = Math.cos(light), dy = Math.sin(light), n = pts.length;
    let cx = 0, cy = 0, lo = Infinity, hi = -Infinity;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; const d = x * dx + y * dy; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    const dc = cx * dx + cy * dy;
    const [ax, ay] = this.P(cx + dx * (hi - dc), cy + dy * (hi - dc)), [bx, by] = this.P(cx + dx * (lo - dc), cy + dy * (lo - dc));
    const gr = g.createLinearGradient(ax, ay, bx, by);
    gr.addColorStop(0, base); gr.addColorStop(flat, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  /** thick-thin ink ring: w(θ) = w0 (1 + k cos(θ − thick)), θ from the contour centroid (canvas angles) */
  inkRing(pts: P2[], w0: number, thick: number, k = 0.45, col = INK) {
    const n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const out: P2[] = [], inn: P2[] = [];
    pts.forEach((q, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      let nx = b[1] - a[1], ny = a[0] - b[0]; // outward normal for clockwise-on-screen contours
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const h = 0.5 * w0 * (1 + k * Math.cos(Math.atan2(q[1] - cy, q[0] - cx) - thick));
      out.push([q[0] + nx * h, q[1] + ny * h]); inn.push([q[0] - nx * h, q[1] - ny * h]);
    });
    const g = this.g;
    const trace = (r: P2[]) => { r.forEach(([x0, y0], i) => { const [x, y] = this.P(x0, y0); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
    g.beginPath(); trace(out); trace(inn.reverse());
    g.fillStyle = col; g.fill("evenodd");
  }
  /** flat strap with a thin ink rim (cross belts, sash, rifle, handles) */
  band(pts: P2[], fill: string, w: number, rim: number, cap: CanvasLineCap = "butt") {
    const g = this.g; g.lineCap = cap; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * rim; g.stroke();
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
    g.lineCap = "round";
  }
}

const ellPts = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = 360, rot = 0, n = 48): P2[] => {
  const r = rad(rot), pts: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n), x = rx * Math.cos(a), y = ry * Math.sin(a);
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
};

const rrect = (x0: number, y0: number, x1: number, y1: number, r: number, n = 8): P2[] => {
  const pts: P2[] = [];
  for (const [cx, cy, a] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]])
    for (let i = 0; i <= n; i++) pts.push([cx + r * Math.cos(rad(a + (90 * i) / n)), cy + r * Math.sin(rad(a + (90 * i) / n))]);
  return pts;
};

/** tapered stroke, thick end at a: brows, moustache halves */
const taper = (p: Pen, a: P2, b: P2, wa: number, wb: number, col = INK) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  p.poly([[a[0] + nx * wa / 2, a[1] + ny * wa / 2], [b[0] + nx * wb / 2, b[1] + ny * wb / 2],
    [b[0] - nx * wb / 2, b[1] - ny * wb / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]], col, 0);
  p.dot(a[0], a[1], wa / 2, col); p.dot(b[0], b[1], wb / 2, col);
};

// ---------------- contours ----------------
export type Blob = { a: number; b: number; nTop: number; nBot: number; egg: number; asym: number; rot: number; noise: number; seed: number };

/** superellipse "bean": separate crown / jaw exponents, egg taper (neg = narrower chin), one-side bulge, soft noise.
 *  Points run right -> down -> left -> up (clockwise on screen). */
export const blobPts = (cx: number, cy: number, B: Blob, n = 72): P2[] => {
  const ph = [rnd(B.seed, 11), rnd(B.seed, 12), rnd(B.seed, 13)].map((v) => v * Math.PI * 2);
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), e = 2 / (s < 0 ? B.nTop : B.nBot);
    let X = Math.sign(c) * Math.abs(c) ** e;
    const Y = Math.sign(s) * Math.abs(s) ** e;
    X *= (1 + B.egg * Y) * (1 + B.asym * Math.sign(X));
    const r = 1 + B.noise * (Math.cos(2 * t + ph[0]) + 0.7 * Math.cos(3 * t + ph[1]) + 0.5 * Math.cos(4 * t + ph[2]));
    const x = B.a * X * r, y = B.b * Y * r;
    pts.push([cx + x * Math.cos(B.rot) - y * Math.sin(B.rot), cy + x * Math.sin(B.rot) + y * Math.cos(B.rot)]);
  }
  return pts;
};

/** measured head: H/W 0.94, slightly pointed crown (1.75), fuller jaw (2.3), chin taper -0.12, 8 % bulge to the facing side */
export const headBlob = (seed: number, a = 118, facing = 0): Blob => ({
  a, b: a * (0.94 + 0.08 * (rnd(seed, 1) - 0.5)),
  nTop: 1.75 + 0.3 * (rnd(seed, 2) - 0.5), nBot: 2.3 + 0.3 * (rnd(seed, 3) - 0.5),
  egg: -0.12 + 0.06 * (rnd(seed, 4) - 0.5),
  asym: (0.06 + 0.04 * rnd(seed, 5)) * (facing || (rnd(seed, 6) < 0.5 ? -1 : 1)),
  rot: rad(8 * (rnd(seed, 7) - 0.5)), noise: 0.008, seed,
});

/** thickest outline direction: away from the light, pulled toward the ground (64 deg measured for upper-left light) */
export const thickAngle = (light: number) => Math.atan2(-Math.sin(light) + 0.8, -Math.cos(light));
const DEF_LIGHT = rad(-120);

// ---------------- faces ----------------
export type Expr = "neutral" | "stern" | "grin" | "laugh" | "whistle" | "nervous" | "shock" | "relief" | "relief_open" | "dazed"
  | "pained" | "smile" | "smile_closed" | "lick" | "sad" | "cry";
type EyeK = "dot" | "small" | "lid" | "slit" | "happy" | "dash" | "squeeze" | "shock" | "shockHalf" | "spiral";
type MouthK = "dash" | "frown" | "smirk" | "smile" | "smileWide" | "grin" | "laugh" | "o" | "O" | "wave" | "teeth" | "lick";
/** eyes [back, front], brows [inner, outer] offsets in u (+ = down), mouth kind */
const FACE: Record<Expr, { eye: [EyeK, EyeK]; brow: [number, number]; mouth: MouthK }> = {
  neutral: { eye: ["lid", "lid"], brow: [0, -1], mouth: "dash" },
  stern: { eye: ["lid", "lid"], brow: [3, -2], mouth: "frown" },
  grin: { eye: ["happy", "happy"], brow: [-3, -3], mouth: "grin" },
  laugh: { eye: ["squeeze", "squeeze"], brow: [-4, -4], mouth: "laugh" },
  whistle: { eye: ["dash", "dash"], brow: [-2, -4], mouth: "o" },
  nervous: { eye: ["small", "small"], brow: [-3, 2], mouth: "wave" },
  shock: { eye: ["shock", "shock"], brow: [-7, -6], mouth: "O" },
  relief: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "smileWide" },
  relief_open: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "grin" },
  dazed: { eye: ["spiral", "spiral"], brow: [-3, 2], mouth: "wave" },
  pained: { eye: ["squeeze", "lid"], brow: [-3, 2], mouth: "teeth" },
  smile: { eye: ["dot", "dot"], brow: [0, -1], mouth: "smirk" },
  smile_closed: { eye: ["happy", "happy"], brow: [0, -1], mouth: "smile" },
  lick: { eye: ["dot", "dot"], brow: [0, -1], mouth: "lick" },
  sad: { eye: ["lid", "lid"], brow: [-5, 3], mouth: "frown" },
  cry: { eye: ["squeeze", "squeeze"], brow: [-6, 4], mouth: "wave" },
};
const halfLid = (k: EyeK): EyeK => (k === "dot" || k === "small" ? "lid" : k === "lid" ? "slit" : k === "shock" ? "shockHalf" : k);
const eyeKind = (k: EyeK, lid: number): EyeK =>
  lid >= 1 && k !== "happy" && k !== "squeeze" && k !== "spiral" ? "dash" : lid > 0 ? halfLid(k) : k;
const lidOf = (b: boolean | number | undefined) => (b === true ? 1 : Number(b) || 0);

const eye = (p: Pen, kind: EyeK, x: number, ey: number, u: number, side: number, look: number, skin: string, iris?: string) => {
  const lx = x + look * 3 * u, lw = 3.8 * u;
  if (iris && (kind === "dot" || kind === "small" || kind === "lid")) {
    // coloured eyes (the companion): a tall iris oval with an ink rim and an ink pupil; "lid" adds a flat upper lid
    p.ell(lx, ey, 6 * u, 7.6 * u, iris, 2.4 * u);
    p.ell(lx, ey + 0.8 * u, 2.6 * u, 3.6 * u, INK, 0);
    if (kind === "lid") p.stroke([[x - 9 * u, ey - 4 * u], [x + 9 * u, ey - 4 * u]], lw);
    else p.stroke([[x - 8 * u, ey - 7.6 * u], [x + 8.5 * u, ey - 8.4 * u]], 3 * u);
    return;
  }
  switch (kind) {
    case "dot": p.ell(lx, ey, 3.8 * u, 5.5 * u, INK, 0); break;
    case "small": p.ell(lx, ey, 3 * u, 4.4 * u, INK, 0); break;
    case "lid": p.ell(lx, ey - u, 7 * u, 6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey - u], [x + 9 * u, ey - u]], lw); break;
    case "slit": p.ell(lx, ey, 7 * u, 2.6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey], [x + 9 * u, ey]], lw); break;
    case "happy": p.arc(x, ey + 3 * u, 8 * u, 6 * u, 200, 340, lw); break;
    case "dash": p.stroke([[x - 8.5 * u, ey], [x + 8.5 * u, ey]], lw); break;
    case "squeeze": p.stroke([[x + 6 * u * side, ey - 5 * u], [x - 6 * u * side, ey], [x + 6 * u * side, ey + 5 * u]], lw); break;
    case "shock": case "shockHalf":
      p.ell(x, ey, 11 * u, 11 * u, WHITE, 2.6 * u); p.dot(lx - side * 1.5 * u, ey + 1.5 * u, 3 * u);
      if (kind === "shockHalf") { p.ell(x, ey, 11 * u, 11 * u, skin, 0, 180, 360); p.stroke([[x - 11 * u, ey], [x + 11 * u, ey]], 2.6 * u); }
      break;
    default: {
      const s: P2[] = [];
      for (let t = 1; t < 15; t++) s.push([x + Math.cos(t * 0.9) * t * 0.55 * u, ey + Math.sin(t * 0.9) * t * 0.55 * u]);
      p.stroke(s, 2.4 * u);
    }
  }
};

/** open "D" mouth with a white teeth band (+ tongue) */
const dmouth = (p: Pen, mx: number, y: number, rx: number, ry: number, u: number, tongue = false) => {
  p.ell(mx, y, rx, ry, MOUTH, 0, 0, 180);
  p.clip([[mx - rx, y], [mx + rx, y], [mx + rx, y + 3 * u], [mx - rx, y + 3 * u]], () => p.ell(mx, y, rx, ry, WHITE, 0, 0, 180));
  if (tongue) p.ell(mx + 2 * u, y + 0.62 * ry, 0.4 * rx, 0.28 * ry, TONGUE, 0);
  p.ell(mx, y, rx, ry, null, 3 * u, 0, 180);
};

const mouth = (p: Pen, kind: MouthK, mx: number, my: number, u: number, k = 1) => {
  const mw = 4 * u;
  switch (kind) {
    case "dash": p.stroke([[mx - 5.5 * u * k, my], [mx + 5.5 * u * k, my - 0.8 * u]], mw); break;
    case "frown": p.arc(mx, my + 3 * u, 6.5 * u * k, 3.5 * u, 200, 340, mw); break;
    case "smirk": p.arc(mx + u, my - 3 * u, 7 * u * k, 4 * u, 10, 150, mw); break;
    case "smile": p.arc(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160, mw); break;
    case "smileWide": p.arc(mx, my - 4 * u, 11 * u * k, 6 * u, 15, 165, mw); break;
    case "grin": dmouth(p, mx, my - u, 12 * u * k, 8 * u, u); break;
    case "laugh": dmouth(p, mx, my, 16 * u * k, 11 * u, u, true); break;
    case "o": p.ell(mx + 4 * u, my, 3.5 * u, 4 * u, MOUTH, 2.8 * u); break;
    case "O": p.ell(mx, my + 2 * u, 9 * u * k, 11 * u, MOUTH, 3.2 * u); break;
    case "wave": { const s: P2[] = []; for (let i = 0; i <= 12; i++) s.push([mx - 9 * u * k + i * 1.5 * u * k, my + 1.5 * u * Math.sin(i * 1.3)]); p.stroke(s, 3 * u); break; }
    case "teeth":
      p.poly([[mx - 12 * u * k, my - 4 * u], [mx + 12 * u * k, my - 4 * u], [mx + 11 * u * k, my + 4 * u], [mx - 11 * u * k, my + 4 * u]], WHITE, 3 * u);
      for (const j of [-1, 0, 1]) p.stroke([[mx + j * 6 * u * k, my - 4 * u], [mx + j * 6 * u * k, my + 4 * u]], 1.5 * u);
      break;
    case "lick": p.arc(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160, mw); p.ell(mx + 6 * u * k, my + 3 * u, 3.6 * u, 4.6 * u, TONGUE, 2.4 * u); break;
  }
};

/** face v2 (front / 3-4). u = 1 % of the head path width W. Eyes 26u apart on the centre line, brows 20u up, mouth 20u
 *  down, everything slid toward the facing side. No blush, no catchlights. */
const faceFront = (p: Pen, cx: number, cy: number, W: number, expr: Expr, facing: number, look: number, lid: number, brim: boolean,
  skin: string, moustache?: string, stout = false, iris?: string, glasses = false) => {
  const u = W / 100, F = FACE[expr], fx = cx + 7 * u * facing;
  const ex = (F.eye[0] === "shock" ? 12 : 13) * u, ey = cy;
  for (const side of [-1, 1]) {
    const x = fx + side * ex;
    const kind = eyeKind(F.eye[(facing ? side === facing : side > 0) ? 1 : 0], lid);
    eye(p, kind, x, ey, u, side, look, skin, iris);
    if (glasses) p.ell(x, ey, 11.5 * u, 10 * u, null, 2.6 * u);
    const [dI, dO] = F.brow, by = ey - (brim ? 17 : 20) * u;
    if (kind === "shock" || kind === "shockHalf") p.arc(x, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
    else taper(p, [x - side * 8.5 * u, by + dI * u], [x + side * 8.5 * u, by + dO * u], 5 * u, 2.5 * u);
  }
  if (glasses) p.stroke([[fx - ex + 11.5 * u, ey - u], [fx + ex - 11.5 * u, ey - u]], 2.6 * u);
  const mx = cx + 8 * u * facing, my = cy + 20 * u;
  mouth(p, F.mouth, mx, my, u);
  if (moustache) for (const s of [-1, 1])
    taper(p, [mx + s * 1.5 * u, cy + 12.5 * u], [mx + s * (stout ? 19 : 15) * u, cy + (stout ? 10.5 : 15) * u], stout ? 5.5 * u : 4.5 * u, 1.6 * u, moustache);
  if (expr === "nervous") p.ell(cx + 40 * u * (facing || 1), cy - 22 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
  if (expr === "cry") for (const side of [-1, 1]) { // two streams of tears down the cheeks
    const x = fx + side * ex;
    p.stroke([[x + side * 2 * u, ey + 6 * u], [x + side * 4 * u, ey + 22 * u], [x + side * 3 * u, ey + 34 * u]], 5 * u, "#8fd0ff");
    p.ell(x + side * 3 * u, ey + 37 * u, 3.5 * u, 4.5 * u, "#8fd0ff", 1.6 * u);
  }
};

/** profile face (facing screen-right): one eye, brow, nose tick, mouth near the front edge; no skin bump nose, no ear */
const faceSide = (p: Pen, hx: number, hy: number, W: number, expr: Expr, lid: number, brim: boolean, skin: string, moustache?: string, stout = false) => {
  const u = W / 100, F = FACE[expr], ex = hx + 27 * u, ey = hy;
  const kind = eyeKind(F.eye[1], lid);
  eye(p, kind, ex, ey, u, 1, 0.6, skin);
  const by = ey - (brim ? 17 : 20) * u, [dI, dO] = F.brow;
  if (kind === "shock" || kind === "shockHalf") p.arc(ex, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
  else taper(p, [ex + 8 * u, by + dI * u], [ex - 7 * u, by - u + dO * u], 5 * u, 2.5 * u);
  p.stroke([[hx + 44 * u, hy + 4 * u], [hx + 47.5 * u, hy + 9 * u], [hx + 43 * u, hy + 10 * u]], 3 * u);
  mouth(p, F.mouth, hx + 33 * u, hy + 21 * u, u, 0.62);
  if (moustache) taper(p, [hx + 41 * u, hy + 13.5 * u], [hx + 25 * u, hy + (stout ? 11.5 : 16) * u], stout ? 5.5 * u : 4.5 * u, 1.6 * u, moustache);
  if (expr === "nervous") p.ell(hx - 30 * u, hy - 24 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
};

// ---------------- hats ----------------
const BONNET = "#e9cf8f", BONNET_BRIM = "#d6b46a";
/** parts of a hat that sit behind the head (bonnet) */
const hatBehind = (p: Pen, o: Outfit, H: Blob, cx: number, hc: number, light: number, thick: number, ow: number, side: boolean) => {
  const u = (2 * H.a) / 100;
  if (o.ponytail) { // high ponytail swinging out behind the crown to one side, falling to the waist
    const s = side ? -1 : 1, top: P2 = [cx + s * 0.55 * H.a, hc - 0.85 * H.b];
    const pts: P2[] = [...curve(top, [cx + s * 1.55 * H.a, hc + 0.2 * H.b], [cx + s * 1.25 * H.a, hc + 2.9 * H.b], 14),
      ...curve([cx + s * 0.95 * H.a, hc + 2.7 * H.b], [cx + s * 1.05 * H.a, hc + 0.3 * H.b], [cx + s * 0.25 * H.a, hc - 0.7 * H.b], 14)];
    const P = s > 0 ? pts : pts.reverse();
    p.shadedFill(P, o.ponytail, mul(o.ponytail, SH_FELT), light, H.a, 0.3);
    if (o.streak) p.clip(P, () => { p.stroke(curve([top[0] + s * 4 * u, top[1]], [cx + s * 1.4 * H.a, hc + 0.6 * H.b], [cx + s * 1.15 * H.a, hc + 2.9 * H.b]), 9 * u, o.streak!); });
    p.poly(P, null, ow * 0.85);
  }
  if (o.longHair) { // hair hanging behind the head to the shoulders
    const hb: Blob = { ...H, a: H.a * 1.16, b: H.b * 1.38, nTop: 2.2, nBot: 3.4, egg: -0.05, asym: 0, seed: H.seed + 5 };
    const pts = blobPts(cx, hc + 0.36 * H.b, hb);
    // two side panels only: nothing below the jaw in the middle (a full oval there reads as a beard)
    const big = 4 * H.a, gap = 0.62 * H.a, yc = hc + 0.15 * H.b, yb = hc + 3 * H.b;
    const U: P2[] = [[cx - big, hc - big], [cx + big, hc - big], [cx + big, yb], [cx + gap, yb], [cx + gap, yc], [cx - gap, yc], [cx - gap, yb], [cx - big, yb]];
    p.clip(U, () => {
      p.shadedFill(pts, o.longHair!, mul(o.longHair!, SH_FELT), light, hb.a, 0.3);
      if (o.streak) for (const s of [-1, 1]) p.stroke([[cx + s * 0.95 * H.a, hc], [cx + s * 1.08 * H.a, hc + 1.6 * H.b]], 7 * u, o.streak!);
      p.inkRing(pts, ow * 0.85, thick);
    });
    // ink along the inner edges of the two panels, where they end over the shoulders
    for (const s of [-1, 1]) {
      // lower contour of the hair at the cut line x = cx + s*gap
      const low = pts.filter((q) => q[1] > yc).sort((a, b) => Math.abs(a[0] - cx - s * gap) - Math.abs(b[0] - cx - s * gap))[0];
      if (low) p.stroke([[cx + s * gap, yc], [cx + s * gap, low[1]]], ow * 0.7);
    }
  }
  if (o.hat !== "bonnet") return;
  const bb = blobPts(cx - (side ? 12 : 0) * (H.a / 50), hc - 0.07 * 2 * H.b, { ...H, a: H.a * 1.17, b: H.b * 1.13, asym: 0, egg: 0.04, seed: H.seed + 3 });
  p.shadedFill(bb, BONNET, mul(BONNET, SH_CLOTH), light, H.a * 1.17);
  p.inkRing(bb, ow * 0.85, thick);
};

const hatOn = (p: Pen, o: Outfit, hp: P2[], H: Blob, cx: number, hc: number, light: number, seed: number, facing: number, side: boolean) => {
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, crown = hc - H.b, ow = 0.85 * 5 * u;
  const a = H.rot + rad(4 * (rnd(seed, 20) - 0.5)); // tilt with the head, +-2 deg extra
  const R = (pts: P2[]) => rotPts(pts, a, cx, hc);
  const sag = (yb: number, wb: number): P2[] => {
    const base: P2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; base.push([cx + wb * (2 * t - 1), yb + 3 * u * (1 - (2 * t - 1) ** 2)]); }
    return base;
  };
  if (o.hat === "shako" || o.hat === "shako_tall") {
    const tall = o.hat === "shako_tall", yb = crown + 0.25 * HH, ht = (tall ? 0.66 : 0.56) * HH, wb = 46 * u, wt = 52 * u;
    const body = R([...sag(yb, wb).reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, "#3a3d47", "#24262d", light, wt, 0.4);
    if (tall) p.clip(body, () => p.band(R([[cx - wt - 5 * u, yb - ht + 0.07 * HH], [cx + wt + 5 * u, yb - ht + 0.07 * HH]]), "#e8c45a", 0.06 * HH, 1.5 * u));
    p.poly(body, null, ow);
    const deg = (a * 180) / Math.PI;
    if (side) {
      p.poly(R([[cx + 36 * u, yb - 1 * u], [cx + 60 * u, yb + 8 * u], [cx + 34 * u, yb + 6 * u]]), "#16171b", 2.5 * u);
      const [tx, ty] = R([[cx + 24 * u, yb - ht - 6 * u]])[0];
      p.ell(tx, ty, 7 * u, 7 * u, "#2b7a4b", 2.5 * u);
    } else {
      const [px, py] = R([[cx + 3 * u * facing, yb + 3 * u]])[0];
      p.ell(px, py, 34 * u, 0.045 * HH, "#16171b", 2.5 * u, 0, 180, deg); // peak
      const [bx, by] = R([[cx, yb - 0.45 * ht]])[0];
      p.ell(bx, by, 7 * u, 6 * u, tall ? "#e8c45a" : "#c9ccd2", 2 * u, 0, 360, deg); // badge plate
      p.arc(bx, by, 3.5 * u, 2.8 * u, 200, 500, 1.6 * u);
      const [tx, ty] = R([[cx, yb - ht - 6 * u]])[0];
      p.ell(tx, ty, 7 * u, 7 * u, "#2b7a4b", 2.5 * u); // green tuft
    }
  } else if (o.hat === "cap" || o.hat === "hair" || o.hat === "beanie") {
    const beanie = o.hat === "beanie";
    const cut = crown + (o.hat === "cap" ? 0.3 : beanie ? 0.34 : o.longHair ? 0.36 : 0.42) * HH;
    const keep = (x: number, y: number) => y < cut || (side && o.hat === "hair" && x < cx - 6 * u && y < hc + 0.42 * H.b);
    // start the arc at the first kept point after a dropped one, so the kept run is contiguous and the cut closes it
    const n = hp.length, startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
    const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y))
      .map(([x, y]) => [cx + (x - cx) * 1.03, hc + (y - hc) * 1.03] as P2);
    if (arc.length < 3) return;
    if (o.hat === "hair") { // scalloped lower edge
      const [x0, y0] = arc[arc.length - 1], [x1, y1] = arc[0];
      for (let i = 1; i < 6; i++) arc.push([x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6 + (i % 2 ? 4 * u : 0)]);
    }
    const col = o.hat === "hair" ? o.hair! : o.cap!;
    p.shadedFill(arc, col, mul(col, SH_FELT), light, H.a, 0.35);
    if (beanie) {
      p.clip(arc, () => p.band(R([[cx - 60 * u, cut - 7 * u], [cx + 60 * u, cut - 7 * u]]), shade(col, 0.78), 14 * u, 0));
      p.poly(arc, null, ow);
      const [tx, ty] = R([[cx, crown - 6 * u]])[0];
      p.ell(tx, ty, 11 * u, 10 * u, "#f4f1ea", 2.5 * u);
      return;
    }
    if (o.streak && o.hat === "hair") p.clip(arc, () => {
      for (const [dx, w] of [[-0.42, 8], [0.18, 6], [0.62, 7]] as const) p.stroke([[cx + dx * H.a + 6 * u, crown - 4 * u], [cx + dx * H.a, cut + 6 * u]], w * u, o.streak!);
    });
    p.poly(arc, null, ow);
    if (o.hat === "hair") {
      const s = side ? -1 : facing || 1;
      p.stroke([[cx + s * 10 * u, cut - 30 * u], [cx + s * 2 * u, cut - 12 * u]], 1.2 * u);
    }
    if (o.hat === "cap") {
      const deg = (a * 180) / Math.PI;
      if (side) p.poly(R([[cx + 40 * u, cut - 2 * u], [cx + 74 * u, cut + 4 * u], [cx + 40 * u, cut + 6 * u]]), shade(col, 0.8), ow);
      else {
        const s = facing || (rnd(seed, 21) < 0.5 ? -1 : 1), [px, py] = R([[cx + s * 4 * u, cut + 1.5 * u]])[0];
        p.ell(px, py, 32 * u, 0.06 * HH, shade(col, 0.8), ow, 0, 180, deg);
      }
    }
  } else if (o.hat === "tophat") {
    const yb = crown + 0.22 * HH, ht = 0.8 * HH, wb = 0.31 * W, wt = 0.33 * W, col = "#2e2a36";
    const body = R([...sag(yb, wb).reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, col, mul(col, SH_FELT), light, wt, 0.4);
    p.clip(body, () => p.band(R([[cx - wt - 4 * u, yb - 0.13 * HH], [cx + wt + 4 * u, yb - 0.13 * HH]]), shade(o.jacket, 0.9), 0.14 * HH, 0.8 * u));
    p.poly(body, null, ow);
    const [bx, by] = R([[cx, yb + 1 * u]])[0];
    p.ell(bx, by, 0.45 * W, 0.05 * HH, "#1d1b22", ow, 0, 360, (a * 180) / Math.PI);
  } else if (o.hat === "bonnet") {
    const [bx, by] = R([[cx + (side ? 6 * u : 0), crown + 0.16 * HH]])[0];
    p.arc(bx, by, 0.5 * W, 0.2 * HH, 200, 340, 7 * u, BONNET_BRIM);
    p.arc(bx, by, 0.5 * W + 3.5 * u, 0.2 * HH + 3.5 * u, 200, 340, 1.2 * u);
    const cy = hc + H.b * 0.98;
    p.stroke([[cx - 14 * u, cy - 4 * u], [cx, cy + 2 * u], [cx + 14 * u, cy - 4 * u]], 2 * u, BONNET_BRIM);
  }
};

// ---------------- bodies ----------------
export type Arms = [P2[], P2[]];
/** held prop; for the hammer the number is the strike 0 (raised) .. 1 (struck) */
export type Prop = null | "icecream" | "shako" | ["hammer", number] | "mug" | "phone" | "clipboard" | ["type", number] | ["point", number] | "chin"
  | "ring" | "watch" | "mic" | ["hold", number] | "sign";

const BUILD: Record<Build, { a: number; torso: number; legs: number; tw: number }> = {
  adult: { a: 118, torso: 1.1, legs: 1.4, tw: 0.8 },
  stout: { a: 118, torso: 1.15, legs: 1.32, tw: 0.92 },
  kid: { a: 112, torso: 0.85, legs: 1.0, tw: 0.72 },
};

export type FrontOpts = {
  phase?: number; expr?: Expr; mode?: "march" | "stroll" | "stand" | "sit" | "fall"; look?: number; blink?: boolean | number; lift?: number;
  prop?: Prop; tilt?: number; headTilt?: number; wave?: number;
  /** canvas angle the key light comes FROM (painted crescent + thick outline side) */
  light?: number; facing?: -1 | 0 | 1; seed?: number;
};

const footStroke = (p: Pen, a: P2, b: P2, w: number, col: string) => {
  if (col !== INK) p.stroke([a, b], w + 3, INK);
  p.stroke([a, b], w, col);
};

export const bodyFront = (p: Pen, o: Outfit, opts: FrontOpts) => {
  const { phase = 0, expr = "neutral", mode = "march", look = 0, blink = false, lift = 60, prop = null, tilt = 0, headTilt = 0, wave,
    light = DEF_LIGHT, facing = 0, seed = 1 } = opts;
  const Bd = BUILD[o.build ?? "adult"], skin = o.skin ?? SKIN, two = Math.PI * 2, lid = lidOf(blink);
  const H = headBlob(seed, Bd.a, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const tall = (1 + Bd.torso + Bd.legs) * HH, sole = 975;
  // body bob 5 % (march) / 3 % (stroll) of the height, lowest at contact (phase 0 and 0.5)
  const bob = mode === "march" ? 0.025 * tall * Math.cos(2 * two * phase) : mode === "stroll" ? 0.015 * tall * Math.cos(2 * two * phase) : 0;
  const torsoBot = mode === "sit" ? sole - 0.2 * HH : sole - Bd.legs * HH + bob;
  const chin = torsoBot - Bd.torso * HH, hc = chin - H.b, crown = hc - H.b, hipY = torsoBot - 0.12 * HH;
  const thick = thickAngle(light), ow = 5 * u;
  const legCol = mix(o.pants, INK, 0.55), armCol = mix(o.jacket, INK, 0.5), footCol = o.boots;
  const legW = 5.8 * u, footW = 7.5 * u;
  // ---- legs + feet (not rotated) ----
  p.rot = null;
  if (mode === "sit") {
    for (const side of [-1, 1]) {
      const h: P2 = [300 + side * 15 * u, hipY], k: P2 = [300 + side * 36 * u, hipY + 0.2 * HH], f: P2 = [300 + side * 44 * u, sole - 8 * u];
      p.stroke(curve(h, k, f), legW, legCol);
      footStroke(p, [f[0] - side * 2 * u, f[1]], [f[0] + side * 12 * u, f[1] - 5 * u], footW, footCol);
    }
  } else if (mode === "fall") {
    const legs: [P2, P2, P2][] = [
      [[300 - 15 * u, hipY], [300 - 46 * u, hipY + 0.5 * HH], [300 - 70 * u, hipY + 0.72 * HH]],
      [[300 + 15 * u, hipY], [300 + 50 * u, hipY + 0.45 * HH], [300 + 76 * u, hipY + 0.22 * HH]],
    ];
    legs.forEach(([h, k, f], i) => {
      p.stroke(curve(h, k, f), legW, legCol);
      footStroke(p, f, [f[0] + (i ? 14 : -14) * u, f[1] + (i ? -6 : 4) * u], footW, footCol);
    });
  } else if (o.dress) {
    for (const side of [-1, 1]) {
      const fx = 300 + side * 12 * u, fy = sole - 4 * u;
      p.stroke([[fx, sole - 0.4 * HH], [fx + side * u, fy]], legW, legCol);
      footStroke(p, [fx - side * 3 * u, fy], [fx + side * 12 * u, fy + u], footW, footCol);
    }
  } else {
    const L = mode === "march" ? lift * 1.25 : mode === "stroll" ? lift * 0.55 : 0;
    for (const [side, ph] of [[-1, 0], [1, 0.5]] as const) {
      const up = Math.max(0, Math.sin(two * (phase + ph))) * L;
      const hx = 300 + side * 15 * u, fx = 300 + side * 22 * u, fy = sole - 4 * u - up;
      const k: P2 = [(hx + fx) / 2 + side * (1.5 * u + up * 0.16), (hipY + fy) / 2 - up * 0.08];
      p.stroke(curve([hx, hipY], k, [fx, fy]), legW, legCol);
      footStroke(p, [fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u], footW, footCol);
    }
  }
  // ---- upper body: rotates about the hips (tilt + a small weight-shift sway on every step) ----
  const sway = mode === "march" ? 1.6 * Math.sin(two * phase) : mode === "stroll" ? 1.0 * Math.sin(two * phase) : 0;
  const A = tilt + sway;
  p.rot = A ? [rad(A), 300, hipY] : null;
  const dress = !!o.dress && mode !== "sit" && mode !== "fall";
  const T: Blob = { a: ((Bd.tw / 2) * W) / 1.06, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: o.build === "stout" ? 0.17 : 0.12,
    asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const sh = (side: number): P2 => [tcx + side * 0.85 * T.a, chin + 0.12 * HH];
  const hang = (side: number, fwd: number): [P2, P2, P2] => {
    const S = sh(side), ex = tcx + side * (1.12 * T.a + 4 * u);
    const hx = ex + side * 3 * u - side * 6 * u * Math.max(0, fwd) + side * 4 * u * Math.max(0, -fwd);
    return [S, [ex, S[1] + 0.48 * HH], [hx, chin + 1.04 * HH - Math.abs(fwd) * 9 * u]];
  };
  const sw = mode === "march" || mode === "stroll" ? Math.sin(two * phase) : 0;
  // rifle at the order: butt by the right hip, held by the hanging right hand, muzzle past the crown
  const R0: P2 = [300 + 47 * u, torsoBot + 0.12 * HH], R1: P2 = [300 + 64 * u, crown - 0.32 * HH];
  const rifle = !!o.rifle && (mode === "march" || mode === "stand" || mode === "stroll");
  type Arm = { pts: [P2, P2, P2]; front: boolean };
  const arms: Arm[] = [];
  const tag = Array.isArray(prop) ? prop[0] : prop;
  const held = tag === "mug" || tag === "phone" || tag === "clipboard" || tag === "type" || tag === "point" || tag === "chin"
    || tag === "ring" || tag === "watch" || tag === "mic" || tag === "hold" || tag === "sign" || (tag === "icecream" && mode === "sit");
  if (held) {
    // left arm: resting (sit) or hanging; right arm does the action
    if (tag === "sign") { const S = sh(-1); arms.push({ pts: [S, [tcx - 1.05 * T.a - 4 * u, S[1] + 0.42 * HH], [tcx - 0.45 * T.a, S[1] + 0.46 * HH]], front: true }); } // both hands hold a board (drawn as its own card)
    else if (mode === "sit") arms.push({ pts: [sh(-1), [tcx - (1.1 * T.a + 6 * u), sh(-1)[1] + 0.4 * HH], [tcx - (1.2 * T.a + 10 * u), torsoBot + 0.04 * HH]], front: false });
    else if (tag === "phone" || tag === "clipboard") { const S = sh(-1); arms.push({ pts: [S, [tcx - 1.05 * T.a - 4 * u, S[1] + 0.45 * HH], [tcx - 0.25 * T.a, S[1] + 0.42 * HH]], front: true }); }
    else arms.push({ pts: hang(-1, 0), front: false });
    const S = sh(1), k = Array.isArray(prop) ? clamp(prop[1], 0, 1) : 0;
    if (tag === "mug" || tag === "icecream") arms.push({ pts: [S, [tcx + 1.05 * T.a + 4 * u, S[1] + 0.45 * HH], [tcx + 0.55 * T.a, S[1] + 0.3 * HH]], front: true });
    else if (tag === "ring") arms.push({ pts: [S, [tcx + 0.95 * T.a + 6 * u, S[1] + 0.38 * HH], [tcx + 0.15 * T.a, S[1] + 0.36 * HH]], front: true });
    else if (tag === "watch") arms.push({ pts: [S, [tcx + 1.0 * T.a + 6 * u, S[1] + 0.42 * HH], [tcx - 0.2 * T.a, S[1] + 0.28 * HH]], front: true });
    else if (tag === "mic") arms.push({ pts: [S, [tcx + 0.95 * T.a + 8 * u, S[1] + 0.34 * HH], [tcx + 0.3 * T.a, chin + 0.02 * HH]], front: true });
    else if (tag === "hold") // hand down and out to the side, to hold the hand of whoever sits there (k = reach)
      arms.push({ pts: [S, [tcx + 1.18 * T.a + 8 * u, S[1] + 0.42 * HH], [tcx + 1.3 * T.a + (14 + 26 * k) * u, S[1] + 0.72 * HH]], front: false });
    else if (tag === "phone") arms.push({ pts: [S, [tcx + 1.05 * T.a + 4 * u, S[1] + 0.45 * HH], [tcx + 0.2 * T.a, S[1] + 0.34 * HH]], front: true });
    else if (tag === "sign") arms.push({ pts: [S, [tcx + 1.05 * T.a + 4 * u, S[1] + 0.42 * HH], [tcx + 0.45 * T.a, S[1] + 0.46 * HH]], front: true });
    else if (tag === "clipboard") arms.push({ pts: [S, [tcx + 1.05 * T.a + 4 * u, S[1] + 0.48 * HH], [tcx + 0.35 * T.a, S[1] + 0.5 * HH]], front: true });
    else if (tag === "chin") arms.push({ pts: [S, [tcx + 0.95 * T.a + 8 * u, S[1] + 0.32 * HH], [tcx + 0.28 * T.a, chin + 0.07 * HH]], front: true }); // fist just under the jaw (the head is drawn after it)
    else if (tag === "type") // reaching out to a keyboard at the right, hand bobbing with k
      arms.push({ pts: [S, [tcx + 1.2 * T.a + 12 * u, S[1] + 0.32 * HH], [tcx + 1.55 * T.a + 30 * u, S[1] + (0.36 - 0.06 * k) * HH]], front: false });
    else // point: arm raised from the side (k 0) to straight out at shoulder height (k 1)
      arms.push({ pts: [S, lerp2([tcx + 1.12 * T.a + 6 * u, S[1] + 0.42 * HH], [tcx + 1.3 * T.a + 24 * u, S[1] - 0.2 * HH], k),
        lerp2([tcx + 1.18 * T.a + 8 * u, S[1] + 0.86 * HH], [tcx + 1.38 * T.a + 54 * u, S[1] - 0.48 * HH], k)], front: false }); // up and out: "out!"
  } else if (mode === "sit") for (const side of [-1, 1]) arms.push({ pts: [sh(side), [tcx + side * (1.1 * T.a + 6 * u), sh(side)[1] + 0.4 * HH], [tcx + side * (1.2 * T.a + 10 * u), torsoBot + 0.04 * HH]], front: false });
  else if (mode === "fall") for (const side of [-1, 1]) arms.push({ pts: [sh(side), [tcx + side * (1.15 * T.a + 12 * u), sh(side)[1] - 0.25 * HH], [tcx + side * (1.3 * T.a + 24 * u), sh(side)[1] - 0.68 * HH]], front: false });
  else {
    arms.push({ pts: prop === "shako" ? hang(-1, 0) : hang(-1, -sw), front: false });
    if (rifle) {
      const G = lerp2(R0, R1, 0.1);
      arms.push({ pts: [sh(1), [tcx + 1.12 * T.a + 5 * u, sh(1)[1] + 0.45 * HH], G], front: false });
    } else if (wave !== undefined) {
      const S = sh(1);
      arms.push({ pts: [S, [tcx + 1.1 * T.a + 10 * u + 3 * u * wave, S[1] - 0.22 * HH], [tcx + 1.18 * T.a + 16 * u + 12 * u * wave, S[1] - 0.6 * HH]], front: false });
    } else if (prop === "icecream") {
      const S = sh(1);
      arms.push({ pts: [S, [tcx + 1.05 * T.a + 4 * u, S[1] + 0.45 * HH], [tcx + 0.5 * T.a, S[1] + 0.4 * HH]], front: true });
    } else if (Array.isArray(prop)) {
      const S = sh(1), k = clamp(prop[1], 0, 1);
      const E = lerp2([tcx + 1.1 * T.a + 10 * u, S[1] - 0.15 * HH], [tcx + 1.2 * T.a + 10 * u, S[1] + 0.3 * HH], k);
      const Hd = lerp2([tcx + 1.15 * T.a + 14 * u, S[1] - 0.55 * HH], [tcx + 1.45 * T.a + 22 * u, S[1] + 0.35 * HH], k);
      arms.push({ pts: [S, E, Hd], front: true });
    } else arms.push({ pts: hang(1, sw), front: false });
  }
  const drawArm = (a: Arm) => { p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 5.2 * u, armCol); p.dot(a.pts[2][0], a.pts[2][1], 5.5 * u); };
  // behind the body: rifle, sword, arms
  if (rifle) {
    p.band([R0, R1], "#7a4b2a", 5 * u, 1.5 * u, "round");
    p.band([lerp2(R0, R1, 0.6), R1], "#8d949c", 2.4 * u, 1.2 * u, "round");
  }
  if (o.sword && mode !== "sit") {
    const s0: P2 = [tcx - 0.75 * T.a, torsoBot - 0.2 * HH];
    p.band([s0, [s0[0] - Math.sin(rad(25)) * 0.8 * HH, s0[1] + Math.cos(rad(25)) * 0.8 * HH]], "#c9ccd2", 3 * u, 1.2 * u, "round");
  }
  for (const a of arms) if (!a.front) drawArm(a);
  // torso / dress: shaded fill -> clothing clipped to it -> thick-thin ink ring
  if (dress) {
    const D: Blob = { a: 0.5 * W * 0.98, b: 0.5 * ((sole - 0.35 * HH) - (chin - 0.2 * HH)), nTop: 2.0, nBot: 3.0, egg: 0.35, asym: 0.03 * facing, rot: 0, noise: 0.006, seed: seed + 9 };
    const dp = blobPts(300, sole - 0.35 * HH - D.b, D);
    p.gradFill(dp, o.dress!, mul(o.dress!, SH_CLOTH), light);
    p.inkRing(dp, ow, thick);
    const Sw: Blob = { a: 0.37 * W, b: 0.3 * HH, nTop: 2.2, nBot: 2.4, egg: 0.1, asym: 0, rot: 0, noise: 0.006, seed: seed + 8 };
    const sp = blobPts(300, chin + 0.12 * HH, Sw);
    p.gradFill(sp, o.jacket, mul(o.jacket, SH_CLOTH), light);
    p.inkRing(sp, ow * 0.9, thick);
  } else {
    p.gradFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light);
    p.clip(tp, () => {
      if (o.belt) {
        for (const s of [-1, 1]) p.band([[tcx - s * 0.75 * T.a, chin - 0.05 * HH], [tcx + s * 0.8 * T.a, torsoBot - 0.1 * HH]], o.belt!, 5.5 * u, 1.8 * u);
        const xc = tcx + 0.025 * T.a, yc = chin - 0.05 * HH + (torsoBot - 0.1 * HH - (chin - 0.05 * HH)) * (0.75 / 1.55);
        p.poly([[xc - 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc + 3.5 * u], [xc - 3.5 * u, yc + 3.5 * u]], "#d9dde0", 1.5 * u);
      }
      if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
      for (let i = 0; i < 4; i++) {
        const y = chin + 0.12 * HH + i * 0.2 * HH;
        if (o.sash && Math.abs(y - (torsoBot - 0.32 * HH)) < 0.08 * HH) continue;
        p.dot(tcx + 2 * u * facing, y, 2.2 * u + 0.8 * u, INK); p.dot(tcx + 2 * u * facing, y, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7));
      }
    });
    if (o.sash) { const s = facing || 1; p.poly([[tcx + s * 0.55 * T.a, torsoBot - 0.3 * HH], [tcx + s * 0.75 * T.a, torsoBot + 0.05 * HH], [tcx + s * 0.45 * T.a, torsoBot + 0.02 * HH]], o.sash, 1.6 * u); }
    p.inkRing(tp, ow, thick);
  }
  // in front of the body: hands holding props
  for (const a of arms) if (a.front) {
    drawArm(a);
    const [hx, hy] = a.pts[2];
    if (a !== arms[arms.length - 1]) continue; // props live in the right hand (the last arm)
    if (prop === "ring") {
      p.poly(rrect(hx - 15 * u, hy - 8 * u, hx + 15 * u, hy + 10 * u, 3 * u), "#b8283c", 2.2 * u);   // open box
      p.poly(rrect(hx - 15 * u, hy - 26 * u, hx + 15 * u, hy - 8 * u, 3 * u), "#d63a52", 2.2 * u);   // lid, up
      p.ell(hx, hy - 9 * u, 7 * u, 4 * u, null, 2.6 * u, 180, 360, 0); p.ell(hx, hy - 15 * u, 4 * u, 4 * u, "#eaf6ff", 1.8 * u); // ring + stone
      for (const [dx, dy] of [[-12, -30], [13, -34], [0, -40]]) p.stroke([[hx + dx * u, hy + (dy - 4) * u], [hx + dx * u, hy + (dy + 4) * u]], 2 * u, "#fff3a8");
      p.dot(hx, hy + 4 * u, 5.5 * u);
    } else if (prop === "watch") {
      p.ell(hx + 6 * u, hy, 7 * u, 7 * u, "#e9e4d8", 2.2 * u); p.stroke([[hx + 6 * u, hy], [hx + 6 * u, hy - 4 * u]], 1.6 * u); p.dot(hx - 4 * u, hy, 5.5 * u);
    } else if (prop === "mic") {
      p.band([[hx, hy + 2 * u], [hx - 4 * u, hy - 16 * u]], "#2b2b33", 4 * u, 1.2 * u, "round"); p.ell(hx - 5 * u, hy - 20 * u, 6 * u, 6 * u, "#9aa0a8", 2 * u); p.dot(hx, hy + 4 * u, 5.5 * u);
    } else if (prop === "mug") {
      p.poly([[hx - 12 * u, hy - 20 * u], [hx + 10 * u, hy - 20 * u], [hx + 9 * u, hy + 6 * u], [hx - 11 * u, hy + 6 * u]], "#e9e4d8", 2.4 * u);
      p.arc(hx + 12 * u, hy - 7 * u, 6 * u, 7 * u, -80, 80, 3 * u);
      p.stroke([[hx - 8 * u, hy - 12 * u], [hx + 6 * u, hy - 12 * u]], 4 * u, "#c0533f");
      p.dot(hx - 2 * u, hy + 2 * u, 5.5 * u);
    } else if (prop === "phone") {
      const px = hx - 0.1 * T.a;
      p.poly(rrect(px - 11 * u, hy - 30 * u, px + 11 * u, hy + 6 * u, 4 * u), "#26232c", 2.2 * u);
      p.poly(rrect(px - 8 * u, hy - 27 * u, px + 8 * u, hy + 3 * u, 2.5 * u), "#f7b9d6", 0);
      p.ell(px, hy - 16 * u, 4 * u, 4 * u, "#e8e6f2", 0); // tiny companion on the screen
      p.dot(hx, hy, 5.5 * u); p.dot(arms[0].pts[2][0], arms[0].pts[2][1], 5.5 * u);
    } else if (prop === "clipboard") {
      const cx0 = (hx + arms[0].pts[2][0]) / 2;
      p.poly([[cx0 - 26 * u, hy - 38 * u], [cx0 + 26 * u, hy - 38 * u], [cx0 + 26 * u, hy + 14 * u], [cx0 - 26 * u, hy + 14 * u]], "#b07a4a", 2.4 * u);
      p.poly([[cx0 - 20 * u, hy - 32 * u], [cx0 + 20 * u, hy - 32 * u], [cx0 + 20 * u, hy + 9 * u], [cx0 - 20 * u, hy + 9 * u]], "#f7f3e8", 0);
      for (let i = 0; i < 4; i++) p.stroke([[cx0 - 14 * u, hy - 22 * u + i * 8 * u], [cx0 + (i % 2 ? 8 : 13) * u, hy - 22 * u + i * 8 * u]], 2 * u, "#8b8fa0");
      p.poly([[cx0 - 9 * u, hy - 42 * u], [cx0 + 9 * u, hy - 42 * u], [cx0 + 9 * u, hy - 34 * u], [cx0 - 9 * u, hy - 34 * u]], "#9aa0a8", 1.8 * u);
      p.dot(hx, hy, 5.5 * u); p.dot(arms[0].pts[2][0], arms[0].pts[2][1], 5.5 * u);
    } else if (prop === "icecream") {
      p.poly([[hx - 8 * u, hy - 12 * u], [hx + 8 * u, hy - 12 * u], [hx, hy + 7 * u]], "#e0a35a", 1.8 * u);
      p.ell(hx, hy - 19 * u, 11 * u, 10 * u, "#f7c6d9", 2.2 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (Array.isArray(prop)) {
      const ang = rad(-70 + 105 * clamp(prop[1], 0, 1));
      const Rh = (pts: P2[]) => rotPts(pts, ang, hx, hy);
      p.band(Rh([[hx, hy + 12 * u], [hx, hy - 44 * u]]), "#8a5a34", 5 * u, 1.5 * u, "round");
      p.poly(Rh([[hx - 12 * u, hy - 58 * u], [hx + 20 * u, hy - 58 * u], [hx + 20 * u, hy - 42 * u], [hx - 12 * u, hy - 42 * u]]), "#7d848c", 2.2 * u);
      p.dot(hx, hy, 5.5 * u);
    }
  }
  if (Array.isArray(prop) && prop[0] === "point" && prop[1] > 0.5) { // index finger beyond the fist
    const [hx, hy] = arms[arms.length - 1].pts[2];
    p.stroke([[hx, hy], [hx + 13 * u, hy - 9 * u]], 5 * u + 4, INK); p.stroke([[hx, hy], [hx + 13 * u, hy - 9 * u]], 5 * u, skin);
    p.dot(hx, hy, 6 * u);
  }
  if (o.collar) p.poly([[tcx - 16 * u, chin + 0.03 * HH], [tcx, chin + 0.16 * HH], [tcx + 16 * u, chin + 0.03 * HH], [tcx, chin + 0.07 * HH]], o.collar, 2 * u);
  if (prop === "shako") { // carried by the left hand
    const [hx, hy] = arms[0].pts[2];
    p.poly([[hx - 14 * u, hy + 3 * u], [hx + 14 * u, hy + 3 * u], [hx + 16 * u, hy + 30 * u], [hx - 16 * u, hy + 30 * u]], "#3a3d47", 2.2 * u);
    p.ell(hx, hy + 31 * u, 3.5 * u, 3.5 * u, "#2b7a4b", 1.5 * u);
    p.dot(hx, hy, 5.5 * u);
  }
  // ---- head: rotates with the body, plus its own tilt about the chin ----
  const Ah = A + headTilt, [cpx, cpy] = rotAbout([300, chin], rad(A), [300, hipY]);
  p.rot = Ah ? [rad(Ah), 300, chin, cpx - 300, cpy - chin] : null;
  hatBehind(p, o, H, 300, hc, light, thick, ow, false);
  const hp = blobPts(300, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  hatOn(p, o, hp, H, 300, hc, light, seed, facing, false);
  const brim = !!o.hat && o.hat !== "hair" && o.hat !== "bonnet" && o.hat !== "cap";
  faceFront(p, 300, hc, W, expr, facing, look, lid, brim, skin, o.moustache, o.build === "stout", o.eyes, o.glasses);
  p.rot = null;
};

export type SideOpts = {
  phase?: number; expr?: Expr; mode?: "march" | "stand" | "swing" | "push"; blink?: boolean | number; stomp?: number; pose?: number;
  /** step length as a multiple of 0.8 m (370 units): matches 1.6 m/s at 2 steps/s; scale by the view's foreshortening */
  stride?: number; light?: number; seed?: number;
  /** push mode: where the hands land at pose 1, in final canvas units (e.g. the swing kid's back) */
  hand?: [number, number];
};

/** two-bone leg, knee bending forward (+x) */
const ik = (hip: P2, ank: P2, l1: number, l2: number): P2 => {
  const dx = ank[0] - hip[0], dy = ank[1] - hip[1], d = clamp(Math.hypot(dx, dy), 1, l1 + l2 - 0.01);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), k = Math.atan2(dy, dx) - A;
  return [hip[0] + l1 * Math.cos(k), hip[1] + l1 * Math.sin(k)];
};

/** hip height of the seated kid in `swing` mode (design units); swingKid seats the torso bottom on the plank */
const SWING_HIP = 733;

/** side view facing screen-right; march footfalls land at phase 0 (near foot) and 0.5 (far foot), like the front view.
 *  The stance foot is planted: it slides back at exactly the walking speed while the hip rises and falls over it. */
export const bodySide = (p: Pen, o: Outfit, opts: SideOpts) => {
  const { phase = 0, expr = "neutral", mode = "march", blink = false, stomp = 1, pose = 0, stride = 1, light = DEF_LIGHT, seed = 1 } = opts;
  const Bd = BUILD[o.build ?? "adult"], skin = o.skin ?? SKIN, two = Math.PI * 2, lid = lidOf(blink);
  const H: Blob = { ...headBlob(seed, Bd.a, 1), asym: 0.12, rot: rad(3 + 3 * (rnd(seed, 7) - 0.5)) };
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, sole = 975, ankY = sole - 4 * u;
  const thick = thickAngle(light), ow = 5 * u;
  const legLen = (Bd.legs + 0.12) * HH - 4 * u, l1 = legLen / 2, l2 = legLen / 2;
  const nearCol = mix(o.pants, INK, 0.55), farCol = mix(o.pants, INK, 0.75), footCol = o.boots;
  type LegS = { ank: P2; pitch: number; near: boolean };
  const legs: LegS[] = [];
  let hipY = ankY - legLen * 0.995, lean = 0, nearFwd = 0;
  if (mode === "march") {
    const S = 370 * stride, liftH = Math.max(22, 40 + 70 * (stomp - 1));
    const st = (ph: number) => {
      const c = (((phase + ph) % 1) + 1) % 1;
      if (c < 0.5) { const s = c / 0.5; return { x: S / 2 - S * s, h: 0, stance: true, s }; }
      const s = (c - 0.5) / 0.5; // swing: cycloid in world space, so the foot leaves and lands at zero ground speed
      return { x: -S / 2 + S * s - (S / Math.PI) * Math.sin(2 * Math.PI * s), h: liftH * Math.sin(Math.PI * s), stance: false, s };
    };
    const nL = st(0), fL = st(0.5), stance = nL.stance ? nL : fL;
    const Leff = legLen * (1 - 0.035 * Math.sin(Math.PI * stance.s));
    hipY = ankY - Math.sqrt(Math.max(1, Leff * Leff - stance.x * stance.x));
    for (const [L, near] of [[fL, false], [nL, true]] as const)
      legs.push({ ank: [300 + L.x, ankY - L.h], pitch: L.stance ? 0 : rad(35 * Math.sin(Math.PI * L.s) * (1 - 1.6 * L.s)), near });
    lean = 4 + 3 * Math.cos(2 * two * phase); // 7 deg at contact, 1 deg at passing
    nearFwd = nL.x / (S / 2);
  } else if (mode === "push") {
    hipY = ankY - 0.87 * legLen;
    legs.push({ ank: [300 - 0.5 * legLen, ankY], pitch: rad(-8), near: false }, { ank: [300 + 0.32 * legLen, ankY], pitch: 0, near: true });
    lean = 14 * pose;
  } else if (mode === "swing") {
    hipY = SWING_HIP;
    const a = rad(60 * pose);
    for (const [dx, near] of [[-6, false], [0, true]] as const) {
      const knee: P2 = [300 + l1 * 0.98 + dx * u, hipY + 6 * u];
      legs.push({ ank: [knee[0] + l2 * Math.sin(a), knee[1] + l2 * Math.cos(a)], pitch: -a * 0.5, near });
    }
  } else {
    legs.push({ ank: [300 - 4 * u, ankY], pitch: 0, near: false }, { ank: [300 + 4 * u, ankY], pitch: 0, near: true });
    lean = 66 * pose; // stand + pose = a bow (0 upright .. 1 deep bow)
  }
  const torsoBot = hipY + 0.12 * HH, chin = torsoBot - Bd.torso * HH, hc = chin - H.b, crown = hc - H.b, hip: P2 = [300, hipY];
  p.rot = null;
  for (const L of legs) {
    const knee = mode === "swing" ? ([300 + l1 * 0.98 + (L.near ? 0 : -6 * u), hipY + 6 * u] as P2) : ik(hip, L.ank, l1, l2);
    const hp0: P2 = [300 + (L.near ? 0 : -5 * u), hipY];
    p.stroke([hp0, knee, L.ank], 5.8 * u, L.near ? nearCol : farCol);
    const c = Math.cos(L.pitch), s = Math.sin(L.pitch);
    footStroke(p, [L.ank[0] - 3 * u * c, L.ank[1] - 3 * u * s], [L.ank[0] + 13 * u * c, L.ank[1] + 13 * u * s + 0.5 * u],
      7.5 * u, L.near ? footCol : footCol === INK ? INK : shade(footCol, 0.82));
  }
  // ---- upper body leans about the hip ----
  p.rot = lean ? [rad(lean), 300, hipY] : null;
  const T: Blob = { a: (o.build === "stout" ? 0.36 : 0.31) * W, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.5, egg: 0.1, asym: 0.06,
    rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 2 * u, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const armCol = mix(o.jacket, INK, 0.5), farArm = mix(o.jacket, INK, 0.68);
  const S: P2 = [tcx + 0.05 * T.a, chin + 0.14 * HH], aLen = 0.95 * HH;
  const swingArm = (ang: number): [P2, P2, P2] => {
    const e: P2 = [S[0] + Math.sin(ang) * aLen * 0.5, S[1] + Math.cos(ang) * aLen * 0.5], a2 = ang + rad(16) * Math.sign(ang || 1);
    return [S, e, [e[0] + Math.sin(a2) * aLen * 0.5, e[1] + Math.cos(a2) * aLen * 0.5]];
  };
  const rifle = !!o.rifle && (mode === "march" || mode === "stand");
  const B0: P2 = [tcx + 0.72 * T.a, chin + 0.58 * HH], B1: P2 = [tcx - 0.95 * T.a - 22 * u, crown - 0.4 * HH];
  let near: [P2, P2, P2], far: [P2, P2, P2] | null;
  if (mode === "swing") { near = [S, [S[0] + 12 * u, S[1] - 0.16 * HH], [300 + 6 * u, chin - 0.3 * HH]]; far = [S, [S[0] + 8 * u, S[1] - 0.18 * HH], [300 + 2 * u, chin - 0.36 * HH]]; }
  else if (mode === "push") {
    const reach = 0.55 * HH + 0.45 * HH * pose;
    let hN: P2 = [S[0] + reach, S[1] + 0.06 * HH];
    if (opts.hand) {
      // target is in final canvas units; the arm is drawn inside the lean rotation, so undo it
      const th = -rad(lean), dx = opts.hand[0] - 300, dy = opts.hand[1] - hipY;
      const tg: P2 = [300 + dx * Math.cos(th) - dy * Math.sin(th), hipY + dx * Math.sin(th) + dy * Math.cos(th)];
      hN = [hN[0] + (tg[0] - hN[0]) * pose, hN[1] + (tg[1] - hN[1]) * pose];
    }
    near = [S, [(S[0] + hN[0]) / 2, (S[1] + hN[1]) / 2 + 0.06 * HH], hN];
    far = [S, [(S[0] + hN[0]) / 2 - 4 * u, (S[1] + hN[1]) / 2 - 0.02 * HH], [hN[0] - 6 * u, hN[1] - 0.08 * HH]];
  } else if (rifle) { near = [S, [S[0] - 4 * u, S[1] + 0.42 * HH], B0]; far = mode === "march" ? swingArm(rad(30) * nearFwd) : swingArm(0); }
  else { near = swingArm(rad(-30) * nearFwd); far = mode === "march" ? swingArm(rad(30) * nearFwd) : null; }
  if (far) { p.stroke(curve(far[0], far[1], far[2]), 5.2 * u, farArm); p.dot(far[2][0], far[2][1], 5.5 * u); }
  p.gradFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light);
  p.clip(tp, () => {
    if (o.belt) p.band([[tcx - 0.65 * T.a, chin - 0.05 * HH], [tcx + 0.75 * T.a, torsoBot - 0.1 * HH]], o.belt!, 5.5 * u, 1.8 * u);
    if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
    if (!o.dress) for (let i = 0; i < 3; i++) { const y = chin + 0.16 * HH + i * 0.24 * HH; p.dot(tcx + 0.8 * T.a, y, 3 * u, INK); p.dot(tcx + 0.8 * T.a, y, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7)); }
  });
  p.inkRing(tp, ow, thick);
  if (rifle) {
    p.band([B0, B1], "#7a4b2a", 5 * u, 1.5 * u, "round");
    p.band([lerp2(B0, B1, 0.6), B1], "#8d949c", 2.4 * u, 1.2 * u, "round");
  }
  p.stroke(curve(near[0], near[1], near[2]), 5.2 * u, armCol); p.dot(near[2][0], near[2][1], 5.5 * u);
  // ---- head ----
  const hx = 300 + 4 * u;
  hatBehind(p, o, H, hx, hc, light, thick, ow, true);
  const hp = blobPts(hx, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  hatOn(p, o, hp, H, hx, hc, light, seed, 1, true);
  const brim = !!o.hat && o.hat !== "hair" && o.hat !== "bonnet" && o.hat !== "cap";
  faceSide(p, hx, hc, W, expr, lid, brim, skin, o.moustache, o.build === "stout");
  p.rot = null;
};

/** rope + seat + seated kid on a 700 x 2300 canvas; the pivot is design (350, 20); kid drawn at 0.92 scale */
export const swingKid = (p: Pen, o: Outfit, kick: number, expr: Expr, light = DEF_LIGHT, blink: number = 0) => {
  const rope = 1830, k = 1.1, HH = 2 * headBlob(5, BUILD[o.build ?? "adult"].a, 1).b;
  // two ropes from the pivot to the ends of a wide plank, the kid framed between them: a single rope behind the kid
  // ended at the cap and read as a hanging. Far rope behind the kid, near rope drawn over (clear of the face).
  const seat = rope + 18, x0 = 150, x1 = 550;
  p.line([[350, 20], [x0 + 16, seat + 4]], "#a07a4c", 10);
  p.poly(rrect(x0, seat, x1, seat + 36, 10), "#b5653f", 9);
  const g = p.g;
  g.save();
  g.translate(350 - 300 * k, rope + 18 - (SWING_HIP + 0.12 * HH) * k);
  g.scale(k, k);
  bodySide(new Pen(g), o, { expr, mode: "swing", pose: kick, light, seed: 5, blink });
  g.restore();
  p.line([[350, 20], [x1 - 16, seat + 4]], "#a07a4c", 10);
};

// ---------------- effects ----------------
export const fxNote = (p: Pen, kind: number, col = "#1f2a44") => {
  p.ell(70, 200, 46, 34, col, 8, 0, 360, -20);
  p.stroke([[110, 190], [110, 40]], 14);
  if (kind === 0) p.poly([[110, 40], [170, 70], [170, 110], [110, 82]], col, 8);
  else {
    p.ell(150, 170, 40, 30, col, 8, 0, 360, -20);
    p.stroke([[186, 160], [186, 20]], 14);
    p.poly([[110, 40], [186, 20], [186, 50], [110, 70]], col, 8);
  }
};

/** spark / impact star on a 500 x 500 canvas; t in 0..1 */
export const fxBurst = (p: Pen, t: number, col = "#fff3b0", rays = 10, r0 = 40, r1 = 230) => {
  const c = 250, e = 1 - (1 - t) ** 3;
  for (let i = 0; i < rays; i++) {
    const a = rad((i * 360) / rays + 7 * (i % 2)), ra = r0 + (r1 - r0) * e * (0.75 + 0.25 * (i % 2));
    p.poly([[c + r0 * 0.5 * Math.cos(a + 0.18), c + r0 * 0.5 * Math.sin(a + 0.18)], [c + ra * Math.cos(a), c + ra * Math.sin(a)],
      [c + r0 * 0.5 * Math.cos(a - 0.18), c + r0 * 0.5 * Math.sin(a - 0.18)]], col, Math.max(3, 8 * (1 - t)));
  }
  if (t < 0.5) p.ell(c, c, r0 * (1.4 - t), r0 * (1.4 - t), WHITE, 8);
};

/** water splash crown on an 800 x 800 canvas; t in 0..1 */
export const fxSplash = (p: Pen, t: number) => {
  const c = 400, size = 800, rise = Math.sin(Math.min(1, t * 1.3) * Math.PI);
  const blue = "#bfe8ff", deep = "#6cc0f0";
  if (rise > 0.02) {
    const pts: P2[] = [];
    for (let i = 0; i < 19; i++) {
      const h = (i % 2 ? 260 : 130) * rise * (0.7 + 0.3 * Math.sin(i * 1.7));
      pts.push([c - 330 + (660 * i) / 18, size - 120 - h]);
    }
    p.poly([...pts, [c + 330, size - 90], [c - 330, size - 90]], blue, 10);
    p.ell(c, size - 100, 360, 46, deep, 10);
  }
  for (let i = 0; i < 8; i++) {
    const a = rad(200 + i * 18), d = 120 + 380 * t, y = size - 160 + d * Math.sin(a) + 520 * t * t, r = 26 * (1 - t) + 6;
    if (t > 0.08 && y < size - 40) p.ell(c + d * Math.cos(a), y, r, r * 1.25, blue, 7);
  }
};

/** dust puff on a 300 x 300 canvas; t in 0..1 */
export const fxPuff = (p: Pen, t: number) => {
  for (let i = 0; i < 5; i++) {
    const a = rad(160 + i * 55), d = 40 + 70 * t, r = (34 + 20 * (i % 2)) * (1 - 0.6 * t);
    p.ell(150 + d * Math.cos(a), 180 + d * 0.45 * Math.sin(a), r, r * 0.8, `rgba(238,225,205,${(1 - t).toFixed(3)})`, 0);
  }
};

/** circling stars on a 420 x 210 canvas */
export const fxStars = (p: Pen, t: number) => {
  for (let i = 0; i < 4; i++) {
    const a = t * Math.PI * 2 + (i * Math.PI) / 2, x = 210 + 150 * Math.cos(a), y = 110 + 40 * Math.sin(a), pts: P2[] = [];
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 14 : 34, b = rad(k * 36 - 90); pts.push([x + r * Math.cos(b), y + r * Math.sin(b)]); }
    p.poly(pts, "#ffd84a", 6);
  }
};

/** three jittering strain ticks on a 300 x 300 canvas */
export const fxCreak = (p: Pen, t: number) => {
  const j = 6 * Math.sin(t * 40);
  for (const a of [-30, 0, 30]) {
    const b = rad(a - 90);
    p.stroke([[150 + 70 * Math.cos(b) + j, 230 + 70 * Math.sin(b)], [150 + 100 * Math.cos(b) + 10 + j, 230 + 100 * Math.sin(b)],
      [150 + 130 * Math.cos(b) + j, 230 + 130 * Math.sin(b)]], 10);
  }
};

/** flat water ring (drawn top-down) on a 600 x 600 canvas; t in 0..1 */
export const fxRing = (p: Pen, t: number) => {
  // thin light water rings (white crest, pale blue trailing rings), thinning as they spread
  const g = p.g;
  for (let k = 0; k < 3; k++) {
    const u = t - k * 0.22;
    if (u <= 0 || u >= 1) continue;
    g.beginPath(); g.ellipse(300, 300, 60 + 230 * u, 60 + 230 * u, 0, 0, Math.PI * 2);
    g.strokeStyle = k === 0 ? "#f6fcff" : "#cfe8fa"; g.lineWidth = 9 * (1 - u) + 3; g.stroke();
  }
};

/** text-free sign on a 700 x 520 canvas: "no marching in step on the bridge". A bridge (deck + arch + piers), four
 *  identical pairs of marching legs in the same stride (in step), a bold red X over all of it. */
export const fxSign = (p: Pen) => {
  const g = p.g, RED = "#d42f2f";
  p.poly(rrect(14, 14, 686, 506, 40), "#f6ecd2", 0);
  p.poly(rrect(14, 14, 686, 506, 40), null, 14);
  // bridge: deck, stone arch underneath, two piers
  p.poly(rrect(70, 352, 630, 384, 8), "#8a5a3a", 9);
  g.beginPath(); g.moveTo(112, 470); g.quadraticCurveTo(350, 300, 588, 470);
  g.strokeStyle = INK; g.lineWidth = 16; g.lineCap = "round"; g.stroke();
  for (const x of [88, 612]) p.poly(rrect(x - 16, 384, x + 16, 470, 4), "#8a5a3a", 9);
  // four identical soldiers' legs mid-stride: same leg forward on every one = in step
  for (const x of [150, 278, 406, 534]) {
    p.poly(rrect(x - 30, 150, x + 30, 214, 14), "#357650", 9);                  // coat hem
    p.stroke([[x - 8, 210], [x + 34, 262], [x + 46, 338]], 15, INK);           // front leg
    p.stroke([[x + 6, 210], [x - 12, 274], [x - 36, 336]], 15, INK);           // back leg
    p.poly(rrect(x + 30, 330, x + 74, 350, 9), INK, 0);                          // boots point forward
    p.poly(rrect(x - 52, 328, x - 8, 348, 9), INK, 0);
  }
  // big red X
  for (const [a, b] of [[[96, 70], [604, 452]], [[604, 70], [96, 452]]] as [[number, number], [number, number]][]) {
    p.stroke([a, b], 58, "#ffffff");
    p.stroke([a, b], 42, RED);
  }
};

/** soft cartoon cloud on a 600 x 300 canvas */
export const fxCloud = (p: Pen, seed: number) => {
  const blobs: [number, number, number][] = [[150, 190, 80], [250, 150, 105], [360, 160, 95], [450, 195, 70], [300, 210, 90]];
  for (const [x, y, r] of blobs) p.ell(x + ((seed * 37) % 20) - 10, y, r, r * 0.8, "#ffffff", 0);
  p.ell(300, 235, 230, 40, "#ffffff", 0);
};

/** cast shadow on a 128 x 256 canvas: dark soft contact pool at the feet (y 205) and a softer tail that runs up the
 *  canvas = away from the sun, fading with distance; multiply colour (sRGB-encoded linear ratio), white = no change */
export const fxShadow = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 256);
  g.save(); g.filter = "blur(9px)";
  const lg = g.createLinearGradient(0, 205, 0, 22);
  lg.addColorStop(0, mix(col, WHITE, 0.08)); lg.addColorStop(0.55, mix(col, WHITE, 0.3)); lg.addColorStop(1, mix(col, WHITE, 0.85));
  g.fillStyle = lg;
  g.beginPath(); g.moveTo(40, 205); g.bezierCurveTo(36, 120, 46, 50, 64, 30); g.bezierCurveTo(82, 50, 92, 120, 88, 205); g.closePath(); g.fill();
  g.fillStyle = col; g.beginPath(); g.ellipse(64, 205, 30, 17, 0, 0, Math.PI * 2); g.fill();
  g.restore();
};

/** tight contact shadow right under the feet on a 128 x 128 canvas: dark core, short fall-off (multiply colour) */
export const fxContact = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, k] of [[0, 0], [0.32, 0.02], [0.5, 0.22], [0.66, 0.58], [0.82, 0.88], [1, 1]] as const) gr.addColorStop(r, mix(col, WHITE, k));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
};

/** floating wooden plank, side-on, on a 320 x 110 canvas */
export const fxPlank = (p: Pen) => {
  p.poly(rrect(14, 30, 306, 78, 10), "#a8744a", 9);
  p.line([[40, 46], [150, 44], [270, 50]], "#7d5234", 4);
  p.line([[60, 62], [200, 64], [284, 60]], "#7d5234", 4);
  p.dot(36, 54, 5, INK); p.dot(284, 54, 5, INK);
};

/** floating marching drum (no text) on a 260 x 240 canvas: white shell, red hoops, ink zig-zag cord */
export const fxDrum = (p: Pen) => {
  p.poly(rrect(40, 70, 220, 190, 16), "#f1ece0", 9);
  p.poly(rrect(32, 58, 228, 86, 12), "#c9373a", 8);
  p.poly(rrect(32, 176, 228, 204, 12), "#c9373a", 8);
  p.line([[52, 88], [82, 172], [112, 88], [142, 172], [172, 88], [202, 172]], INK, 6);
  p.ell(130, 58, 98, 18, "#f7f3ea", 8);
};

/** soft ground contact blob on a 128 x 128 canvas, multiply colour (sRGB-encoded linear ratio) in the centre */
export const fxBlob = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 128);
  // soft contact shadow: flat core, then a long smooth (roughly gaussian) fall-off to white = no change
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, k] of [[0, 0], [0.5, 0.04], [0.64, 0.18], [0.76, 0.42], [0.87, 0.72], [0.95, 0.92], [1, 1]] as const) gr.addColorStop(r, mix(col, WHITE, k));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
};

// ======================= ELIZA -> Feeloy additions =======================
/** the Feeloy companion (user's character): silver hair with pink + blue streaks, high ponytail, red eyes, black outfit */
export const COMPANION: Outfit = { jacket: "#4a4258", pants: "#2b2732", boots: "#1e1b22", dress: "#2f2a38", hat: "hair", hair: "#d6d2ea",
  longHair: "#cfcae4", ponytail: "#cfcae4", streak: "#f272b0", skin: "#fff1e8", collar: "#f6f2f7" }; // standard ink eyes like the rest of the cast

/** a dog in profile facing screen-right, in the 600 x 1000 design space (paws on y = 975).
 *  tilt = head tilt in degrees (the "listening" tilt), pant = open mouth with tongue, wag = tail phase */
export const dogSide = (p: Pen, o: { tilt?: number; pant?: boolean; wag?: number; blink?: number; light?: number }) => {
  const { tilt = 0, pant = false, wag = 0, blink = 0, light = DEF_LIGHT } = o, u = 2.2, coat = "#c98a4b", belly = "#f2dcb8", ear = "#7a4a2a";
  const thick = thickAngle(light);
  // tail
  const ta = rad(-35 + 18 * Math.sin(wag * Math.PI * 2));
  p.line([[200, 812], [200 - 70 * Math.cos(ta), 812 + 70 * Math.sin(ta) - 30]], coat, 14 * u);
  // legs (back pair darker)
  for (const [x, c] of [[228, mix(coat, INK, 0.25)], [398, mix(coat, INK, 0.25)], [250, coat], [420, coat]] as const) {
    p.line([[x, 860], [x + 2, 960]], c, 11 * u); p.ell(x + 10, 965, 24, 11, c, 9);
  }
  // body: sitting-up bean
  const body: Blob = { a: 130, b: 70, nTop: 2.2, nBot: 2.4, egg: 0.05, asym: 0.05, rot: rad(-8), noise: 0.006, seed: 31 };
  const bp = blobPts(318, 838, body);
  p.gradFill(bp, coat, mul(coat, SH_CLOTH), light);
  p.clip(bp, () => p.ell(360, 880, 90, 34, belly, 0));
  p.inkRing(bp, 11, thick);
  // head, tilted about the neck
  p.rot = [rad(tilt), 430, 760];
  const hb: Blob = { a: 74, b: 66, nTop: 2.3, nBot: 2.2, egg: -0.05, asym: 0.08, rot: 0, noise: 0.006, seed: 33 };
  const hp = blobPts(452, 712, hb);
  p.shadedFill(hp, coat, mul(coat, SH_SKIN), light, 74);
  p.inkRing(hp, 11, thick);
  // muzzle
  p.ell(522, 742, 42, 30, belly, 9);
  p.ell(560, 728, 13, 10, INK, 0); // nose
  if (pant) { p.ell(530, 768, 18, 14, "#5a1e28", 6, 0, 180); p.ell(533, 784, 9, 12, "#e86e78", 5); }
  else p.arc(528, 758, 16, 7, 20, 160, 6);
  // eye + brow
  if (blink >= 1) p.stroke([[470, 700], [494, 700]], 8); else p.ell(482, 700, 8, 11, INK, 0);
  p.stroke([[468, 680], [498, 676]], 7);
  // floppy ear
  p.poly([[420, 664], [452, 650], [446, 738], [418, 752], [404, 716]], ear, 10);
  p.rot = null;
};

/** teletype paper: perforated cream sheet with n lines of "typing" (squiggles, not legible) and an optional big question mark */
export const fxPaper = (p: Pen, n: number, q: boolean, torn = false) => {
  const g = p.g, W = 400, H = 600;
  g.fillStyle = "#f6f0dd"; g.fillRect(30, 0, W - 60, H);
  g.fillStyle = "rgba(120,100,70,0.12)"; g.fillRect(30, 0, 22, H); g.fillRect(W - 52, 0, 22, H);
  for (let y = 12; y < H; y += 30) { p.dot(41, y, 5, "#d8cfb6"); p.dot(W - 41, y, 5, "#d8cfb6"); }
  for (let i = 0; i < n; i++) {
    const y = H - 40 - i * 34, len = 140 + ((i * 53) % 120), s: P2[] = [];
    for (let x = 0; x <= len; x += 6) s.push([78 + x, y + 3 * Math.sin(x * 0.35 + i)]);
    p.stroke(s, 7, i % 2 ? "#3c3f6e" : "#2b2b33");
  }
  if (q) {
    p.arc(200, 210, 52, 48, 190, 400, 22, "#2b2b33");
    p.stroke([[226, 252], [200, 278], [200, 312]], 22, "#2b2b33");
    p.dot(200, 352, 14, "#2b2b33");
  }
  if (torn) { const s: P2[] = []; for (let x = 30; x <= W - 30; x += 20) s.push([x, H - 4 - (x % 40 ? 10 : 0)]); p.stroke(s, 3, "#b8ad92"); }
  g.strokeStyle = "rgba(60,40,30,0.5)"; g.lineWidth = 4; g.strokeRect(30, -2, W - 60, H + 4);
};

/** speech bubble with an icon: "brief" = briefcase + question mark (how did the interview go?), "heart" */
export type BubbleIcon = "brief" | "heart" | "dots" | "cat" | "ask" | "note" | "door" | "mail" | "zzz" | "pin" | "flake";
export const fxBubble = (p: Pen, icon: BubbleIcon, pop = 1) => {
  p.g.save(); p.g.translate(250, 210); p.g.scale(pop, pop); p.g.translate(-250, -210);
  p.poly([[150, 280], [96, 400], [240, 318]], "#ffffff", 12);
  p.ell(250, 180, 200, 150, "#ffffff", 12);
  p.poly([[160, 268], [120, 360], [236, 300]], "#ffffff", 0);
  if (icon === "brief") {
    p.poly(rrect(120, 150, 300, 270, 18), "#8a5a34", 9);
    p.poly(rrect(170, 118, 250, 158, 10), null, 9);
    p.stroke([[120, 200], [300, 200]], 8);
    p.arc(352, 170, 30, 28, 190, 400, 15);
    p.stroke([[370, 196], [352, 214], [352, 236]], 15);
    p.dot(352, 262, 9);
  } else if (icon === "heart") {
    p.poly([[250, 290], [160, 200], [170, 130], [230, 120], [250, 160], [270, 120], [330, 130], [340, 200]], "#f272b0", 10);
  } else if (icon === "cat") catFace(p, 250, 190, 0.9);
  else if (icon === "ask") { const g = p.g; g.font = "900 150px Montserrat, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 14; g.strokeStyle = INK; g.strokeText("?", 250, 190); g.fillStyle = "#f272b0"; g.fillText("?", 250, 190); }
  else if (icon === "note") { p.poly(rrect(170, 100, 330, 290, 14), "#fff6d8", 9); for (const y of [150, 190, 230]) p.stroke([[198, y], [302, y]], 8, "#9aa0aa"); p.ell(300, 120, 26, 26, "#f272b0", 7); }
  else if (icon === "mail") { p.poly(rrect(150, 120, 350, 260, 12), "#fff6d8", 9); p.stroke([[156, 128], [250, 200], [344, 128]], 9); p.ell(312, 236, 20, 18, "#f272b0", 6); }
  else if (icon === "zzz") { txt(p, "Z", 200, 210, 110, "#5a8fc2", 9); txt(p, "z", 280, 150, 80, "#5a8fc2", 8); txt(p, "z", 335, 105, 56, "#5a8fc2", 7); }
  else if (icon === "pin") { p.stroke([[150, 250], [215, 215], [285, 245], [350, 210]], 8, "#9aa0aa"); p.poly([[250, 270], [205, 175], [210, 130], [250, 108], [290, 130], [295, 175]], "#d8433e", 9); p.ell(250, 150, 18, 18, "#ffffff", 6); }
  else if (icon === "flake") { for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3, dx = 85 * Math.cos(a), dy = 85 * Math.sin(a); p.stroke([[250 - dx, 185 - dy], [250 + dx, 185 + dy]], 14, "#5a8fc2"); } p.dot(250, 185, 16, "#5a8fc2"); }
  else if (icon === "door") { p.poly(rrect(185, 95, 315, 295, 8), "#ffe9a8", 9); p.poly([[185, 95], [255, 120], [255, 310], [185, 295]], "#8a5a34", 8); p.dot(240, 205, 7, "#f2c94c"); }
  else for (const x of [180, 250, 320]) p.dot(x, 180, 18);
  p.g.restore();
};

/** wall mirror: gilt oval frame, silvered glass, and the reflection (front view of `o`, mirrored) */
export const fxMirror = (p: Pen, o: Outfit, expr: Expr, blink: number, look: number, tilt = 0) => {
  const g = p.g, glass = ellPts(300, 400, 230, 330);
  p.ell(300, 400, 262, 362, "#c9a24e", 14);
  p.clip(glass, () => {
    const gr = g.createLinearGradient(0, 70, 0, 730); gr.addColorStop(0, "#c9d8e6"); gr.addColorStop(1, "#8fa6bd");
    g.fillStyle = gr; g.fillRect(0, 0, 600, 800);
    g.save(); g.translate(600, 0); g.scale(-1, 1); g.translate(0, -40);
    g.save(); g.translate(300, 0); g.scale(1.25, 1.25); g.translate(-300, 0);
    bodyFront(p, o, { mode: "stand", expr, blink, look, facing: 0, seed: 4, headTilt: tilt });
    g.restore(); g.restore();
    g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.moveTo(130, 120); g.lineTo(220, 90); g.lineTo(120, 420); g.lineTo(90, 400); g.fill();
  });
  p.ell(300, 400, 230, 330, null, 10);
};

/** booth terminal screen: green phosphor glow with a few typing lines */
export const fxScreen = (p: Pen, n: number) => {
  const g = p.g;
  p.poly(rrect(10, 10, 290, 210, 24), "#16302a", 10);
  for (let i = 0; i < n; i++) { const y = 50 + i * 34, s: P2[] = []; for (let x = 0; x < 120 + ((i * 47) % 90); x += 6) s.push([40 + x, y + 2 * Math.sin(x * 0.4 + i)]); p.stroke(s, 8, "#7dffb2"); }
  g.fillStyle = "rgba(125,255,178,0.12)"; g.fillRect(10, 10, 280, 200);
};

/** the Feeloy app on a phone: night garden backdrop, the companion standing, a chat bubble, an input bar with a mic.
 *  pose: "listen" (head tilt, soft smile), "smile", "wave", "ask" (bubble with the briefcase). 500 x 1000 canvas. */
export const fxPhone = (p: Pen, pose: "listen" | "smile" | "wave" | "ask", blink: number, wave = 0, bubble = 0, icon: BubbleIcon = "brief", clock = "") => {
  const g = p.g;
  p.poly(rrect(14, 14, 486, 986, 64), "#1c1a22", 14);
  const scr = rrect(40, 40, 460, 960, 44);
  p.clip(scr, () => {
    const gr = g.createLinearGradient(0, 40, 0, 960);
    gr.addColorStop(0, "#2d3e74"); gr.addColorStop(0.45, "#5b6fa8"); gr.addColorStop(0.62, "#93a3c9"); gr.addColorStop(1, "#4a4f6e");
    g.fillStyle = gr; g.fillRect(0, 0, 500, 1000);
    // gothic arch + balustrade + roses
    g.fillStyle = "rgba(40,48,86,0.55)"; g.beginPath(); g.moveTo(250, 120); g.lineTo(470, 220); g.lineTo(470, 700); g.lineTo(330, 700); g.lineTo(330, 300); g.quadraticCurveTo(390, 200, 470, 250); g.fill();
    g.fillStyle = "#7d86a6"; g.fillRect(40, 690, 420, 40);
    for (const [x, y] of [[70, 760], [120, 800], [400, 770], [440, 820], [90, 870], [420, 880], [60, 690], [450, 700]]) { p.ell(x, y, 24, 20, "#b6283a", 5); p.ell(x - 4, y - 3, 10, 8, "#d8455a", 0); }
    g.save(); g.translate(250, 150); g.scale(0.62, 0.62); g.translate(-300, 0);
    const expr: Expr = pose === "wave" ? "smile_closed" : "smile";
    bodyFront(p, COMPANION, { mode: "stand", expr, blink, facing: 0, seed: 6, headTilt: pose === "listen" ? 7 : pose === "ask" ? -5 : 0,
      wave: pose === "wave" ? wave : undefined, light: rad(-120) });
    g.restore();
    // input bar + mic
    p.poly(rrect(58, 880, 380, 932, 26), "#141a2e", 4);
    p.ell(418, 906, 26, 26, "#2a3150", 4);
    p.poly(rrect(410, 890, 426, 912, 8), "#e8e6f2", 0); p.stroke([[418, 914], [418, 922]], 4, "#e8e6f2");
    // top buttons
    p.ell(84, 92, 22, 22, "#141a2e", 3); p.ell(416, 92, 22, 22, "#141a2e", 3);
    if (clock) { g.font = "800 38px Montserrat, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#f4f2fa"; g.fillText(clock, 152, 92); }
  });
  if (bubble > 0) { g.save(); g.translate(318, 170); g.scale(0.5, 0.5); g.translate(-250, -210); fxBubble(p, icon, bubble); g.restore(); }
  p.ell(250, 40, 40, 9, "#0e0d12", 0);
};

// ======================= rental-family additions =======================
/** price tag on a string: kraft paper tag with a yen coin (no figures) */
export const fxTag = (p: Pen, tilt = 0) => {
  p.g.save(); p.g.translate(120, 20); p.g.rotate(tilt); p.g.translate(-120, -20);
  p.stroke([[120, 0], [120, 40]], 4, "#5a3b2a");
  p.poly([[70, 40], [170, 40], [190, 70], [190, 210], [50, 210], [50, 70]], "#e8c88e", 6);
  p.ell(120, 64, 9, 9, "#ffffff", 4);
  p.ell(120, 140, 44, 44, "#f2c94c", 6); // yen coin: Y with two bars
  p.stroke([[100, 112], [120, 140], [140, 112]], 8); p.stroke([[120, 140], [120, 172]], 8); p.stroke([[102, 146], [138, 146]], 6); p.stroke([[102, 160], [138, 160]], 6);
  p.g.restore();
};
/** glowing crescent-moon nightlight (drawn bright; the world multiplies it over 1 for bloom) */
export const fxNightlight = (p: Pen) => {
  const g = p.g, gr = g.createRadialGradient(150, 150, 20, 150, 150, 150);
  gr.addColorStop(0, "rgba(255,226,150,0.9)"); gr.addColorStop(0.45, "rgba(255,200,110,0.35)"); gr.addColorStop(1, "rgba(255,200,110,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 300, 300);
  p.poly(rrect(118, 196, 182, 226, 8), "#d8d2c4", 5);   // plug base
  p.ell(150, 150, 58, 58, "#fff1b8", 6);                 // glowing dome
  p.ell(132, 132, 16, 12, "#ffffff", 0);
};


// ======================= "The Slow Lane" additions =======================
const txt = (p: Pen, t: string, x: number, y: number, px: number, fill: string, ol = 0, weight = 900) => {
  const g = p.g; g.font = `${weight} ${px}px Montserrat, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  if (ol) { g.lineWidth = ol; g.strokeStyle = INK; g.strokeText(t, x, y); }
  g.fillStyle = fill; g.fillText(t, x, y);
};
/** a cat's face (bubbles, the phone): ginger, ink outline */
export const catFace = (p: Pen, cx: number, cy: number, k = 1) => {
  const u = (x: number, y: number): P2 => [cx + x * k, cy + y * k];
  p.poly([u(-78, -40), u(-70, -112), u(-22, -70)], "#f0a04b", 9);
  p.poly([u(78, -40), u(70, -112), u(22, -70)], "#f0a04b", 9);
  p.ell(cx, cy, 92 * k, 74 * k, "#f0a04b", 10);
  p.poly([u(-28, -72), u(0, -40), u(28, -72)], "#d9822e", 0);
  for (const s of [-1, 1]) { p.dot(cx + s * 32 * k, cy - 6 * k, 11 * k); p.stroke([u(s * 40, 22), u(s * 112, 12)], 5); p.stroke([u(s * 40, 32), u(s * 108, 40)], 5); }
  p.poly([u(-10, 10), u(10, 10), u(0, 22)], "#f272b0", 5);
  p.stroke([u(0, 22), u(-14, 36)], 6); p.stroke([u(0, 22), u(14, 36)], 6);
};
/** hanging lane sign, 720 x 360: "chat" = the Kletskassa (cream, speech bubbles + a snail), "fast" = a plain lane 2 */
export const fxLaneSign = (p: Pen, kind: "chat" | "fast", tilt = 0) => {
  const g = p.g;
  g.save(); g.translate(360, 0); g.rotate(tilt); g.translate(-360, 0);
  p.stroke([[150, 0], [150, 70]], 7, "#3d414c"); p.stroke([[570, 0], [570, 70]], 7, "#3d414c");
  if (kind === "chat") {
    p.poly(rrect(30, 60, 690, 340, 36), "#fff4dc", 12);
    p.poly(rrect(50, 80, 670, 320, 26), null, 5);
    txt(p, "KLETSKASSA", 360, 150, 92, "#e2563f", 14);
    // two speech bubbles + a snail
    p.ell(170, 255, 62, 40, "#9fd3c7", 8); p.poly([[140, 285], [118, 318], [168, 290]], "#9fd3c7", 8); p.ell(170, 255, 62, 40, "#9fd3c7", 0);
    for (const x of [148, 170, 192]) p.dot(x, 255, 7);
    p.ell(290, 262, 54, 36, "#f6c4d6", 8); p.poly([[310, 290], [334, 320], [290, 296]], "#f6c4d6", 8); p.ell(290, 262, 54, 36, "#f6c4d6", 0);
    p.poly([[268, 258], [290, 248], [312, 258], [290, 276]], "#f272b0", 5);
    // snail
    p.poly([[400, 300], [600, 300], [620, 286], [560, 280], [430, 284]], "#9ccf6a", 8);
    p.ell(500, 248, 56, 50, "#e8b05a", 9); g.beginPath(); g.arc(500, 248, 30, 0, Math.PI * 1.6); g.strokeStyle = INK; g.lineWidth = 7; g.stroke();
    p.stroke([[600, 288], [618, 238]], 6); p.stroke([[608, 290], [640, 246]], 6); p.dot(618, 236, 9); p.dot(640, 244, 9);
  } else {
    p.poly(rrect(30, 60, 690, 340, 36), "#3f6fb5", 12);
    p.ell(170, 200, 90, 90, "#ffffff", 10); txt(p, "2", 170, 204, 130, "#3f6fb5");
    for (const x of [330, 440, 550]) p.poly([[x, 140], [x + 70, 200], [x, 260], [x + 24, 200]], "#ffffff", 8);
  }
  g.restore();
};
/** groceries, 200 x 200: 0 banana, 1 milk carton, 2 tin, 3 bread, 4 apple, 5 a full shopping bag */
export const fxItem = (p: Pen, kind: number) => {
  const g = p.g;
  if (kind === 0) {
    g.beginPath(); g.moveTo(30, 90); g.quadraticCurveTo(100, 190, 176, 70); g.quadraticCurveTo(110, 140, 46, 72); g.closePath();
    g.fillStyle = "#f6d24a"; g.fill(); g.lineWidth = 10; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke();
    p.poly([[170, 76], [184, 52], [192, 58], [180, 80]], "#7a5a2a", 7); p.dot(36, 82, 8);
  } else if (kind === 1) {
    p.poly([[60, 60], [140, 60], [140, 190], [60, 190]], "#f7f5ef", 10); p.poly([[60, 60], [100, 22], [140, 60]], "#f7f5ef", 10);
    p.poly([[60, 110], [140, 110], [140, 150], [60, 150]], "#5a8fc2", 0); p.poly([[60, 60], [140, 60], [140, 190], [60, 190]], null, 10);
  } else if (kind === 2) {
    p.poly(rrect(52, 50, 148, 186, 14), "#e2563f", 10); p.poly([[52, 96], [148, 96], [148, 140], [52, 140]], "#f6ecd2", 0); p.poly(rrect(52, 50, 148, 186, 14), null, 10);
    p.ell(100, 52, 48, 12, "#c9ccd2", 8);
  } else if (kind === 3) {
    p.poly(rrect(22, 80, 178, 176, 30), "#d9a05a", 10); p.ell(100, 84, 76, 44, "#e2b06a", 10, 180, 360);
    for (const x of [64, 100, 136]) p.stroke([[x - 10, 72], [x + 10, 100]], 7, "#a8723a");
  } else if (kind === 4) {
    p.ell(100, 116, 66, 62, "#d8433e", 10); p.stroke([[100, 58], [108, 28]], 9, "#6b4a33"); p.ell(130, 40, 26, 12, "#6aab4f", 7, 0, 360, -20);
  } else {
    p.poly([[40, 70], [160, 70], [176, 192], [24, 192]], "#e9d9b6", 10);
    p.arc(100, 70, 40, 40, 180, 360, 9);
    p.ell(70, 62, 22, 22, "#6aab4f", 7); p.poly([[112, 70], [126, 16], [144, 22], [130, 70]], "#f7f5ef", 7); p.ell(98, 60, 18, 16, "#d8433e", 7);
  }
};
/** thought bubble, 520 x 440, with an icon: weather, knee, grandkids, cat, or `face` (a small portrait of `o`) */
export type ThoughtIcon = "sun" | "knee" | "kids" | "cat" | "face" | "meat" | "dark" | "equal" | "film";
export const fxThought = (p: Pen, icon: ThoughtIcon, pop = 1, o?: Outfit) => {
  const g = p.g;
  g.save(); g.translate(260, 200); g.scale(pop, pop); g.translate(-260, -200);
  const blobs: [number, number, number][] = [[160, 200, 100], [260, 150, 120], [370, 190, 105], [300, 260, 110], [200, 270, 95]];
  for (const [x, y, r] of blobs) p.ell(x, y, r, r * 0.86, "#ffffff", 12);
  for (const [x, y, r] of blobs) p.ell(x, y, r - 6, r * 0.86 - 6, "#ffffff", 0);
  p.ell(110, 362, 26, 22, "#ffffff", 10); p.ell(70, 410, 14, 12, "#ffffff", 8);
  if (icon === "sun") {
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; p.stroke([[220 + 62 * Math.cos(a), 180 + 62 * Math.sin(a)], [220 + 84 * Math.cos(a), 180 + 84 * Math.sin(a)]], 9, "#f2b33c"); }
    p.ell(220, 180, 48, 48, "#f6d24a", 9);
    for (const [x, y, r] of [[290, 240, 46], [340, 222, 56], [390, 246, 42]] as [number, number, number][]) p.ell(x, y, r, r * 0.8, "#dde6f2", 9);
    for (const [x, y, r] of [[290, 240, 46], [340, 222, 56], [390, 246, 42]] as [number, number, number][]) p.ell(x, y, r - 6, r * 0.8 - 6, "#dde6f2", 0);
  } else if (icon === "knee") {
    p.line([[190, 110], [262, 216], [212, 320]], "#f5d6be", 54);
    p.poly(rrect(222, 178, 304, 214, 12, 6).map(([x, y]) => [x, y] as P2), "#f6e0b8", 7);
    p.stroke([[244, 182], [244, 210]], 4, "#c9a070"); p.stroke([[282, 182], [282, 210]], 4, "#c9a070");
    for (const [x, y] of [[320, 140], [338, 166], [300, 124]]) p.stroke([[x, y], [x + 18, y - 18]], 7, "#e2563f");
  } else if (icon === "kids") {
    for (const [x, c, h] of [[200, "#f5c9a0", "#3a2a22"], [320, "#f5d6be", "#e0b050"]] as [number, string, string][]) {
      p.ell(x, 200, 62, 60, c, 10); p.ell(x, 160, 64, 30, h, 9, 180, 360);
      p.dot(x - 20, 200, 9); p.dot(x + 20, 200, 9); p.arc(x, 222, 20, 14, 20, 160, 7);
    }
  } else if (icon === "cat") catFace(p, 262, 205, 1.05);
  else if (icon === "meat") {
    p.ell(262, 250, 130, 40, "#f4f1ea", 9);
    for (const [x, y] of [[210, 215], [262, 205], [314, 215], [236, 180], [290, 180]] as P2[]) { p.ell(x, y, 34, 32, "#8a4a2a", 8); p.ell(x - 10, y - 10, 9, 7, "#b8703a", 0); }
    p.ell(345, 240, 26, 14, "#d8433e", 7);
  } else if (icon === "dark") {
    p.poly(rrect(160, 100, 364, 300, 12), "#1b2448", 9);
    p.ell(300, 150, 30, 30, "#fff6d8", 0); p.ell(314, 140, 26, 26, "#1b2448", 0);
    for (const [x, y] of [[190, 130], [230, 180], [200, 240], [330, 230], [270, 270], [250, 125]] as P2[]) p.dot(x, y, 5, "#fff6d8");
    p.stroke([[262, 100], [262, 300]], 8, "#f6f1e4"); p.stroke([[160, 200], [364, 200]], 8, "#f6f1e4");
  } else if (icon === "equal") {
    for (const [x, c] of [[200, "#f272b0"], [324, "#5a8fc2"]] as [number, string][]) { p.ell(x, 160, 34, 34, c, 8); p.poly([[x - 40, 280], [x - 30, 205], [x + 30, 205], [x + 40, 280]], c, 8); }
    p.stroke([[248, 205], [276, 205]], 10); p.stroke([[248, 225], [276, 225]], 10);
  } else if (icon === "film") {
    p.poly(rrect(150, 130, 374, 280, 10), "#2b2b33", 9);
    for (let x = 166; x < 370; x += 30) { p.poly(rrect(x, 140, x + 16, 154, 3), "#f6f1e4", 0); p.poly(rrect(x, 256, x + 16, 270, 3), "#f6f1e4", 0); }
    p.poly(rrect(176, 166, 348, 244, 6), "#f6d24a", 6); txt(p, "THE END", 262, 206, 34, "#2b2230");
  }
  else if (icon === "face" && o) {
    p.clip(ellPts(262, 205, 150, 118), () => {
      g.save(); g.translate(262, 30); g.scale(0.62, 0.62); g.translate(-300, 0);
      bodyFront(p, o, { mode: "stand", expr: "smile", blink: 0, facing: 0, seed: 5, light: rad(-120) });
      g.restore();
    });
  }
  g.restore();
};
/** the map poster, 600 x 760: the Netherlands (rough outline) on a blue sea, n warm dots popping in */
const NL: P2[] = [[250, 120], [330, 96], [420, 84], [470, 120], [462, 200], [492, 262], [470, 330], [420, 360], [452, 430], [440, 520],
  [400, 560], [372, 640], [300, 668], [280, 610], [210, 600], [150, 560], [96, 590], [70, 540], [130, 480], [180, 420], [200, 330], [222, 240], [210, 170]];
const inPoly = (x: number, y: number, P: P2[]) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
  const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const DOTS: P2[] = (() => { const out: P2[] = []; let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  while (out.length < 220) { const x = 80 + r() * 420, y = 90 + r() * 580; if (inPoly(x, y, NL)) out.push([x, y]); } return out; })();
export const fxMap = (p: Pen, n: number) => {
  const g = p.g;
  p.poly(rrect(10, 10, 590, 750, 18), "#f4ead6", 12);
  p.poly(rrect(36, 36, 564, 724, 8), "#9fc8e6", 6);
  p.poly(NL, "#a8d18a", 10);
  p.poly([[300, 300], [380, 260], [420, 330], [340, 380]], "#8cc0e0", 0); // the IJsselmeer
  for (let i = 0; i < Math.min(n, DOTS.length); i++) { const [x, y] = DOTS[i]; p.ell(x, y, 9, 9, i === 0 ? "#e2563f" : "#f2c94c", 4); }
  if (n > 0) { p.ell(DOTS[0][0], DOTS[0][1], 15, 15, "#e2563f", 5); }
  g.globalAlpha = 1;
};
/** roll-down shutter over the shop window, 800 x 300 canvas, k = 0 (open) .. 1 (closed) */
export const fxShutter = (p: Pen, k: number) => {
  const g = p.g, h = Math.round(280 * k);
  p.poly(rrect(0, 0, 800, 22, 4), "#6b6f7a", 6);
  if (h < 4) return;
  g.fillStyle = "#9aa0aa"; g.fillRect(8, 20, 784, h);
  for (let y = 26; y < 20 + h; y += 14) { g.fillStyle = "rgba(40,40,60,0.28)"; g.fillRect(8, y, 784, 3); g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(8, y + 4, 784, 2); }
  p.poly([[8, 20 + h - 12], [792, 20 + h - 12], [792, 20 + h], [8, 20 + h]], "#5a5f68", 5);
  p.poly([[8, 20], [792, 20], [792, 20 + h], [8, 20 + h]], null, 6);
};
/** a shopping trolley piled high, side view facing screen-right, 600 x 520 (wheels at y 500) */
export const fxTrolley = (p: Pen) => {
  const g = p.g;
  for (const [x, y, k] of [[150, 150, 3], [220, 120, 1], [290, 140, 5], [360, 112, 0], [420, 150, 2], [250, 70, 4], [340, 60, 1]] as [number, number, number][]) {
    g.save(); g.translate(x - 70, y - 70); g.scale(0.7, 0.7); fxItem(p, k); g.restore();
  }
  p.poly([[90, 200], [520, 200], [480, 400], [140, 400]], "rgba(200,206,214,0.55)", 0);
  for (let x = 110; x < 510; x += 34) p.stroke([[x, 200], [x - (x - 300) * 0.08, 400]], 5, "#7a808c");
  for (let y = 240; y < 400; y += 40) p.stroke([[90 + (y - 200) * 0.25, y], [520 - (y - 200) * 0.2, y]], 5, "#7a808c");
  p.poly([[90, 200], [520, 200], [480, 400], [140, 400]], null, 10);
  p.stroke([[90, 200], [40, 150], [10, 150]], 12, "#3d414c");
  p.stroke([[140, 400], [150, 470], [470, 470], [480, 400]], 10, "#3d414c");
  for (const x of [170, 440]) { p.ell(x, 488, 18, 18, "#2b2b33", 6); }
};


// ======================= "The Minister for Loneliness" additions =======================
const boardFrame = (p: Pen, fill: string, dark = false) => {
  p.poly(rrect(10, 10, 790, 490, 18), dark ? "#1c1a22" : "#d9dde2", 12);
  p.poly(rrect(36, 36, 764, 464, 8), fill, 5);
  if (!dark) { p.poly(rrect(300, 470, 500, 490, 6), "#9aa0aa", 6); }
};
const cig = (p: Pen, x: number, y: number) => {
  p.poly(rrect(x, y, x + 54, y + 15, 6), "#f4f1ea", 5); p.poly(rrect(x, y, x + 16, y + 15, 5), "#e2a04a", 5); p.ell(x + 56, y + 7, 5, 6, "#e2563f", 0);
  p.stroke([[x + 61, y], [x + 68, y - 12], [x + 63, y - 22]], 4, "#b8bcc4");
};
/** the minister's wall board, 800 x 500: report (bars + count), health (heart + n cigarettes), plan (n ticks),
 *  call (video call with the other minister waving), map (two dots, a line; k = the big grey cloud) */
export const fxBoard = (p: Pen, kind: "report" | "health" | "plan" | "call" | "map", k: number, o?: Outfit, wave = 0, blink = 0) => {
  const g = p.g;
  if (kind === "report") {
    boardFrame(p, "#fbfbf6");
    const h = [60, 90, 120, 170, 230, 300].map((v) => v * Math.min(1, k * 1.4));
    h.forEach((v, i) => p.poly([[70 + i * 54, 440], [108 + i * 54, 440], [108 + i * 54, 440 - v], [70 + i * 54, 440 - v]], i === 5 ? "#e2563f" : "#5a8fc2", 6));
    const n = Math.round(9000000 * k).toLocaleString("en-US");
    txt(p, n, 575, 190, 66, "#1f2a44", 0);
    // a little sad face under the number
    p.ell(600, 320, 60, 60, "#f6d24a", 8); p.dot(580, 305, 8); p.dot(620, 305, 8); p.arc(600, 350, 26, 16, 200, 340, 7);
  } else if (kind === "health") {
    boardFrame(p, "#fbfbf6");
    p.poly([[160, 360], [70, 260], [80, 170], [140, 150], [160, 200], [180, 150], [240, 170], [250, 260]], "#e2563f", 10);
    txt(p, "=", 300, 250, 110, "#1f2a44");
    for (let i = 0; i < Math.min(15, k); i++) cig(p, 362 + (i % 5) * 78, 140 + Math.floor(i / 5) * 90);
    if (k >= 15) txt(p, "x15", 520, 440, 52, "#e2563f", 10);
  } else if (kind === "plan") {
    boardFrame(p, "#fbfbf6");
    txt(p, "PLAN", 400, 120, 110, "#3f6fb5", 0);
    for (let i = 0; i < 3; i++) {
      const y = 230 + i * 80; p.poly(rrect(170, y - 26, 222, y + 26, 8), "#ffffff", 7);
      if (i < k) p.stroke([[180, y], [196, y + 16], [226, y - 24]], 11, "#2f8f5a");
      p.stroke([[260, y], [620 - i * 60, y]], 10, "#9aa0aa");
    }
  } else if (kind === "call") {
    boardFrame(p, "#3b4a7a", true);
    g.save(); p.clip(rrect(36, 36, 764, 464, 8), () => {
      const gr = g.createLinearGradient(0, 36, 0, 464); gr.addColorStop(0, "#f2c89a"); gr.addColorStop(1, "#d9a07a"); g.fillStyle = gr; g.fillRect(36, 36, 728, 428);
      g.fillStyle = "#f6ecd2"; for (let x = 60; x < 760; x += 90) g.fillRect(x, 50, 8, 260); g.fillRect(36, 120, 728, 6); g.fillRect(36, 220, 728, 6);
      if (o) { g.save(); g.translate(400, 60); g.scale(0.62, 0.62); g.translate(-300, 0); bodyFront(p, o, { mode: "stand", expr: "smile", blink, facing: 0, seed: 3, wave: wave || undefined, light: rad(-120) }); g.restore(); }
    }); g.restore();
    p.ell(720, 70, 12, 12, "#e2563f", 0); // live dot
    p.poly(rrect(560, 340, 750, 450, 10), "#2b2b33", 6); // self-view
  } else {
    boardFrame(p, "#9fc8e6");
    for (const [x, y, rx, ry] of [[170, 170, 90, 70], [210, 330, 60, 90], [420, 160, 110, 80], [450, 320, 70, 80], [640, 200, 100, 90], [680, 380, 50, 40]] as number[][]) p.ell(x, y, rx, ry, "#a8d18a", 7);
    const uk: P2 = [405, 150], jp: P2 = [705, 205];
    g.setLineDash([14, 12]); p.stroke([uk, [560, 70], jp], 6, "#e2563f"); g.setLineDash([]);
    p.ell(uk[0], uk[1], 16, 16, "#e2563f", 6); p.ell(jp[0], jp[1], 16, 16, "#e2563f", 6);
    if (k > 0) {
      g.save(); g.globalAlpha = Math.min(1, k * 1.2); g.translate(400, 270); g.scale(0.4 + 0.75 * k, 0.4 + 0.75 * k); g.translate(-400, -270);
      for (const [x, y, r] of [[300, 260, 120], [420, 220, 150], [540, 270, 120], [400, 320, 140]] as number[][]) p.ell(x, y, r, r * 0.8, "#8f97a8", 10);
      for (const [x, y, r] of [[300, 260, 120], [420, 220, 150], [540, 270, 120], [400, 320, 140]] as number[][]) p.ell(x, y, r - 8, r * 0.8 - 8, "#8f97a8", 0);
      p.dot(380, 250, 12); p.dot(460, 250, 12); p.arc(420, 310, 40, 22, 200, 340, 9);
      g.restore();
    }
  }
};
/** desk nameplate, 600 x 160: "MINISTER FOR" ... then the last word appears (k = 0..1) */
export const fxNameplate = (p: Pen, k: number) => {
  p.poly([[20, 40], [580, 40], [600, 150], [0, 150]], "#6b4a33", 10);
  p.poly(rrect(50, 52, 550, 140, 8), "#e8c88e", 6);
  txt(p, "MINISTER FOR", 300, 78, 34, "#2b2230", 0, 800);
  if (k > 0) { p.g.save(); p.g.globalAlpha = Math.min(1, k); txt(p, "LONELINESS", 300, 118, 42 * (0.8 + 0.2 * k), "#b8343a", 0); p.g.restore(); }
};
/** the report (a thick bound document), 300 x 220 */
export const fxReport = (p: Pen) => {
  p.poly(rrect(20, 40, 280, 200, 10), "#f4f1ea", 9); p.poly(rrect(20, 40, 280, 70, 8), "#3f6fb5", 9);
  for (const y of [100, 130, 160]) p.stroke([[50, y], [250, y]], 8, "#9aa0aa");
  p.poly(rrect(30, 200, 270, 214, 4), "#d9d4cc", 5);
};
/** a prescription pad, 400 x 500, with up to three activity icons: pan, boot, paintbrush */
export const fxPrescription = (p: Pen, n: number) => {
  const g = p.g;
  p.poly(rrect(20, 20, 380, 480, 14), "#fbfbf6", 10); p.poly(rrect(20, 20, 380, 80, 12), "#5a8fc2", 10);
  txt(p, "Rx", 80, 52, 46, "#ffffff", 0);
  for (let i = 0; i < 3; i++) {
    const y = 150 + i * 115;
    p.stroke([[190, y + 10], [340, y + 10]], 8, "#c9ccd2");
    if (i >= n) continue;
    if (i === 0) { p.ell(110, y + 10, 44, 34, "#3d414c", 8); p.stroke([[150, y + 6], [176, y - 10]], 12, "#6b4a33"); p.ell(110, y + 6, 20, 14, "#f6d24a", 5); }
    else if (i === 1) { p.poly([[80, y - 40], [120, y - 40], [124, y + 12], [170, y + 26], [170, y + 44], [76, y + 44]], "#8a5a34", 8); p.stroke([[78, y + 36], [170, y + 36]], 6, "#3d414c"); }
    else { p.stroke([[70, y + 40], [150, y - 30]], 14, "#c9774e"); p.poly([[146, y - 26], [168, y - 52], [176, y - 44], [158, y - 18]], "#c9ccd2", 6); p.ell(64, y + 46, 20, 14, "#f272b0", 6); }
  }
  g.globalAlpha = 1;
};


// ======================= "Call Sweden" additions =======================
/** a giant red rotary phone (front view), 600 x 520, shaking when it rings (ring 0..1 draws the ring lines) */
export const fxBigPhone = (p: Pen, ring: number) => {
  const g = p.g;
  p.poly([[110, 470], [490, 470], [440, 240], [160, 240]], "#d8433e", 12);
  p.ell(300, 360, 92, 92, "#f4f1ea", 9);
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 1.6 + 0.4; p.ell(300 + 66 * Math.cos(a), 360 + 66 * Math.sin(a), 15, 15, "#2b2230", 0); }
  p.ell(300, 360, 26, 26, "#d8433e", 7);
  // handset
  p.poly([[60, 210], [540, 210], [520, 160], [430, 140], [170, 140], [80, 160]], "#d8433e", 12);
  p.ell(110, 190, 62, 46, "#d8433e", 12); p.ell(490, 190, 62, 46, "#d8433e", 12);
  p.poly([[60, 210], [540, 210], [520, 160], [430, 140], [170, 140], [80, 160]], "#d8433e", 0);
  g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(180, 150, 220, 12);
  if (ring > 0) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const r = 70 + k * 40; g.beginPath(); g.arc(300 + s * 250, 160, r * 0.5, s < 0 ? Math.PI * 0.75 : -Math.PI * 0.25, s < 0 ? Math.PI * 1.25 : Math.PI * 0.25); g.strokeStyle = INK; g.lineWidth = 10; g.lineCap = "round"; g.stroke();
  }
};
/** the control-room board, 800 x 500: world map with n dots, a counter with a sun/moon, a page-a-day calendar */
export const fxSwBoard = (p: Pen, kind: "dots" | "count" | "calendar", n: number, moon = false) => {
  const g = p.g;
  p.poly(rrect(10, 10, 790, 490, 18), "#d9dde2", 12);
  if (kind === "dots") {
    p.poly(rrect(36, 36, 764, 464, 8), "#9fc8e6", 5);
    const land: number[][] = [[170, 170, 110, 80], [220, 340, 70, 100], [410, 160, 100, 70], [440, 320, 80, 90], [620, 190, 130, 90], [680, 380, 60, 45]];
    for (const [x, y, rx, ry] of land) p.ell(x, y, rx, ry, "#a8d18a", 7);
    let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const sw: P2 = [420, 110];
    for (let i = 0; i < Math.min(n, 186); i++) {
      const L = land[Math.floor(r() * land.length)], a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85;
      const x = L[0] + Math.cos(a) * L[2] * d, y = L[1] + Math.sin(a) * L[3] * d;
      if (i % 9 === 0) { g.setLineDash([6, 8]); p.stroke([[x, y], [(x + sw[0]) / 2, Math.min(y, sw[1]) - 50], sw], 3, "rgba(226,86,63,0.6)"); g.setLineDash([]); }
      p.ell(x, y, 7, 7, "#f2c94c", 3);
    }
    p.ell(sw[0], sw[1], 16, 16, "#3f6fb5", 6); p.ell(sw[0], sw[1], 6, 6, "#f6d24a", 0);
    txt(p, String(Math.min(n, 186)), 690, 430, 62, "#e2563f", 10);
  } else if (kind === "count") {
    p.poly(rrect(36, 36, 764, 464, 8), "#1c2a44", 5);
    txt(p, Math.round(n).toLocaleString("en-US"), 400, 220, 120, "#f6d24a", 0);
    for (let i = 0; i < 12; i++) { const on = i < (n / 200000) * 12; p.poly(rrect(110 + i * 50, 330, 146 + i * 50, 360, 6), on ? "#6aab4f" : "#3b4a6a", 0); }
    if (moon) { p.ell(400, 420, 26, 26, "#fff6d8", 0); p.ell(412, 412, 22, 22, "#1c2a44", 0); }
    else { p.ell(400, 420, 22, 22, "#f6d24a", 0); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.stroke([[400 + 30 * Math.cos(a), 420 + 30 * Math.sin(a)], [400 + 40 * Math.cos(a), 420 + 40 * Math.sin(a)]], 5, "#f6d24a"); } }
  } else {
    p.poly(rrect(36, 36, 764, 464, 8), "#f4ead6", 5);
    // a page-a-day calendar: rings, a red header, the day count, a few flying pages
    p.poly(rrect(250, 80, 550, 430, 16), "#ffffff", 10); p.poly(rrect(250, 80, 550, 160, 14), "#e2563f", 10);
    for (const x of [320, 400, 480]) p.ell(x, 80, 12, 22, "#9aa0aa", 6);
    txt(p, "DAY", 400, 122, 40, "#ffffff", 0);
    txt(p, String(Math.round(n)), 400, 300, 140, "#2b2230", 0);
    for (let k = 0; k < 3; k++) { const ph = (n * 0.37 + k * 0.33) % 1; if (n > 2 && n < 376) { g.save(); g.translate(560 + ph * 160, 140 - ph * 60); g.rotate(ph * 2 + k); p.poly(rrect(-50, -40, 50, 40, 6), "#ffffff", 6); g.restore(); } }
  }
};
/** wall clock, 300 x 300, hands at minute angle m (radians) and hour angle h */
export const fxClock = (p: Pen, m: number, h: number) => {
  p.ell(150, 150, 130, 130, "#f7f1e1", 12);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; p.dot(150 + 104 * Math.sin(a), 150 - 104 * Math.cos(a), 6); }
  p.stroke([[150, 150], [150 + 60 * Math.sin(h), 150 - 60 * Math.cos(h)]], 14);
  p.stroke([[150, 150], [150 + 96 * Math.sin(m), 150 - 96 * Math.cos(m)]], 9);
  p.dot(150, 150, 12, "#e2563f");
};
/** a speech bubble with a word, 520 x 320 */
export const fxSay = (p: Pen, word: string, pop = 1, col = "#e2563f") => {
  const g = p.g; g.save(); g.translate(260, 150); g.scale(pop, pop); g.translate(-260, -150);
  p.poly([[150, 230], [110, 300], [220, 240]], "#ffffff", 12); p.ell(260, 140, 230, 120, "#ffffff", 12); p.poly([[154, 226], [124, 286], [216, 236]], "#ffffff", 0);
  txt(p, word, 260, 146, 110, col, 12); g.restore();
};
/** a call timer on the phone, 400 x 160 */
export const fxTimer = (p: Pen, text: string) => {
  p.poly(rrect(10, 10, 390, 150, 30), "#2f8f5a", 10);
  p.ell(70, 80, 30, 30, "#ffffff", 0); p.poly([[56, 70], [84, 70], [84, 92], [56, 92]], "#2f8f5a", 0);
  txt(p, text, 235, 84, 78, "#ffffff", 0);
};


// ======================= "Population: One" additions =======================
/** the town sign, 720 x 360: town name + population number (+ a pink heart when `heart` > 0) */
export const fxPopSign = (p: Pen, n: number, heart = 0) => {
  const g = p.g;
  p.poly(rrect(20, 20, 700, 330, 26), "#2f7a4a", 12);
  g.strokeStyle = "#f6f1e4"; g.lineWidth = 6; g.strokeRect(46, 46, 628, 258);
  txt(p, "MONOWI", 360, 120, 96, "#f6f1e4", 0);
  txt(p, "POP.", 250, 236, 70, "#f6f1e4", 0);
  txt(p, String(n), 440, 236, 96, n === 1 ? "#f6d24a" : "#f6f1e4", 0);
  if (heart > 0) { g.save(); g.translate(610, 230); g.scale(heart, heart); p.poly([[0, 48], [-48, 0], [-42, -36], [-12, -40], [0, -18], [12, -40], [42, -36], [48, 0]], "#f272b0", 8); g.restore(); }
};
/** small icon cards, 300 x 300: a shop with CLOSED, a school, a suitcase */
export const fxIcon = (p: Pen, kind: "closed" | "school" | "suitcase") => {
  if (kind === "closed") {
    p.poly(rrect(40, 90, 260, 270, 10), "#d9a05a", 9); p.poly([[30, 90], [270, 90], [250, 50], [50, 50]], "#e2563f", 9);
    p.poly(rrect(60, 140, 240, 200, 8), "#ffffff", 7); txt(p, "CLOSED", 150, 171, 34, "#e2563f");
  } else if (kind === "school") {
    p.poly(rrect(50, 130, 250, 270, 8), "#c25a5a", 9); p.poly([[40, 130], [150, 60], [260, 130]], "#8a3a3a", 9);
    p.ell(150, 110, 16, 16, "#f6d24a", 6); p.poly(rrect(125, 200, 175, 270, 6), "#5a3b2a", 6);
    for (const x of [80, 220]) p.poly(rrect(x - 18, 160, x + 18, 196, 4), "#9fc8e6", 5);
  } else {
    p.poly(rrect(50, 110, 250, 260, 16), "#8a5a34", 9); p.poly(rrect(110, 70, 190, 112, 10), null, 9);
    p.stroke([[50, 160], [250, 160]], 7); p.poly(rrect(70, 180, 120, 230, 6), "#f6d24a", 5);
  }
};
/** a title badge, 520 x 180: a star + the word */
export const fxBadge = (p: Pen, word: string, col: string) => {
  p.poly(rrect(14, 30, 506, 150, 60), col, 10);
  p.ell(84, 90, 46, 46, "#ffffff", 7); p.poly([[84, 60], [94, 82], [118, 84], [100, 99], [106, 122], [84, 110], [62, 122], [68, 99], [50, 84], [74, 82]], "#f6d24a", 4);
  txt(p, word, 300, 94, word.length > 8 ? 52 : 64, "#ffffff", 10);
};
/** the liquor licence, 600 x 760: header, lines, the stamp (0..1 lands) and the signature (0..1 draws) */
export const fxLicence = (p: Pen, stamp: number, sign: number) => {
  const g = p.g;
  p.poly(rrect(20, 20, 580, 740, 16), "#fbf6e6", 12);
  p.poly(rrect(44, 44, 556, 716, 10), null, 5);
  txt(p, "LIQUOR", 300, 120, 74, "#2f5f5a", 0); txt(p, "LICENCE", 300, 196, 74, "#2f5f5a", 0);
  txt(p, "VILLAGE OF MONOWI", 300, 262, 30, "#5a3b2a", 0, 800);
  for (const y of [330, 380, 430]) p.stroke([[90, y], [510, y]], 6, "#c9ccd2");
  p.stroke([[300, 640], [520, 640]], 6, "#5a3b2a");
  if (stamp > 0) {
    g.save(); g.translate(170, 580); g.rotate(-0.25); const k = 1 + 0.6 * (1 - stamp); g.scale(k, k); g.globalAlpha = Math.min(1, stamp * 1.5);
    g.strokeStyle = "#d8433e"; g.lineWidth = 12; g.beginPath(); g.arc(0, 0, 96, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 76, 0, 7); g.lineWidth = 5; g.stroke();
    g.font = "900 38px Montserrat, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#d8433e"; g.fillText("MAYOR", 0, -14);
    g.font = "800 26px Montserrat, Arial, sans-serif"; g.fillText("APPROVED", 0, 26);
    g.restore();
  }
  if (sign > 0) {
    const pts: P2[] = []; const n = Math.max(2, Math.round(60 * sign));
    for (let i = 0; i < n; i++) { const u = i / 59; pts.push([310 + 200 * u, 612 + 22 * Math.sin(u * 18) - 14 * Math.sin(u * 5)]); }
    p.stroke(pts, 7, "#1f2a8a");
  }
};
/** a ballot box with one paper falling in (drop 0..1) and a WIN rosette (ribbon 0..1), 500 x 520 */
export const fxBallot = (p: Pen, drop: number, ribbon: number) => {
  const g = p.g;
  if (drop < 1) { const y = 30 + 200 * drop; p.poly(rrect(200, y, 300, y + 120, 8), "#ffffff", 7); p.stroke([[225, y + 60], [245, y + 80], [278, y + 40]], 9, "#2f8f5a"); }
  p.poly(rrect(90, 230, 410, 500, 14), "#5a8fc2", 11); p.poly(rrect(170, 222, 330, 242, 6), "#1c2a44", 6);
  txt(p, "VOTE", 250, 370, 80, "#ffffff", 10);
  if (ribbon > 0) {
    g.save(); g.translate(250, 140); g.scale(ribbon, ribbon);
    p.poly([[-60, 40], [-90, 140], [-50, 120], [-30, 150], [-10, 50]], "#d8433e", 7); p.poly([[60, 40], [90, 140], [50, 120], [30, 150], [10, 50]], "#d8433e", 7);
    p.ell(0, 0, 80, 80, "#f6d24a", 10); txt(p, "WIN", 0, 4, 54, "#d8433e", 0);
    g.restore();
  }
};
/** a framed photo (a portrait of `o`), 300 x 380 */
export const fxPortrait = (p: Pen, o: Outfit) => {
  const g = p.g;
  p.poly(rrect(10, 10, 290, 370, 12), "#c9a24e", 12);
  p.clip(rrect(40, 40, 260, 340, 6), () => {
    const gr = g.createLinearGradient(0, 40, 0, 340); gr.addColorStop(0, "#e6d6b4"); gr.addColorStop(1, "#c9b48f"); g.fillStyle = gr; g.fillRect(0, 0, 300, 380);
    g.save(); g.translate(150, 40); g.scale(0.62, 0.62); g.translate(-300, 0);
    bodyFront(p, o, { mode: "stand", expr: "smile", blink: 0, facing: 0, seed: 2, light: rad(-120) }); g.restore();
  });
  p.poly(rrect(40, 40, 260, 340, 6), null, 6);
};
/** a hanging OPEN sign, 400 x 220 (k = pop) */
export const fxOpen = (p: Pen, k: number) => {
  const g = p.g; g.save(); g.translate(200, 40); g.scale(k, k); g.translate(-200, -40);
  p.stroke([[120, 0], [90, 60]], 6, "#5a3b2a"); p.stroke([[280, 0], [310, 60]], 6, "#5a3b2a");
  p.poly(rrect(40, 60, 360, 200, 20), "#f6d24a", 10); txt(p, "OPEN", 200, 132, 92, "#d8433e", 0); g.restore();
};
/** the tavern's sign, 760 x 240: dark or lit */
export const fxNeon = (p: Pen, lit: boolean) => {
  p.poly(rrect(14, 14, 746, 226, 30), "#2b2230", 10);
  txt(p, "TAVERN", 380, 124, 130, lit ? "#ffd27a" : "#6b5a4a", 0);
};
/** a mileage tag, 300 x 140 */
export const fxMiles = (p: Pen, text: string) => { p.poly(rrect(10, 20, 290, 120, 40), "#2f7a4a", 9); txt(p, text, 150, 72, 60, "#ffffff", 0); };


// ======================= "Illegal to Be Lonely" additions =======================
export type PigLook = { fur: string; patch?: string; expr?: "happy" | "sad" | "tired" | "shock" | "grin" | "love"; old?: boolean; hop?: number; alpha?: number; mirror?: boolean };
/** a guinea pig seen from the front-side, 400 x 300 (soles at y 270): round body, little ears, dot eyes, a pink nose;
 *  old = round glasses + white whiskers; hop lifts it with a squash; alpha fades it (gentle "goes") */
export const fxPig = (p: Pen, o: PigLook) => {
  const g = p.g, e = o.expr ?? "happy", hop = o.hop ?? 0;
  g.save(); g.globalAlpha = o.alpha ?? 1;
  if (o.mirror) { g.translate(400, 0); g.scale(-1, 1); }
  g.translate(0, -60 * hop); const sq = 1 - 0.08 * hop; g.translate(200, 270); g.scale(1 / sq, sq); g.translate(-200, -270);
  p.ell(200, 266, 120, 14, "rgba(36,23,38,0.18)", 0);
  for (const x of [130, 170, 240, 275]) p.ell(x, 262, 16, 10, "#f0b8a8", 5);
  p.ell(200, 190, 150, 82, o.fur, 9);
  if (o.patch) { p.clip([[60, 100], [190, 100], [170, 280], [60, 280]], () => p.ell(200, 190, 146, 78, o.patch!, 0)); p.ell(200, 190, 150, 82, null, 9); }
  // head on the right
  p.ell(285, 168, 70, 62, o.patch ? o.fur : o.fur, 9);
  p.ell(250, 112, 22, 16, "#f0b8a8", 6); p.ell(318, 114, 22, 16, "#f0b8a8", 6);
  const ey = 160;
  if (e === "tired") { for (const x of [268, 312]) p.stroke([[x - 12, ey], [x + 12, ey]], 7); }
  else if (e === "love") { for (const x of [268, 312]) p.poly([[x, ey + 10], [x - 10, ey], [x - 8, ey - 8], [x, ey - 4], [x + 8, ey - 8], [x + 10, ey]], "#f272b0", 3); }
  else if (e === "shock") { for (const x of [268, 312]) p.ell(x, ey, 9, 12, "#ffffff", 5); }
  else if (e === "grin" || e === "happy") { for (const x of [268, 312]) p.arc(x, ey + 4, 10, 8, 200, 340, 6); }
  else for (const x of [268, 312]) p.dot(x, ey, 7);
  if (e === "sad") { p.stroke([[256, 140], [276, 148]], 5); p.stroke([[324, 140], [304, 148]], 5); }
  p.ell(292, 188, 11, 8, "#f272b0", 4);
  if (e === "grin" || e === "love") p.arc(292, 200, 16, 12, 20, 160, 6); else if (e === "sad" || e === "tired") p.arc(292, 214, 12, 8, 200, 340, 5); else if (e === "shock") p.ell(292, 210, 8, 10, "#5a2a30", 4); else p.arc(292, 200, 10, 7, 20, 160, 5);
  if (o.old) { for (const x of [268, 312]) p.ell(x, ey, 18, 18, null, 5); p.stroke([[286, ey], [294, ey]], 5);
    for (const d of [-1, 1]) for (const k of [0, 1, 2]) p.stroke([[292 + d * 14, 192 + k * 6], [292 + d * 56, 184 + k * 12]], 4, "#f4f1ea"); }
  g.restore();
};
/** a red rubber stamp, 600 x 260 (k lands it: big + faint -> sharp) */
export const fxStamp = (p: Pen, word: string, k: number) => {
  const g = p.g; g.save(); g.translate(300, 130); g.rotate(-0.18); const s0 = 1 + 0.7 * (1 - k); g.scale(s0, s0); g.globalAlpha = Math.min(1, 0.3 + k);
  g.strokeStyle = "#d8433e"; g.lineWidth = 16; g.strokeRect(-250, -90, 500, 180); g.lineWidth = 6; g.strokeRect(-232, -72, 464, 144);
  g.font = "900 120px Montserrat, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#d8433e"; g.fillText(word, 0, 6, 440); g.restore();
};
/** a framed Swiss-style flag (red square, white cross), 300 x 300; t waves the cloth */
export const fxFlagCH = (p: Pen, t = 0) => {
  const g = p.g; const w = (x: number) => 6 * Math.sin(x / 40 + t * 6);
  g.fillStyle = "#d8433e"; g.beginPath(); g.moveTo(30, 30 + w(30)); for (let x = 30; x <= 270; x += 10) g.lineTo(x, 30 + w(x)); for (let x = 270; x >= 30; x -= 10) g.lineTo(x, 270 + w(x)); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 9; g.stroke();
  g.fillStyle = "#ffffff"; g.fillRect(126, 80 + w(150), 48, 140); g.fillRect(80, 126 + w(150), 140, 48);
};
/** the law book, 420 x 360: a red book with a paragraph sign and the year */
export const fxLaw = (p: Pen) => {
  p.poly(rrect(40, 30, 380, 330, 18), "#b8283c", 11); p.poly(rrect(60, 30, 84, 330, 4), "#8a1e2c", 0);
  txt(p, "§", 230, 140, 130, "#f6d24a", 0); txt(p, "LAW 2008", 230, 260, 52, "#ffffff", 0);
};
/** circular arrows, 500 x 500, rotating with t; small coins around */
export const fxCycle = (p: Pen, t: number) => {
  const g = p.g; g.save(); g.translate(250, 250); g.rotate(t * Math.PI * 2);
  for (let i = 0; i < 2; i++) { g.rotate(Math.PI); g.lineWidth = 34; g.strokeStyle = INK; g.beginPath(); g.arc(0, 0, 170, 0.15, Math.PI - 0.35); g.stroke();
    g.lineWidth = 22; g.strokeStyle = "#f272b0"; g.beginPath(); g.arc(0, 0, 170, 0.15, Math.PI - 0.35); g.stroke();
    const a = Math.PI - 0.35, x = 170 * Math.cos(a), y = 170 * Math.sin(a);
    p.poly([[x - 40, y - 10], [x + 30, y - 30], [x + 10, y + 40]], "#f272b0", 7); }
  g.restore();
  txt(p, "$", 250, 252, 120, "#2f8f5a", 10);
};
/** a little suitcase with a guinea pig peeking out, 360 x 300 */
export const fxSuitcase = (p: Pen, fur: string) => {
  p.poly(rrect(140, 40, 220, 80, 14), null, 9);
  p.ell(180, 92, 70, 52, fur, 8); p.ell(158, 50, 14, 10, "#f0b8a8", 5); p.ell(204, 50, 14, 10, "#f0b8a8", 5);
  for (const x of [160, 200]) p.arc(x, 90, 8, 6, 200, 340, 5); p.ell(180, 108, 8, 6, "#f272b0", 3);
  p.poly(rrect(40, 110, 320, 280, 20), "#c9774e", 10); p.stroke([[40, 170], [320, 170]], 7); p.poly(rrect(160, 154, 200, 186, 6), "#f6d24a", 5);
};
/** the wooden rental sign, 900 x 300 */
export const fxRentSign = (p: Pen) => {
  p.stroke([[150, 0], [150, 60]], 10, "#5a3b2a"); p.stroke([[750, 0], [750, 60]], 10, "#5a3b2a");
  p.poly(rrect(20, 50, 880, 280, 30), "#c9a06a", 11); p.poly(rrect(44, 72, 856, 258, 20), null, 5);
  txt(p, "RENT-A-", 450, 120, 66, "#5a3b2a", 0); txt(p, "GUINEA-PIG", 450, 205, 92, "#d8433e", 0);
};

// ======================= "No One to Save" additions =======================
/** sobs from a window, 400 x 300: wavy lines and falling tears (t animates) */
export const fxSob = (p: Pen, t: number) => {
  for (const [x0, s] of [[110, -1], [290, 1]] as [number, number][]) for (let k = 0; k < 3; k++) {
    const pts: P2[] = []; for (let i = 0; i <= 10; i++) pts.push([x0 + s * (i * 7 + k * 26), 150 - k * 40 + 10 * Math.sin(i * 1.1 + t * 8 + k)]); p.stroke(pts, 9, "#5a8fc2");
  }
  for (let k = 0; k < 4; k++) { const y = 120 + ((t * 220 + k * 70) % 170), x = 160 + k * 26; p.poly([[x, y - 22], [x - 12, y + 4], [x, y + 14], [x + 12, y + 4]], "#9fc8e6", 5); }
};
/** a crossed-out word badge, 520 x 180 (strike 0..1 draws the red X) */
export const fxNope = (p: Pen, word: string, strike: number) => {
  p.poly(rrect(14, 30, 506, 150, 60), "#3a3d47", 10); txt(p, word, 260, 94, word.length > 7 ? 60 : 72, "#ffffff", 10);
  if (strike > 0) { const k = Math.min(1, strike * 2), k2 = Math.max(0, strike * 2 - 1);
    p.stroke([[60, 40], [60 + 400 * k, 40 + 100 * k]], 18, "#e2563f"); if (k2 > 0) p.stroke([[460, 40], [460 - 400 * k2, 40 + 100 * k2]], 18, "#e2563f"); }
};
/** an old TV, 420 x 360: a grey storm cloud with rain on the screen (t animates) */
export const fxTV = (p: Pen, t: number) => {
  const g = p.g;
  p.poly(rrect(20, 20, 400, 300, 26), "#6b4a33", 11);
  p.clip(rrect(50, 50, 370, 270, 18), () => {
    g.fillStyle = "#4a5568"; g.fillRect(0, 0, 420, 360);
    for (let i = 0; i < 14; i++) { const x = 70 + ((i * 53) % 290), y = 150 + ((t * 300 + i * 37) % 120); p.stroke([[x, y], [x - 8, y + 22]], 5, "#9fc8e6"); }
    p.ell(170, 120, 70, 44, "#2f3540", 7); p.ell(240, 110, 80, 52, "#2f3540", 7); p.ell(290, 135, 56, 36, "#2f3540", 7);
    p.poly([[230, 150], [205, 200], [228, 200], [210, 245], [262, 185], [238, 185], [255, 150]], "#f6d24a", 6);
  });
  p.stroke([[150, 300], [120, 345]], 9); p.stroke([[270, 300], [300, 345]], 9);
};
/** a wall calendar page, 300 x 360 */
export const fxCalendar = (p: Pen, month: string) => {
  p.poly(rrect(14, 30, 286, 346, 10), "#fbf6e6", 9);
  p.poly(rrect(14, 30, 286, 110, 10), "#d8433e", 9); txt(p, month, 150, 72, 50, "#ffffff", 0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) p.poly(rrect(40 + c * 46, 130 + r * 52, 74 + c * 46, 166 + r * 52, 4), r === 1 && c === 2 ? "#f6d24a" : "#e9e4d8", 3);
  p.dot(110, 30, 12, "#5a3b2a"); p.dot(190, 30, 12, "#5a3b2a");
};
/** a small bowl with a few grapes, 360 x 260 */
export const fxGrapes = (p: Pen) => {
  p.poly([[40, 140], [320, 140], [280, 230], [80, 230]], "#e9e4d8", 9);
  for (const [x, y] of [[150, 112], [180, 100], [205, 118], [170, 128]] as [number, number][]) p.ell(x, y, 20, 20, "#7b5ac9", 6);
  p.stroke([[182, 82], [188, 60]], 7, "#5a3b2a"); p.ell(204, 66, 18, 9, "#6aab4f", 5);
};
/** a cooking pot with steam, 400 x 400 (t animates the steam; noodles = spaghetti in the pot) */
export const fxPot = (p: Pen, t: number, noodles: boolean) => {
  for (let k = 0; k < 3; k++) { const pts: P2[] = []; for (let i = 0; i <= 12; i++) pts.push([130 + k * 70 + 14 * Math.sin(i * 0.8 + t * 7 + k * 2), 190 - i * 14]); p.stroke(pts, 9, "#f4f1ea"); }
  p.poly(rrect(70, 200, 330, 360, 22), "#9aa0aa", 11);
  p.ell(200, 206, 132, 26, noodles ? "#f2c94c" : "#5a5d66", 9);
  if (noodles) for (let i = 0; i < 6; i++) p.arc(150 + i * 20, 204, 22, 10, 200, 340, 5);
  p.stroke([[70, 240], [24, 230]], 14); p.stroke([[330, 240], [376, 230]], 14);
};
/** food icons, 300 x 300: a butter block or a wedge of parmesan */
export const fxFood = (p: Pen, kind: "butter" | "cheese") => {
  if (kind === "butter") { p.poly(rrect(40, 170, 260, 250, 12), "#e9e4d8", 8); p.poly([[70, 110], [230, 110], [250, 180], [50, 180]], "#f6e27a", 9); p.poly([[50, 180], [250, 180], [250, 220], [50, 220]], "#f2d24a", 9); }
  else { p.poly([[40, 230], [260, 230], [260, 150], [40, 90]], "#f6d98a", 9); p.poly([[40, 90], [260, 150], [230, 120], [70, 70]], "#fbe9b0", 8);
    for (const [x, y, r] of [[110, 170, 14], [190, 195, 10], [220, 175, 8]] as [number, number, number][]) p.ell(x, y, r, r, "#e8c46a", 4); }
};
/** a plate of spaghetti, 320 x 200 */
export const fxPlate = (p: Pen) => {
  p.ell(160, 120, 140, 56, "#fbf6e6", 9); p.ell(160, 112, 92, 34, "#f2c94c", 7);
  for (let i = 0; i < 5; i++) p.arc(120 + i * 20, 110, 24, 12, 200, 340, 5);
  p.ell(160, 98, 30, 12, "#fff6d8", 0);
};
/** the police note, 600 x 520: line 1 (k1) "No one to save." line 2 (k2) "Two lonely souls" + a heart */
export const fxStatement = (p: Pen, k1: number, k2: number) => {
  p.poly(rrect(20, 20, 580, 500, 16), "#fbf6e6", 11);
  p.poly(rrect(20, 20, 580, 96, 16), "#22304f", 11); txt(p, "POLICE NOTE", 300, 60, 46, "#ffffff", 0);
  if (k1 > 0) txt(p, "No one to save.", 300, 190, 56, "#22304f", 0);
  if (k2 > 0) { txt(p, "Two lonely souls", 300, 300, 56, "#22304f", 0); txt(p, "to reassure.", 300, 370, 56, "#22304f", 0);
    p.g.save(); p.g.translate(300, 448); p.g.scale(k2, k2); p.poly([[0, 34], [-36, 0], [-32, -26], [-10, -30], [0, -14], [10, -30], [32, -26], [36, 0]], "#f272b0", 7); p.g.restore(); }
};
/** a wide banner, 900 x 200 */
export const fxBanner = (p: Pen, text: string, col = "#22304f") => {
  p.poly(rrect(14, 30, 886, 170, 70), col, 11);
  p.poly([[90, 100], [74, 80], [90, 60], [106, 80]], "#f272b0", 5); p.poly([[810, 100], [794, 80], [810, 60], [826, 80]], "#f272b0", 5);
  txt(p, text, 450, 104, 70, "#ffffff", 10);
};

// ======================= "100 Cards" additions =======================
/** Joe's hand-lettered posterboard, 640 x 440; ring 0..1 draws a red marker circle around the 100 */
export const fxHandSign = (p: Pen, ring: number) => {
  const g = p.g;
  p.poly(rrect(14, 14, 626, 426, 10), "#fbfaf4", 10);
  const hand = (t: string, x: number, y: number, px: number, c: string) => { g.font = `800 ${px}px "Comic Sans MS", "Marker Felt", Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = c; g.fillText(t, x, y, 560); };
  hand("I'M TURNING", 320, 74, 44, "#1f2a8a");
  hand("100", 320, 178, 150, "#d8433e");
  hand("PLEASE SEND ME", 320, 284, 42, "#1f2a8a");
  hand("100 BIRTHDAY CARDS", 320, 352, 46, "#1f2a8a");
  if (ring > 0) { const pts: P2[] = []; const n = Math.max(2, Math.round(48 * ring));
    for (let i = 0; i < n; i++) { const a = -2.4 + (i / 47) * Math.PI * 2.15; pts.push([320 + 150 * Math.cos(a), 176 + 72 * Math.sin(a)]); }
    p.stroke(pts, 9, "#d8433e"); }
};
/** one envelope, 300 x 200 (stamp colour by seed); glow adds a gold rim */
export const fxEnvelope = (p: Pen, seed = 0, glow = false) => {
  const cols = ["#fbf6e6", "#f7d9e6", "#dbe8f7", "#fff1c9", "#e2f2dc"];
  if (glow) p.poly(rrect(4, 4, 296, 196, 22), "#ffe27a", 0);
  p.poly(rrect(20, 24, 280, 176, 10), cols[seed % cols.length], 8);
  p.stroke([[28, 32], [150, 112], [272, 32]], 7);
  p.poly(rrect(214, 38, 262, 88, 4), ["#d8433e", "#3f6fb5", "#2f8f5a", "#f272b0"][seed % 4], 5);
};
/** a heap of envelopes, 400 x 300 (n envelopes, deterministic by seed) */
export const fxPile = (p: Pen, seed: number, n = 14) => {
  const g = p.g, cols = ["#fbf6e6", "#f7d9e6", "#dbe8f7", "#fff1c9", "#e2f2dc", "#f4e1c8"];
  const r = (i: number) => { const v = Math.sin(i * 91.7 + seed * 37.3) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < n; i++) {
    const row = Math.floor((i / n) * 5), w = 120, h = 80, x = 200 + (r(i) - 0.5) * (300 - row * 50), y = 250 - row * 46 - r(i + 7) * 14;
    g.save(); g.translate(x, y); g.rotate((r(i + 3) - 0.5) * 0.9);
    p.poly(rrect(-w / 2, -h / 2, w / 2, h / 2, 6), cols[(i + seed) % cols.length], 5);
    p.stroke([[-w / 2 + 6, -h / 2 + 6], [0, 4], [w / 2 - 6, -h / 2 + 6]], 4);
    if (r(i + 11) < 0.6) p.poly(rrect(w / 2 - 30, -h / 2 + 8, w / 2 - 10, -h / 2 + 30, 2), ["#d8433e", "#3f6fb5", "#2f8f5a", "#f272b0"][i % 4], 3);
    g.restore();
  }
};
/** a counter pill, 640 x 220: an envelope + the number */
export const fxCounter = (p: Pen, text: string, col = "#d8433e") => {
  p.poly(rrect(14, 30, 626, 190, 80), col, 11);
  p.poly(rrect(52, 66, 182, 154, 8), "#fff6d8", 7); p.stroke([[58, 72], [117, 116], [176, 72]], 6);
  txt(p, text, 400, 112, text.length > 6 ? 92 : 104, "#ffffff", 11);
};
/** the world map on the lounge wall, 760 x 480, with n pins (0..4: Japan, Germany, Australia, Guam), each with its name */
const PINS: [number, number, string][] = [[598, 168, "JAPAN"], [372, 128, "GERMANY"], [610, 352, "AUSTRALIA"], [664, 238, "GUAM"]];
export const fxWorldMap = (p: Pen, n: number) => {
  const g = p.g;
  p.poly(rrect(10, 10, 750, 470, 14), "#8a5a34", 10);
  p.clip(rrect(34, 34, 726, 446, 6), () => {
    g.fillStyle = "#9fc8e6"; g.fillRect(0, 0, 760, 480);
    const land = "#e8d9a8";
    p.poly([[70, 90], [230, 70], [270, 130], [210, 220], [170, 250], [120, 200], [80, 150]], land, 5); // N America
    p.poly([[190, 260], [250, 270], [260, 340], [220, 420], [195, 360]], land, 5);                    // S America
    p.poly([[330, 90], [420, 80], [430, 140], [380, 160], [340, 140]], land, 5);                       // Europe
    p.poly([[340, 170], [430, 170], [450, 260], [400, 360], [360, 300], [330, 220]], land, 5);         // Africa
    p.poly([[430, 70], [640, 70], [640, 150], [560, 220], [470, 210], [440, 140]], land, 5);           // Asia
    p.poly([[560, 320], [660, 310], [680, 380], [590, 400]], land, 5);                                 // Australia
  });
  // home: a star in Texas
  p.poly([[170, 168], [178, 184], [196, 186], [183, 198], [187, 216], [170, 207], [153, 216], [157, 198], [144, 186], [162, 184]], "#d8433e", 4);
  for (let i = 0; i < Math.min(n, PINS.length); i++) {
    const [x, y, name] = PINS[i];
    g.strokeStyle = "rgba(216,67,62,0.8)"; g.setLineDash([10, 10]); g.lineWidth = 5; g.beginPath(); g.moveTo(170, 192); g.quadraticCurveTo((170 + x) / 2, Math.min(y, 192) - 90, x, y); g.stroke(); g.setLineDash([]);
    p.ell(x, y - 18, 16, 16, "#f272b0", 6); p.stroke([[x, y - 4], [x, y + 8]], 6);
    const w = name.length * 19 + 24, lx = Math.min(726 - w / 2, Math.max(34 + w / 2, x));
    p.poly(rrect(lx - w / 2, y + 12, lx + w / 2, y + 50, 10), "#ffffff", 5); txt(p, name, lx, y + 32, 28, "#241726", 0);
  }
};
/** a birthday cake with "100" candles, 420 x 380; flame flicker by `fl` */
export const fxCake = (p: Pen, fl: number) => {
  p.poly(rrect(30, 300, 390, 340, 16), "#e9e4d8", 8);            // plate
  p.poly(rrect(60, 190, 360, 310, 14), "#f7c6d9", 9);            // tier
  p.poly([[60, 220], [100, 240], [140, 220], [180, 240], [220, 220], [260, 240], [300, 220], [340, 240], [360, 220], [360, 196], [60, 196]], "#fff6ea", 0);
  for (const [x, c] of [[90, "#3f6fb5"], [150, "#2f8f5a"], [210, "#d8433e"], [270, "#f6d24a"], [330, "#7b5ac9"]] as [number, string][]) p.dot(x, 270, 9, c);
  txt(p, "100", 210, 128, 110, "#f6d24a", 10);                   // number candles
  for (const x of [148, 210, 272]) { p.poly([[x, 30 + 6 * fl], [x - 12, 58], [x, 70], [x + 12, 58]], "#ffb347", 4); p.ell(x, 58, 5, 8, "#fff3b0", 0); }
};
/** confetti burst, 600 x 600 at time k (0..1) */
export const fxConfetti = (p: Pen, k: number) => {
  const g = p.g, cols = ["#f272b0", "#f6d24a", "#5a8fc2", "#6aab4f", "#d8433e", "#7b5ac9"];
  for (let i = 0; i < 46; i++) {
    const a = i * 2.39996, sp = 0.45 + ((i * 37) % 11) / 20, r = 290 * Math.min(1, k * 1.6) * sp;
    const x = 300 + r * Math.cos(a), y = 300 + r * Math.sin(a) * 0.8 + 160 * k * k;
    g.save(); g.translate(x, y); g.rotate(a + k * 6);
    g.fillStyle = cols[i % cols.length]; g.strokeStyle = INK; g.lineWidth = 3; g.fillRect(-11, -6, 22, 12); g.strokeRect(-11, -6, 22, 12); g.restore();
  }
};
/** the mail sack slung on a back, 360 x 360; envelopes poking out (fill 0..1 swells it) */
export const fxSack = (p: Pen, fill: number) => {
  const k = 0.8 + 0.35 * fill;
  p.g.save(); p.g.translate(180, 220); p.g.scale(k, k); p.g.translate(-180, -220);
  for (const [x, y, r] of [[130, 90, -0.4], [190, 76, 0.1], [240, 96, 0.5]] as [number, number, number][]) { p.g.save(); p.g.translate(x, y); p.g.rotate(r);
    p.poly(rrect(-40, -28, 40, 28, 5), "#fbf6e6", 5); p.stroke([[-34, -22], [0, 2], [34, -22]], 4); p.g.restore(); }
  p.poly([[70, 120], [290, 120], [330, 260], [290, 330], [70, 330], [30, 260]], "#a8845a", 9);
  p.stroke([[80, 130], [280, 130]], 10, "#7a5a3a");
  txt(p, "MAIL", 180, 236, 64, "#5a3b2a", 0);
  p.g.restore();
};
/** a camera flash, 400 x 400 (k 0..1 fades) */
export const fxFlash = (p: Pen, k: number) => fxBurst(p, k, "#ffffff", 12, 30, 190);
/** an open birthday card, 300 x 380: pink cover, a heart, a few lines */
export const fxGreeting = (p: Pen) => {
  p.poly(rrect(14, 14, 286, 366, 12), "#f7c6d9", 9);
  p.poly([[150, 170], [96, 116], [102, 74], [138, 70], [150, 92], [162, 70], [198, 74], [204, 116]], "#d8433e", 7);
  for (const y of [220, 262, 304]) p.stroke([[60, y], [240, y]], 7, "#b8708f");
};


// ======================= "A Town Under One Roof" additions =======================
/** the tower cut open, 800 x 1120: five floors, bottom to top police, post office, store, clinic, church; ks[i] lights + labels floor i */
const CUT: [string, string][] = [["POLICE", "#3f6fb5"], ["POST OFFICE", "#d8433e"], ["STORE", "#2f8f5a"], ["CLINIC", "#e9eef4"], ["CHURCH", "#7b5ac9"]];
export const fxCutaway = (p: Pen, ks: number[]) => {
  const g = p.g;
  p.poly(rrect(30, 40, 770, 1100, 10), "#e3d6bd", 12);
  for (let i = 0; i < 5; i++) {
    const y1 = 1080 - i * 200, y0 = y1 - 180, k = ks[i] ?? 0, [name, c] = CUT[i];
    p.poly([[60, y0], [740, y0], [740, y1], [60, y1]], k > 0 ? c : "#4d5566", 8);
    if (k > 0) {
      p.poly([[60, y1 - 30], [740, y1 - 30], [740, y1], [60, y1]], shade(c === "#e9eef4" ? "#b9c3cf" : c, 0.7), 0);
      g.save(); g.translate(400, y0 + 82); g.scale(k, k);
      const ic = i === 0 ? "#f6d24a" : i === 3 ? "#d8433e" : "#ffffff";
      if (i === 0) p.poly([[-250, -40], [-210, -60], [-170, -40], [-174, 10], [-210, 40], [-246, 10]], ic, 7);
      else if (i === 1) { p.poly(rrect(-260, -50, -160, 20, 6), "#fff6d8", 7); p.stroke([[-256, -46], [-210, -10], [-164, -46]], 7); }
      else if (i === 2) { p.poly([[-255, -40], [-165, -40], [-178, 20], [-242, 20]], "#f2c94c", 7); p.stroke([[-270, -55], [-255, -40]], 8); }
      else if (i === 3) { p.poly([[-225, -60], [-195, -60], [-195, -30], [-165, -30], [-165, 0], [-195, 0], [-195, 30], [-225, 30], [-225, 0], [-255, 0], [-255, -30], [-225, -30]], ic, 6); }
      else { p.poly([[-218, -70], [-202, -70], [-202, -40], [-180, -40], [-180, -24], [-202, -24], [-202, 30], [-218, 30], [-218, -24], [-240, -24], [-240, -40], [-218, -40]], "#f6d24a", 6); }
      txt(p, name, 60, -4, name.length > 7 ? 74 : 92, i === 3 ? "#d8433e" : "#ffffff", 10);
      g.restore();
    } else for (const x of [160, 400, 640]) p.poly(rrect(x - 50, y0 + 50, x + 50, y0 + 130, 6), "#7d9cc0", 6);
  }
  p.poly([[10, 50], [400, -0], [790, 50]], "#a8724a", 10);
};
/** the town sign, 720 x 360: WHITTIER + POP. n */
export const fxTownSign = (p: Pen, n: number) => {
  const g = p.g;
  p.poly(rrect(20, 20, 700, 330, 26), "#2f7a4a", 12);
  g.strokeStyle = "#f6f1e4"; g.lineWidth = 6; g.strokeRect(46, 46, 628, 258);
  txt(p, "WHITTIER", 360, 120, 96, "#f6f1e4", 0);
  txt(p, "POP.", 250, 236, 70, "#f6f1e4", 0);
  txt(p, String(n), 440, 236, 96, "#f6d24a", 0);
};
/** a round floor tag, 200 x 200 */
export const fxFloorTag = (p: Pen, n: number) => { p.ell(100, 100, 82, 82, n === 14 ? "#f272b0" : "#3f6fb5", 9); txt(p, String(n), 100, 106, n > 9 ? 78 : 92, "#ffffff", 0); };
/** the snow gauge, 160 x 1100: a red and white pole, metres 1..6 */
export const fxGauge = (p: Pen) => {
  for (let i = 0; i < 6; i++) { const y1 = 1080 - i * 170; p.poly([[50, y1 - 170], [110, y1 - 170], [110, y1], [50, y1]], i % 2 ? "#ffffff" : "#d8433e", 0);
    txt(p, String(i + 1), 80, y1 - 170, 54, "#2b2230", 8); }
  p.poly([[50, 60], [110, 60], [110, 1080], [50, 1080]], null, 8);
};
/** a snowdrift rising to lv (0..1 of the card height), 1000 x 700, wavy top */
export const fxMound = (p: Pen, lv: number) => {
  if (lv <= 0) return;
  const top = 700 - 700 * lv, pts: [number, number][] = [[0, 700]];
  for (let x = 0; x <= 1000; x += 50) pts.push([x, top + 22 + 16 * Math.sin(x / 70) + 10 * Math.sin(x / 23)]);
  pts.push([1000, 700]);
  p.poly(pts, "#f4f6fa", 10);
  p.g.save(); p.path(pts, true); p.g.clip();
  p.g.fillStyle = "rgba(150,175,220,0.35)"; for (let i = 0; i < 6; i++) { p.g.beginPath(); p.g.ellipse(80 + i * 170, 700 - 60, 140, 40 + 20 * (i % 2), 0, 0, 7); p.g.fill(); }
  p.g.restore();
};
/** falling snow, 1024 x 1024: soft white flakes scrolled by t (s) */
export const fxSnowfall = (p: Pen, t: number, seed = 1, n = 90) => {
  const g = p.g;
  for (let i = 0; i < n; i++) {
    const h = (k: number) => { const v = Math.sin((i + 1) * 127.1 * seed + k * 311.7) * 43758.5453; return v - Math.floor(v); };
    const sp = 120 + 160 * h(1), r = 5 + 9 * h(2), y = (h(3) * 1024 + t * sp) % 1024, x = (h(4) * 1024 + 30 * Math.sin(t * 1.3 + i)) % 1024;
    g.fillStyle = `rgba(255,255,255,${0.65 + 0.3 * h(5)})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
};
/** a locomotive seen head-on, 600 x 700: blue and yellow, lit headlamp */
export const fxTrain = (p: Pen) => {
  p.poly(rrect(70, 110, 530, 660, 30), "#2f4f9a", 12);
  p.poly(rrect(100, 140, 500, 330, 18), "#9fc3e6", 9); p.stroke([[300, 140], [300, 330]], 8);
  p.poly([[70, 400], [530, 400], [530, 470], [70, 470]], "#f6d24a", 0); p.stroke([[70, 400], [530, 400]], 7); p.stroke([[70, 470], [530, 470]], 7);
  p.ell(300, 70, 40, 40, "#fff6c8", 9); p.ell(150, 560, 34, 34, "#fff6c8", 8); p.ell(450, 560, 34, 34, "#fff6c8", 8);
  p.poly([[110, 660], [490, 660], [530, 700], [70, 700]], "#2b2230", 8);
};
/** a road barrier, 900 x 360: post at the left, arm from up (k 0) to across (k 1) */
export const fxGate = (p: Pen, k: number) => {
  const g = p.g, a = (-Math.PI / 2) * (1 - k);
  p.poly(rrect(40, 140, 120, 360, 10), "#3a3d47", 9);
  g.save(); g.translate(80, 160); g.rotate(a);
  for (let i = 0; i < 7; i++) p.poly([[i * 110, -26], [i * 110 + 110, -26], [i * 110 + 110, 26], [i * 110, 26]], i % 2 ? "#ffffff" : "#d8433e", 0);
  p.poly([[0, -26], [770, -26], [770, 26], [0, 26]], null, 9);
  g.restore(); p.ell(80, 160, 22, 22, "#f6d24a", 7);
};
/** a cardboard box, 220 x 180 */
export const fxBox = (p: Pen) => { p.poly(rrect(20, 40, 200, 170, 6), "#c9935a", 9); p.poly([[20, 40], [200, 40], [180, 10], [40, 10]], "#d9a86a", 8); p.stroke([[110, 40], [110, 100]], 6, "#8a5a34"); };

// ======================= "Rent Me. I'll Do Nothing." additions =======================
/** his sign, 900 x 360: RENT ME / I DO NOTHING */
export const fxNothingSign = (p: Pen) => {
  p.poly(rrect(20, 20, 880, 340, 30), "#fff6d8", 11); p.poly(rrect(44, 44, 856, 316, 20), null, 5);
  txt(p, "RENT ME", 450, 120, 100, "#2b2230", 0); txt(p, "I DO NOTHING", 450, 240, 84, "#d8433e", 0);
};
/** a request counter, 600 x 220: a pink pill with a number and a small word */
export const fxPill = (p: Pen, n: string, word: string) => {
  p.poly(rrect(14, 20, 586, 200, 80), "#f272b0", 11); txt(p, n, 300, 92, 104, "#ffffff", 10); txt(p, word, 300, 168, 40, "#ffffff", 0);
};
/** the finish banner, 1000 x 260 on two posts */
export const fxFinish = (p: Pen) => {
  p.stroke([[60, 60], [60, 260]], 16, "#3a3d47"); p.stroke([[940, 60], [940, 260]], 16, "#3a3d47");
  p.poly(rrect(20, 20, 980, 150, 16), "#3f6fb5", 10);
  for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) p.poly([[40 + i * 20, 40 + j * 45], [60 + i * 20, 40 + j * 45], [60 + i * 20, 85 + j * 45], [40 + i * 20, 85 + j * 45]], "#ffffff", 0);
  txt(p, "FINISH", 590, 88, 96, "#ffffff", 0);
};
/** the Yamanote loop, 500 x 500: a green ring, station dots, the train dot at angle a (turns) */
export const fxLoop = (p: Pen, a: number) => {
  p.ell(250, 250, 230, 230, "#fff6d8", 10);
  p.g.lineWidth = 34; p.g.strokeStyle = "#241726"; p.g.beginPath(); p.g.ellipse(250, 250, 160, 175, 0, 0, 7); p.g.stroke();
  p.g.lineWidth = 22; p.g.strokeStyle = "#6aab4f"; p.g.beginPath(); p.g.ellipse(250, 250, 160, 175, 0, 0, 7); p.g.stroke();
  for (let k = 0; k < 12; k++) { const b = (k / 12) * Math.PI * 2; p.dot(250 + 160 * Math.cos(b), 250 + 175 * Math.sin(b), 8, "#ffffff"); }
  const b = a * Math.PI * 2 - Math.PI / 2; p.ell(250 + 160 * Math.cos(b), 250 + 175 * Math.sin(b), 30, 30, "#d8433e", 8);
};
/** a commuter train car from the side, 1600 x 500: silver with a green stripe; window 2 holds a waving face */
export const fxTrainSide = (p: Pen, wave: number) => {
  p.poly(rrect(10, 40, 1590, 470, 30), "#d9dde3", 11);
  p.poly([[10, 300], [1590, 300], [1590, 340], [10, 340]], "#6aab4f", 0);
  for (let k = 0; k < 5; k++) { const x = 70 + k * 300; p.poly(rrect(x, 100, x + 200, 260, 12), "#9fc3e6", 8); }
  p.poly(rrect(1380, 100, 1520, 440, 10), "#b9bec7", 8);
  const cx = 470, cy = 200; p.ell(cx, cy + 10, 52, 48, "#f5d6be", 7); p.ell(cx, cy - 20, 54, 30, "#5a3b2a", 0, 180, 360);
  p.dot(cx - 18, cy + 6, 6); p.dot(cx + 18, cy + 6, 6); p.arc(cx, cy + 22, 14, 10, 20, 160, 5);
  p.g.save(); p.g.translate(cx + 80, cy + 20); p.g.rotate(0.4 * wave); p.ell(0, -40, 16, 22, "#f5d6be", 6); p.stroke([[0, -20], [0, 40]], 10, "#3f6fb5"); p.g.restore();
  for (const x of [250, 1350]) { p.ell(x, 470, 46, 30, "#3a3d47", 8); }
};
/** the papers, 300 x 360: a sheet with a header and lines */
export const fxPapers = (p: Pen) => {
  p.poly(rrect(30, 30, 270, 330, 8), "#fbfbf6", 9); txt(p, "DIVORCE", 150, 76, 40, "#d8433e", 0);
  for (let i = 0; i < 6; i++) p.stroke([[60, 130 + i * 30], [240 - (i % 2) * 40, 130 + i * 30]], 7, "#9aa0aa");
  p.stroke([[60, 300], [150, 290], [180, 305]], 6, "#3f6fb5");
};

// ======================= "Happy to Chat" additions =======================
/** the chat bench sign, 800 x 500: bright yellow, the words of the real sign */
export const fxChatSign = (p: Pen) => {
  p.poly(rrect(14, 14, 786, 486, 26), "#f6d24a", 12);
  txt(p, "THE 'HAPPY TO CHAT'", 400, 90, 50, "#2b2230", 0); txt(p, "BENCH", 400, 172, 88, "#2b2230", 0);
  txt(p, "Sit here if you don't mind", 400, 290, 40, "#2b2230", 0); txt(p, "someone stopping", 400, 350, 40, "#2b2230", 0); txt(p, "to say hello", 400, 410, 40, "#2b2230", 0);
};
/** a world map, 1000 x 560: simple continents, pins pop for Europe (k[0]), Australia (k[1]), North America (k[2]); the UK always marked */
export const fxWorld = (p: Pen, k: number[]) => {
  p.poly(rrect(10, 10, 990, 550, 22), "#9fc8e6", 10);
  const land = "#b8c98f";
  p.poly([[90, 90], [300, 70], [330, 150], [270, 230], [230, 300], [200, 260], [130, 200], [80, 140]], land, 7);       // North America
  p.poly([[250, 310], [320, 320], [330, 420], [290, 500], [260, 440], [240, 360]], land, 7);                         // South America
  p.poly([[460, 90], [560, 80], [580, 140], [520, 170], [470, 160]], land, 7);                                      // Europe
  p.poly([[480, 190], [600, 190], [620, 300], [560, 430], [520, 380], [470, 280]], land, 7);                         // Africa
  p.poly([[580, 80], [880, 90], [900, 200], [790, 260], [680, 240], [600, 170]], land, 7);                           // Asia
  p.poly([[790, 360], [900, 350], [920, 430], [850, 470], [790, 440]], land, 7);                                      // Australia
  const pin = (x: number, y: number, kk: number, c: string) => { if (kk <= 0) return; p.g.save(); p.g.translate(x, y); p.g.scale(kk, kk); p.poly([[0, 0], [-22, -40], [-20, -62], [0, -76], [20, -62], [22, -40]], c, 7); p.ell(0, -54, 9, 9, "#ffffff", 0); p.g.restore(); };
  pin(470, 110, 1, "#f272b0");
  pin(530, 125, k[0] ?? 0, "#d8433e"); pin(560, 105, k[0] ?? 0, "#d8433e");
  pin(850, 410, k[1] ?? 0, "#d8433e");
  pin(200, 150, k[2] ?? 0, "#d8433e"); pin(250, 200, k[2] ?? 0, "#d8433e");
};
