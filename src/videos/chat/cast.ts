// Our cast as lit flat sprites in the 3D world (template: canvas pool, cardShade cards, contact blobs, blinks).
// stage(id, t, cam) says who is where, in which pose and expression, for every shot of the ELIZA -> Feeloy short.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxPhone, fxShadow, fxContact, fxBurst, fxLaneSign, fxItem, fxThought, fxMap, fxShutter, fxTrolley,
  Outfit, Expr, FrontOpts, SideOpts, Prop, BubbleIcon } from "./toon";
import { FPS, D0, SHOTS, V3, R, QUAY_Z, SHOP_X, SHOP_Z, LANE_A, LANE_B, COUNTER_H, OMA_X, smooth, clamp01 } from "./story";
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
// ======================= cast of "The Slow Lane" =======================
const OMA: Outfit = { jacket: "#8a6fb0", pants: "#4a4d57", boots: "#5a3b2a", dress: "#6f5a96", hat: "hair", hair: "#d9d4cc", glasses: true, skin: "#f5d6be" };
export const CASHIER: Outfit = { jacket: "#3f8f8a", pants: "#2f3a5a", boots: "#1e1b22", hat: "hair", hair: "#8a4a2a", ponytail: "#8a4a2a", collar: "#f2c94c", skin: "#f5d6be" };
const FASTCASH: Outfit = { jacket: "#3f8f8a", pants: "#2f3a5a", boots: "#1e1b22", hat: "hair", hair: "#1e1b22", collar: "#f2c94c", glasses: true, skin: "#ecd0b6" };
const SHOPPER: Outfit = { jacket: "#e86e5a", pants: "#3b5b9a", boots: "#f4f1ea", hat: "hair", hair: "#2a2230" };
const TROLLEY_MAN: Outfit = { jacket: "#6aab4f", pants: "#2f3a5a", boots: "#1e1b22", hat: "hair", hair: "#5a3b2a", moustache: "#5a3b2a", build: "stout", skin: "#c99067" };
const NEIGH1: Outfit = { jacket: "#b8553a", pants: "#4a4d57", boots: "#1e1b22", hat: "hair", hair: "#c9ccd2", moustache: "#c9ccd2", collar: "#f4f1ea", glasses: true };
const NEIGH2: Outfit = { jacket: "#5a8fc2", pants: "#4a4d57", boots: "#5a3b2a", dress: "#3f6fb5", hat: "hair", hair: "#e6e2da", longHair: "#e6e2da", skin: "#ecd0b6" };
const OKEY = new Map<Outfit, string>();
const okeyOf = (o: Outfit) => { let k = OKEY.get(o); if (!k) { k = "o" + OKEY.size; OKEY.set(o, k); } return k; };

const SIT = 0.3;
const F = (t: number) => t * FPS;
const wob = (t: number, hz: number, ph = 0) => q(Math.sin(2 * Math.PI * hz * t + ph), 8);
const TALK: Expr[] = ["smile", "grin", "smile_closed", "laugh"];
const talk = (t: number, n = 3) => TALK[Math.floor(t * 6) % n];

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
const S = (x: number, y: number, z: number) => R("shop", x, y, z);
/** a fixed (non-billboard) card facing +z */
const wallCard = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, at: V3, w: number, h: number, glow?: number) =>
  out.fx.push({ key, cw, ch, draw, x: at[0], y: at[1], z: at[2], w, h, orient: [0, 0, 0], glow });
const pop = (f: number, f0: number) => (f < f0 ? 0 : q(Math.min(1, smooth((f - f0) / 5) * 1.12 - 0.12 * smooth((f - f0 - 5) / 4)), 20));

