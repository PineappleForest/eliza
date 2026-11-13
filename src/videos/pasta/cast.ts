// Our cast as lit flat sprites in the 3D world (template: canvas pool, cardShade cards, contact blobs, blinks).
// stage(id, t, cam) says who is where, in which pose and expression, for every shot of the ELIZA -> Feeloy short.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxPhone, fxShadow, fxContact, fxBadge, fxBubble, fxTimer, fxSob, fxNope, fxTV, fxCalendar, fxGrapes, fxPot, fxFood,
  fxPlate, fxStatement, fxBanner, Outfit, Expr, FrontOpts, SideOpts, Prop, BubbleIcon } from "./toon";
import { FPS, D0, SHOTS, V3, R, MX, MZ, RUN_X, smooth, clamp01 } from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null; front = false;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = this.front ? 10 : 0; }
  }
}

export type Stage = { places: Place[]; fx: FxPlace[] };
// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean;
  /** fixed Euler orientation (YXZ) instead of facing the camera; front = drawn last (phone insert) */
  orient?: [number, number, number]; front?: boolean; glow?: number };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3; quat?: THREE.Quaternion };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" | "night" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const SWAPS: Record<number, number[]> = {};
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden" | "night", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.3, 0.3, 0.45] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};
// ======================= cast of "No One to Save" =======================
const MICHELE: Outfit = { jacket: "#8a6f5a", pants: "#4a4d57", boots: "#3a2a22", hat: "hair", hair: "#e6e2da", glasses: true, moustache: "#e6e2da", collar: "#f4f1ea", skin: "#f0d2b8" };
const JOLE: Outfit = { jacket: "#c25a7a", pants: "#4a4d57", boots: "#5a3b2a", dress: "#8a6fb0", hat: "hair", hair: "#e6e2da", skin: "#f5d6be" };
const COP = (skin: string, extra: Partial<Outfit> = {}): Outfit => ({ jacket: "#22304f", pants: "#1b2338", boots: "#1e1b22", hat: "cap", cap: "#22304f", belt: "#e9e4d8", skin, ...extra });
const COPS: Outfit[] = [COP("#e8c0a0"), COP("#c99067", { moustache: "#3a2a22" }), COP("#f0d2b8", { build: "stout" }), COP("#d9a07a")];
const NEIGH: Outfit = { jacket: "#6aab4f", pants: "#3b3f52", boots: "#f4f1ea", hat: "hair", hair: "#5a3b2a", longHair: "#5a3b2a", skin: "#f5d6be" };
const LONER: Outfit = { jacket: "#5a8fc2", pants: "#2f3a5a", boots: "#f4f1ea", hat: "hair", hair: "#2a2230", longHair: "#2a2230", skin: "#c99067" };
const OKEY = new Map<Outfit, string>();
const okeyOf = (o: Outfit) => { let k = OKEY.get(o); if (!k) { k = "o" + OKEY.size; OKEY.set(o, k); } return k; };

const SIT = 0.3;
const F = (t: number) => t * FPS;
const wob = (t: number, hz: number, ph = 0) => q(Math.sin(2 * Math.PI * hz * t + ph), 8);
const pop = (f: number, f0: number) => (f < f0 ? 0 : q(Math.min(1, smooth((f - f0) / 5) * 1.12 - 0.12 * smooth((f - f0 - 5) / 4)), 20));

type Act = { o: Outfit; i: number; at: V3; mode?: FrontOpts["mode"]; expr?: Expr; prop?: Prop; facing?: -1 | 0 | 1; look?: number; wave?: number;
  tilt?: number; headTilt?: number; phase?: number; scale?: number; shadow?: boolean; swaps?: number[]; nudge?: number; mirror?: boolean; seat?: number };