// ---- the supermarket: lane signs, the two cashiers ----
const signs = (out: Stage, t: number, swing = 1) => {
  for (const [kind, x, ph] of [["chat", LANE_A, 0], ["fast", LANE_B, 1.7]] as ["chat" | "fast", number, number][]) {
    const a = q(0.025 * swing * Math.sin(t * 1.3 + ph), 200);
    wallCard(out, `lane|${kind}|${a}`, 720, 360, (p) => fxLaneSign(p, kind, a), S(x, 2.62, -1.2), 1.3, 0.65);
  }
};
const CASH_AT: V3 = S(LANE_A - 0.65, 0, -2.05), FAST_AT: V3 = S(LANE_B - 0.65, 0, -2.05), OMA_AT: V3 = S(LANE_A + 0.75, 0, -0.3);
const cashier = (cam: CamInfo, t: number, out: Stage, a: Partial<Act> = {}) => put(cam, t, out, { o: CASHIER, i: 10, at: CASH_AT, facing: 1, look: 1, shadow: false, expr: "smile", ...a });
const oma = (cam: CamInfo, t: number, out: Stage, a: Partial<Act> = {}) => put(cam, t, out, { o: OMA, i: 11, at: OMA_AT, facing: -1, look: -1, expr: "smile", ...a });
const item = (out: Stage, kind: number, x: number, y: number, z: number, s = 0.2) =>
  out.fx.push({ key: `item${kind}`, cw: 200, ch: 200, draw: (p) => fxItem(p, kind), x, y, z, w: s, h: s });

// 1: the slow lane, the cashier listening, Oma chatting
const shot1 = (cam: CamInfo, t: number, out: Stage) => {
  signs(out, t); cashier(cam, t, out, { expr: Math.floor(t * 1.2) % 3 === 2 ? "laugh" : "smile", headTilt: 4 * wob(t, 0.5) });
  oma(cam, t, out, { expr: talk(t) });
  item(out, 0, ...S(LANE_A - 0.1, COUNTER_H + 0.08, -1.2));
};
// 2: the race at the normal lane
const BEEPS = [187, 202, 215, 227, 233];
const shot2 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  signs(out, t);
  const next = f >= 231;
  put(cam, t, out, { o: FASTCASH, i: 12, at: FAST_AT, facing: 1, look: 1, shadow: false, expr: next ? "shock" : Math.floor(f / 3) % 2 ? "nervous" : "grin",
    prop: next ? ["point", 1] : undefined, headTilt: next ? 0 : 6 * wob(t, 3) });
  put(cam, t, out, { o: SHOPPER, i: 13, at: S(LANE_B + 0.75, 0, -0.35), facing: -1, look: -1, expr: f >= 213 ? "shock" : "nervous", prop: f >= 213 ? ["hold", 1] : undefined });
  // groceries: each slides to the scanner and is flung to the bagging end on its beep
  const scanX = LANE_B - 1.3 + 0.62;
  BEEPS.slice(0, 4).forEach((fb, k) => {
    const kind = [1, 2, 4, 3][k];
    if (f < fb - 22 || f > fb + 7) return;
    if (f <= fb) item(out, kind, ...S(scanX + (fb - f) * 0.06, COUNTER_H + 0.1, -1.2), 0.22);
    else { const u = (f - fb) / 7; item(out, kind, ...S(scanX + u * 1.7, COUNTER_H + 0.1 + 0.35 * Math.sin(u * Math.PI), -1.15), 0.22); }
  });
  for (const fb of BEEPS.slice(0, 2)) if (f >= fb - 1 && f < fb + 4) {
    const u = q((f - fb + 1) / 5, 10), [x, y, z] = S(scanX, COUNTER_H + 0.25, -1.1);
    out.fx.push({ key: `beep|${u}`, cw: 400, ch: 400, draw: (p) => fxBurst(p, u, "#ff5a5a", 10, 30, 190), x, y, z, w: 0.5, h: 0.5, soft: true });
  }
};
// 3: golden quay, Oma walks to the shopfront
const shot3 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), ph = q(((f - 244) / 26) % 1, 12);
  putSide(cam, t, out, OMA, 11, [OMA_X(f), D0, QUAY_Z - 0.75], { mode: "march", phase: ph, expr: "smile", stomp: 0.3, stride: 0.42 });
};
// 4: the lane, the cashier waves her in; the sign
const shot4 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  signs(out, t, f >= 452 ? 1.6 : 1);
  cashier(cam, t, out, { expr: "grin", wave: f < 452 ? wob(t, 2.2) : undefined });
  oma(cam, t, out, { expr: "smile" });
};
// 5: one banana; the cashier asks, then waits, chin on her hand
const shot5 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  signs(out, t);
  if (f >= 548) item(out, 0, ...S(LANE_A + 0.25, COUNTER_H + 0.08, -1.2));
  const asking = f >= 592 && f < 632, waiting = f >= 650;
  cashier(cam, t, out, { expr: asking ? talk(t) : waiting ? "smile_closed" : "smile", prop: waiting ? "chin" : undefined, headTilt: waiting ? 7 : 0, swaps: [650 / FPS] });
  oma(cam, t, out, { expr: f >= 668 ? talk(t) : "smile", prop: f < 552 ? ["hold", 1] : undefined });
};
// 6: Oma talks; the bubbles pop in
const BUBS: [number, "sun" | "knee" | "kids" | "cat", number, number][] = [[748, "sun", -1.52, 2.24], [762, "knee", -1.06, 2.28], [783, "kids", -1.56, 1.88], [813, "cat", -1.02, 1.9]];
const shot6 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  signs(out, t); cashier(cam, t, out, { prop: "chin", expr: f >= 815 ? "laugh" : "smile_closed", headTilt: 7 });
  oma(cam, t, out, { expr: f >= 815 ? "laugh" : talk(t), headTilt: 3 * wob(t, 0.7) });
  for (const [f0, icon, x, y] of BUBS) { const k = pop(f, f0); if (k > 0) { const [wx, wy, wz] = S(x, y, -0.15);
    out.fx.push({ key: `th|${icon}|${k}`, cw: 520, ch: 440, draw: (p) => fxThought(p, icon, k), x: wx, y: wy, z: wz, w: 0.42, h: 0.355 }); } }
};
// 7: the trolley man does not sigh; he takes the next till
const shot7 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  signs(out, t); cashier(cam, t, out, { prop: "chin", expr: "smile_closed", headTilt: 7 }); oma(cam, t, out, { expr: talk(t) });
  put(cam, t, out, { o: FASTCASH, i: 12, at: FAST_AT, facing: 1, look: 1, shadow: false, expr: f >= 935 ? "grin" : "smile", wave: f >= 935 ? wob(t, 2.2) : undefined });
  const walk = f >= 905, x = walk ? Math.min(2.2, 0.45 + (f - 905) * 0.045) : 0.45, z = 0.55;
  if (walk && x < 2.2) {
    putSide(cam, t, out, TROLLEY_MAN, 14, S(x, 0, z), { mode: "march", phase: q(((f - 905) / 22) % 1, 12), expr: "smile", stomp: 0.4, stride: 0.5 });
    trolley(out, S(x + 0.62, 0, z + 0.05), false);
  } else {
    put(cam, t, out, { o: TROLLEY_MAN, i: 14, at: S(x, 0, z), facing: walk ? 1 : -1, look: walk ? 1 : -1, expr: f >= 868 && f < 900 ? "relief_open" : "smile" });
    trolley(out, walk ? S(x + 0.62, 0, z + 0.05) : S(x - 0.6, 0, z + 0.05), !walk);
  }
};
const trolley = (out: Stage, at: V3, mirror: boolean) => {
  out.fx.push({ key: `trolley|${mirror}`, cw: 600, ch: 520, draw: (p) => { if (mirror) { p.g.translate(600, 0); p.g.scale(-1, 1); } fxTrolley(p); },
    x: at[0], y: at[1] + 0.47, z: at[2], w: 1.0, h: 0.87 });
  blob(out, at[0], at[1], at[2], 1.3, 0.6);
};
// 8: waves goodbye
const shot8 = (cam: CamInfo, t: number, out: Stage) => {
  signs(out, t); cashier(cam, t, out, { expr: "grin", wave: wob(t, 2.3) }); oma(cam, t, out, { expr: "laugh", wave: wob(t, 2.0, 1) });
};
// 9: the map poster: one dot, then two hundred more
const shot9 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), n = 1 + Math.round(199 * smooth((f - 1118) / 46));
  wallCard(out, `map|${n}`, 600, 760, (p) => fxMap(p, n), S(0, 2.05, -5.93), 1.66, 2.1);
};
// 10: the coffee corner
const shot10 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), laugh = f >= 1252;
  put(cam, t, out, { o: NEIGH1, i: 15, at: S(4.35, 0, 2.05), mode: "sit", seat: 0.46, nudge: 0.1, shadow: false, facing: 1, look: 1, prop: "mug", expr: laugh ? "laugh" : talk(t + 0.4) });
  put(cam, t, out, { o: NEIGH2, i: 16, at: S(5.25, 0, 2.05), mode: "sit", seat: 0.46, nudge: 0.1, shadow: false, facing: -1, look: -1, prop: "mug", expr: laugh ? "laugh" : "smile" });
};
// 11-12: home at dusk, alone; thinking of the cashier
const shot11 = (cam: CamInfo, t: number, out: Stage, think: boolean) => {
  const f = F(t);
  put(cam, t, out, { o: OMA, i: 11, at: R("home", -0.6, 0, -2.35), mode: "sit", expr: think ? (f >= 1530 ? "smile_closed" : "neutral") : f >= 1440 ? "sad" : "neutral", look: think ? 1 : 0, swaps: [1440 / FPS, 1530 / FPS] });
  if (think) { const k = pop(f, 1512); if (k > 0) { const [x, y, z] = R("home", -0.08, 1.78, -2.0);
    out.fx.push({ key: `th|face|${k}`, cw: 520, ch: 440, draw: (p) => fxThought(p, "face", k, CASHIER), x, y, z, w: 0.5, h: 0.42 }); } }
};
// 13: dusk quay, the shutter comes down over the lit windows
const shot13 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), k = q(smooth((f - 1698) / 52), 60);
  wallCard(out, `shutter|${k}`, 800, 300, (p) => fxShutter(p, k), [SHOP_X, D0 + 1.62, SHOP_Z + 0.62], 7.5, 3.2);
};
// 14: three in the morning: Oma in her armchair; the phone
let camLook: V3 = [0, 0, 0];
const shot14 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: OMA, i: 11, at: R("homeN", -0.4, 0, -1.75), mode: "sit", seat: 0.42, prop: "phone", expr: f >= 2031 ? "relief_open" : "smile", shadow: false });
  if (f < 1800) return;
  const pose = f >= 1828 && f < 1880 ? "wave" : f >= 1987 && f < 2031 ? "listen" : f >= 1934 && f < 1987 ? "ask" : "smile";
  const [icon, f0]: [BubbleIcon, number] = f >= 2031 ? ["heart", 2031] : f >= 1987 ? ["dots", 1987] : f >= 1934 ? ["ask", 1934] : f >= 1889 ? ["cat", 1889] : ["dots", 99999];
  const bb = f >= f0 ? q(smooth((f - f0) / 6), 8) : 0;
  const blink = lidAt(t, 9) >= 1 ? 1 : 0, wv = pose === "wave" ? wob(t, 2.2) : 0;
  out.fx.push({ key: `phone|${pose}|${blink}|${wv}|${bb}|${icon}`, cw: 500, ch: 1000, draw: (p) => fxPhone(p, pose, blink, wv, bb, icon, "3:00"),
    x: camLook[0], y: camLook[1] - 0.005, z: camLook[2], w: 0.139, h: 0.278, rot: 0.025, front: true });
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (cam.quat) { const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quat); camLook = [cam.pos.x + fw.x * 0.45, cam.pos.y + fw.y * 0.45, cam.pos.z + fw.z * 0.45]; }
  switch (id) {
    case 1: shot1(cam, t, out); break;
    case 2: shot2(cam, t, out); break;
    case 3: shot3(cam, t, out); break;
    case 4: shot4(cam, t, out); break;
    case 5: shot5(cam, t, out); break;
    case 6: shot6(cam, t, out); break;
    case 7: shot7(cam, t, out); break;
    case 8: shot8(cam, t, out); break;
    case 9: shot9(cam, t, out); break;
    case 10: shot10(cam, t, out); break;
    case 11: shot11(cam, t, out, false); break;
    case 12: shot11(cam, t, out, true); break;
    case 13: shot13(cam, t, out); break;
    case 14: shot14(cam, t, out); break;
  }
  return out;
};
export { FPS };