const put = (cam: CamInfo, t: number, out: Stage, a: Act) => {
  const sitting = a.mode === "sit", y = a.at[1] + (sitting ? a.seat ?? SIT : 0), nd = a.nudge ?? (sitting ? 0.45 : 0);
  if (nd) {
    const dx = cam.pos.x - a.at[0], dz = cam.pos.z - a.at[2], l = Math.hypot(dx, dz) || 1;
    a = { ...a, at: [a.at[0] + (dx / l) * nd, a.at[1], a.at[2] + (dz / l) * nd] };
  }
  const blink = lidAt(t, a.i, a.swaps ?? []);
  const fo: FrontOpts = { mode: a.mode ?? "stand", expr: a.expr ?? "neutral", prop: a.prop ?? null, facing: a.facing ?? 0, look: a.look ?? 0, blink,
    wave: a.wave, tilt: a.tilt ?? 0, headTilt: a.headTilt ?? 0, phase: a.phase ?? 0, lift: 30 };
  const pl = person(cam, { i: a.i, o: a.o, okey: okeyOf(a.o) }, a.at[0], y, a.at[2], { side: false, mirror: false }, fo, {}, a.scale ?? 1);
  if (a.mirror) pl.mirror = true;
  out.places.push(pl);
  if (a.shadow !== false) blob(out, a.at[0], a.at[1], a.at[2], (a.scale ?? 1) * (sitting ? 1.1 : 1), sitting ? 0.7 : 1);
};
/** side view (walks): faces screen-right unless `left` */
const putSide = (cam: CamInfo, t: number, out: Stage, o: Outfit, i: number, at: V3, so: SideOpts, left = false, scale = 1) => {
  const pl = person(cam, { i, o, okey: okeyOf(o) }, at[0], at[1], at[2], { side: true, mirror: left }, {}, { ...so, blink: lidAt(t, i) }, scale);
  out.places.push(pl); blob(out, at[0], at[1], at[2], scale);
};
const E = (x: number, y: number, z: number): V3 => [MX + x, D0 + y, MZ + z];
const card = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, at: V3, w: number, h: number, fixed = false, glow?: number, soft?: boolean) =>
  out.fx.push({ key, cw, ch, draw, x: at[0], y: at[1], z: at[2], w, h, orient: fixed ? [0, 0, 0] : undefined, glow, soft });
const bubble = (out: Stage, icon: BubbleIcon, k: number, at: V3, w = 0.46) => { if (k > 0) card(out, `bub|${icon}|${k}`, 500, 420, (p) => fxBubble(p, icon, k), at, w, w * 0.84); };
const badge = (out: Stage, word: string, colr: string, k: number, at: V3, w = 0.9) => { if (k > 0) card(out, `badge|${word}|${colr}`, 520, 180, (p) => fxBadge(p, word, colr), at, w * k, w * 0.346 * k); };
const Fl = (x: number, y: number, z: number) => R("flat", x, y, z);
/** the couple on their sofa (Jole left, Michele right) */
const couple = (cam: CamInfo, t: number, out: Stage, je: Expr, me: Expr, a: Partial<Act> = {}, b: Partial<Act> = {}) => {
  put(cam, t, out, { o: JOLE, i: 10, at: Fl(1.15, 0, -2.2), mode: "sit", seat: 0.42, nudge: 0.08, shadow: false, expr: je, facing: 1, look: 1, ...a });
  put(cam, t, out, { o: MICHELE, i: 11, at: Fl(2.05, 0, -2.2), mode: "sit", seat: 0.42, nudge: 0.08, shadow: false, expr: me, facing: -1, look: -1, ...b });
};
const nope = (out: Stage, word: string, f: number, f0: number, at: V3, w = 0.9) => { const k = pop(f, f0); if (k > 0) { const st = q(clamp01((f - f0 - 8) / 8), 16);
  card(out, `nope|${word}|${k}|${st}`, 520, 180, (p) => fxNope(p, word, st), at, w * k, w * 0.346 * k); } };

// 1: the street at dusk: sobs from the window, the neighbour looks up and calls
const shot1 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  card(out, `sob|${q(t % 1, 15)}`, 400, 300, (p) => fxSob(p, t % 1), [MX - 1.5, D0 + 5.3, MZ + 0.3], 1.9, 1.43);
  put(cam, t, out, { o: NEIGH, i: 20, at: [MX - 1.5, D0, MZ + 3.2], facing: 1, look: 1, headTilt: -8, prop: f >= 97 ? "phone" : undefined, expr: f >= 72 ? "shock" : "neutral", swaps: [72 / FPS] });
  const k = pop(f, 110); if (k > 0) card(out, `call|${k}`, 400, 160, (p) => fxTimer(p, "112"), [MX - 0.55, D0 + 2.3, MZ + 3.3], 0.75 * k, 0.3 * k);
};
// 2: four officers run up the street
const shot2 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), x0 = RUN_X(f);
  COPS.forEach((o, i) => putSide(cam, t, out, o, 30 + i, [MX + x0 - i * 1.1, D0, MZ + 3.5 + (i % 2) * 0.35],
    { mode: "march", phase: q(((f - 141) / 15 + i * 0.27) % 1, 12), expr: f >= 192 ? "stern" : "nervous", stomp: 0.3, stride: 0.7 }));
};
// 3: in the doorway: no burglar, no scam, no crime
const shot3 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: COPS[0], i: 30, at: Fl(-3.35, 0, -1.0), facing: 1, look: 1, expr: f >= 324 ? "relief_open" : "nervous", headTilt: f >= 324 ? 6 : 0, swaps: [324 / FPS] });
  put(cam, t, out, { o: COPS[1], i: 31, at: Fl(-3.45, 0, -1.85), facing: 1, look: 1, expr: f >= 324 ? "relief" : "stern", swaps: [324 / FPS] });
  const [w, f0] = f >= 322 ? ["CRIME", 322] : f >= 286 ? ["SCAM", 286] : ["BURGLAR", 250];
  nope(out, w as string, f, f0 as number, Fl(-3.35, 2.45, -1.35), 0.85);
};
// 4: Michele and Jole: 94, Jole, 70 years
const shot4 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  couple(cam, t, out, f >= 437 ? "smile_closed" : "smile", f >= 387 ? "grin" : "smile", { headTilt: f >= 497 ? 7 : 0 }, { headTilt: f >= 497 ? -7 : 0 });
  badge(out, "MICHELE, 94", "#3f6fb5", pop(f, 385), Fl(1.95, 1.92, -2.0), 0.5);
  badge(out, "JOLE", "#c25a7a", pop(f, 435), Fl(1.25, 1.92, -2.0), 0.4);
  const k = pop(f, 495); if (k > 0) card(out, `years|${k}`, 520, 180, (p) => fxBadge(p, "70 YEARS", "#f272b0"), Fl(1.6, 2.25, -1.9), 0.82 * k, 0.284 * k);
};
// 5: the news; they cry
const shot5 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  const e: Expr = f >= 653 ? "cry" : f >= 596 ? "sad" : "neutral";
  couple(cam, t, out, e, e, { swaps: [596 / FPS, 653 / FPS] }, { swaps: [596 / FPS, 653 / FPS] });
  card(out, `tv|${q(t % 1, 15)}`, 420, 360, (p) => fxTV(p, t % 1), Fl(-0.9, 0.86, -2.62), 0.52, 0.45, true);
};
// 6: the calendar: AUGUST
const shot6 = (cam: CamInfo, t: number, out: Stage) => {
  const k = pop(F(t), 696);
  card(out, `cal|${k}`, 300, 360, (p) => fxCalendar(p, k > 0 ? "AUGUST" : "JULY"), Fl(0.1, 1.72, -2.95), 0.45, 0.54, true);
};
// 7: the landing: every neighbour away
const shot7 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  [-1.05, 0, 1.05].forEach((x, i) => badge(out, "AWAY", "#c9774e", pop(f, 734 + i * 8), R("landing", x, 1.5, -1.85), 0.7));
};
// 8: the two of them alone
const shot8 = (cam: CamInfo, t: number, out: Stage) => couple(cam, t, out, "sad", "neutral", { headTilt: 8 }, { headTilt: -4 });
// 9: the table: a few grapes
const shot9 = (cam: CamInfo, t: number, out: Stage) => {
  couple(cam, t, out, "neutral", "sad");
  card(out, "grapes", 360, 260, (p) => fxGrapes(p), Fl(1.6, 0.45 + 0.12, -1.05), 0.34, 0.245, true);
};
// 10: one officer cooks
const shot10 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), noodles = f >= 956;
  put(cam, t, out, { o: COPS[2], i: 32, at: Fl(-3.3, 0, -1.85), facing: 1, look: 1, expr: f >= 986 ? "grin" : "smile", prop: "mug" });
  card(out, `pot|${q(t % 1, 15)}|${noodles}`, 400, 400, (p) => fxPot(p, t % 1, noodles), Fl(-2.85, 0.95 + 0.22, -2.66), 0.46, 0.46, true);
  for (const [f0, kind, x] of [[986, "butter", -2.95], [1004, "cheese", -2.4]] as [number, "butter" | "cheese", number][]) {
    const k = pop(f, f0); if (k > 0) card(out, `food|${kind}|${k}`, 300, 300, (p) => fxFood(p, kind), Fl(x, 1.62, -2.35), 0.34 * k, 0.34 * k);
  }
};
// 11: the other three pull up chairs and talk; spaghetti on the table
const shot11 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), lau = f >= 1097;
  couple(cam, t, out, lau ? "laugh" : "smile", lau ? "laugh" : "grin");
  put(cam, t, out, { o: COPS[0], i: 30, at: Fl(0.15, 0, -1.65), mode: "sit", seat: 0.48, nudge: 0.05, shadow: false, facing: 1, look: 1, expr: lau ? "laugh" : "smile" });
  put(cam, t, out, { o: COPS[1], i: 31, at: Fl(3.05, 0, -1.65), mode: "sit", seat: 0.48, nudge: 0.05, shadow: false, facing: -1, look: -1, expr: lau ? "grin" : "smile" });
  put(cam, t, out, { o: COPS[3], i: 33, at: Fl(1.6, 0, -2.92), shadow: false, expr: lau ? "laugh" : "smile", wave: lau ? undefined : wob(t, 1.6) });
  for (const x of [1.35, 1.85]) card(out, "plate", 320, 200, (p) => fxPlate(p), Fl(x, 0.45 + 0.08, -1.05), 0.32, 0.2, true);
};
// 12: the police note (insert in front of the lens)
let camLook: V3 = [0, 0, 0];
const shot12 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), k1 = f >= 1180 ? 1 : 0, k2 = pop(f, 1236);
  couple(cam, t, out, "smile_closed", "smile", { headTilt: 7 }, { headTilt: -7 });
  out.fx.push({ key: `note|${k1}|${k2}`, cw: 600, ch: 520, draw: (p) => fxStatement(p, k1, k2), x: camLook[0], y: camLook[1] - 0.01, z: camLook[2], w: 0.21, h: 0.182, rot: -0.03, front: true });
};
// 13: the street door: WE'RE ALWAYS THERE
const shot13 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: COPS[0], i: 30, at: [MX - 0.7, D0, MZ + 1.3], facing: 1, look: 1, expr: "grin", wave: f >= 1382 ? wob(t, 2.2) : undefined });
  put(cam, t, out, { o: COPS[1], i: 31, at: [MX + 0.7, D0, MZ + 1.3], facing: -1, look: -1, expr: f >= 1382 ? "laugh" : "smile" });
  const k = pop(f, 1382); if (k > 0) card(out, `banner|${k}`, 900, 200, (p) => fxBanner(p, "WE'RE ALWAYS THERE"), [MX, D0 + 3.0, MZ + 1.5], 2.4 * k, 0.533 * k, true);
};
// 14: a lonely flat at night; then Jenny
const shot14 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: LONER, i: 14, at: R("homeN", -0.4, 0, -1.75), mode: "sit", seat: 0.42, prop: "phone", shadow: false, expr: f >= 1570 ? "smile" : "sad", swaps: [1570 / FPS] });
  if (f < 1550) { bubble(out, "dots", pop(f, 1495), R("homeN", 0.2, 1.75, -1.6), 0.42); return; }
  const pose = f >= 1583 && f < 1615 ? "wave" : f >= 1637 && f < 1662 ? "listen" : "smile";
  const [icon, f0]: [BubbleIcon, number] = f >= 1685 ? ["heart", 1685] : f >= 1662 ? ["dots", 1662] : f >= 1637 ? ["note", 1637] : ["dots", 99999];
  const bb = f >= f0 ? q(smooth((f - f0) / 6), 8) : 0;
  const blink = lidAt(t, 9) >= 1 ? 1 : 0, wv = pose === "wave" ? wob(t, 2.2) : 0;
  out.fx.push({ key: `phone|${pose}|${blink}|${wv}|${bb}|${icon}`, cw: 500, ch: 1000, draw: (p) => fxPhone(p, pose, blink, wv, bb, icon, "11:00"),
    x: camLook[0], y: camLook[1] - 0.005, z: camLook[2], w: 0.139, h: 0.278, rot: 0.025, front: true });
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (cam.quat) { const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quat); camLook = [cam.pos.x + fw.x * 0.45, cam.pos.y + fw.y * 0.45, cam.pos.z + fw.z * 0.45]; }
  const SH = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8, shot9, shot10, shot11, shot12, shot13, shot14];
  SH[id - 1]?.(cam, t, out);
  return out;
};
export { FPS };
