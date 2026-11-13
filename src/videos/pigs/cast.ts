// Our cast as lit flat sprites in the 3D world (template: canvas pool, cardShade cards, contact blobs, blinks).
// stage(id, t, cam) says who is where, in which pose and expression, for every shot of the ELIZA -> Feeloy short.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxPhone, fxShadow, fxContact, fxBadge, fxBubble, fxNope, fxPig, PigLook, fxStamp, fxFlagCH, fxLaw, fxCycle, fxSuitcase,
  fxRentSign, fxBurst, Outfit, Expr, FrontOpts, SideOpts, Prop, BubbleIcon } from "./toon";
import { FPS, D0, SHOTS, V3, R, MX, MZ, TRAY_Y, PIG_A, PIG_B, smooth, clamp01 } from "./story";
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
// ======================= cast of "Illegal to Be Lonely" =======================
const OWNER: Outfit = { jacket: "#f2c94c", pants: "#3b3f52", boots: "#f4f1ea", hat: "hair", hair: "#5a3b2a", ponytail: "#5a3b2a", skin: "#f5d6be" };
const PRISKA: Outfit = { jacket: "#2f8f5a", pants: "#4a4d57", boots: "#5a3b2a", dress: "#d8433e", hat: "hair", hair: "#c9874e", glasses: true, skin: "#f5d6be" };
const LONER: Outfit = { jacket: "#5a8fc2", pants: "#2f3a5a", boots: "#f4f1ea", hat: "hair", hair: "#2a2230", longHair: "#2a2230", skin: "#c99067" };
const PIGS: PigLook[] = [{ fur: "#c9874e", patch: "#f4f1ea" }, { fur: "#3a2a22", patch: "#f4f1ea" }, { fur: "#e0a35a" }, { fur: "#f4f1ea", patch: "#d9a05a" }, { fur: "#8a5a34", patch: "#e9d6a0" }];
const GRANDPA: PigLook = { fur: "#9a8f86", patch: "#e6e2da", old: true };
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
let camLook: V3 = [0, 0, 0];
/** a guinea pig card standing on a floor at height y0 (card w, h = .75 w; the soles sit at 0.9 of the card) */
const pig = (out: Stage, key: string, o: PigLook, x: number, y0: number, z: number, w = 0.2, k = 1) => {
  if (k <= 0) return;
  const lk = { ...o, alpha: o.alpha === undefined ? 1 : q(o.alpha, 30), hop: q(o.hop ?? 0, 30) };
  card(out, `pig|${key}|${JSON.stringify(lk)}`, 400, 300, (p) => fxPig(p, lk), [x, y0 + 0.75 * w * k * 0.4, z], w * k, 0.75 * w * k);
};
const trayPig = (out: Stage, key: string, o: PigLook, at: [number, number], k = 1, dx = 0) => { const [x, y, z] = Fl(at[0] + dx, TRAY_Y, at[1]); pig(out, key, o, x, y, z, 0.27, k); };
const strike = (out: Stage, word: string, f: number, f0: number, fs: number, at: V3, w: number) => { const k = pop(f, f0); if (k > 0) { const st = q(clamp01((f - fs) / 8), 16);
  card(out, `nope|${word}|${k}|${st}`, 520, 180, (p) => fxNope(p, word, st), at, w * k, w * 0.346 * k); } };
const owner = (cam: CamInfo, t: number, out: Stage, a: Partial<Act> = {}) =>
  put(cam, t, out, { o: OWNER, i: 10, at: Fl(1.6, 0, -2.2), mode: "sit", seat: 0.42, nudge: 0.08, shadow: false, expr: "smile", ...a });
const pennant = (out: Stage, t: number) => card(out, `flag|${q(t % 1, 12)}`, 300, 300, (p) => fxFlagCH(p, t % 1), Fl(2.04, 0.74, -1.12), 0.12, 0.12, true);

// 1: one guinea pig; ILLEGAL
const shot1 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  pennant(out, t);
  trayPig(out, "A", { ...PIGS[0], expr: f >= 42 ? "shock" : "happy" }, [1.64, -1.0]);
  if (f >= 38) { const k = q(smooth((f - 38) / 5), 10); card(out, `stamp|${k}`, 600, 260, (p) => fxStamp(p, "ILLEGAL", k), Fl(1.65, 0.86, -0.86), 0.44, 0.19); }
};
// 2: the reason? LONELY
const shot2 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  trayPig(out, "A", { ...PIGS[0], expr: f >= 160 ? "sad" : "happy" }, PIG_A);
  if (f < 158) bubble(out, "ask", pop(f, 118), Fl(1.62, 0.84, -1.02), 0.16);
  else badge(out, "LONELY", "#5a8fc2", pop(f, 160), Fl(1.47, 0.84, -1.0), 0.3);
};
// 3: the law; a friend of its own kind
const shot3 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  pennant(out, t);
  trayPig(out, "A", { ...PIGS[0], expr: f >= 286 ? "love" : "sad" }, PIG_A);
  if (f < 276) { const k = pop(f, 190); if (k > 0) card(out, `law|${k}`, 420, 360, (p) => fxLaw(p), Fl(1.65, 0.88, -1.05), 0.26 * k, 0.223 * k); }
  else { trayPig(out, "B", { ...PIGS[1], expr: "love", mirror: true }, PIG_B, pop(f, 278)); bubble(out, "heart", pop(f, 298), Fl(1.65, 0.86, -1.0), 0.16); }
};
// 4: love it, talk to it: DOESN'T COUNT
const shot4 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  owner(cam, t, out, { prop: "sign", expr: f >= 403 ? "nervous" : "grin", headTilt: 8, swaps: [403 / FPS] });
  const [x, y, z] = Fl(1.6, 0.86, -1.85); pig(out, "held", { ...PIGS[0], expr: f >= 403 ? "sad" : "love" }, x, y, z, 0.3);
  if (f < 354) bubble(out, "heart", pop(f, 342), Fl(2.05, 1.72, -2.05), 0.36); else if (f < 400) bubble(out, "note", pop(f, 354), Fl(2.05, 1.72, -2.05), 0.36);
  strike(out, "DOESN'T COUNT", f, 401, 414, Fl(1.6, 1.8, -1.85), 0.95);
};
// 5: one goes; the owner is BREAKING THE LAW
const shot5 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  owner(cam, t, out, { expr: f >= 556 ? "shock" : f >= 519 ? "sad" : "smile", swaps: [519 / FPS, 556 / FPS] });
  trayPig(out, "A", { ...PIGS[0], expr: f >= 530 ? "sad" : "happy" }, PIG_A);
  const al = 1 - clamp01((f - 517) / 26); if (al > 0) trayPig(out, "B", { ...PIGS[1], expr: "happy", mirror: true, alpha: al, hop: 0.6 * (1 - al) }, PIG_B);
  if (f >= 517 && f < 545) { const k = q((f - 517) / 28, 28); card(out, `spark|${k}`, 500, 500, (p) => fxBurst(p, k, "#ffffff", 8, 20, 160), Fl(PIG_B[0], 0.75, -1.0), 0.3, 0.3); }
  badge(out, "LAWBREAKER!", "#d8433e", pop(f, 571), Fl(1.55, 1.72, -1.6), 0.75);
};
// 6: buy a young one: the cycle
const shot6 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  owner(cam, t, out, { expr: f >= 664 ? "dazed" : "nervous", headTilt: 6 * wob(t, 0.7) });
  card(out, `cycle|${q(((f - 614) / 60) % 1, 60)}`, 500, 500, (p) => fxCycle(p, ((f - 614) / 60) % 1), Fl(1.6, 1.68, -2.0), 0.62, 0.62);
  ([[621, 1.1, 1.8], [644, 2.1, 1.8], [660, 1.1, 1.3], [672, 2.1, 1.3]] as [number, number, number][]).forEach(([f0, x, y], i) => {
    const [px, py, pz] = Fl(x, y - 0.08, -1.9); pig(out, `cyc${i}`, { ...PIGS[(i + 2) % PIGS.length], expr: "grin" }, px, py, pz, 0.28, pop(f, f0)); });
};
// 7: Priska's chalet: TEACHER, 80 GUINEA PIGS
const LAWN: [number, number][] = [[-1.5, 3.0], [-0.9, 3.9], [0.4, 3.4], [1.1, 4.2], [1.3, 2.8], [-1.6, 4.6], [0.0, 4.7], [1.6, 3.6], [-0.4, 5.3], [0.9, 5.2]];
const shot7 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: PRISKA, i: 20, at: E(-0.3, 0, 2.2), expr: f >= 735 ? "grin" : "smile", wave: f >= 699 && f < 760 ? wob(t, 2.2) : undefined });
  badge(out, "TEACHER", "#3f6fb5", pop(f, 735), E(-0.3, 2.55, 2.3), 1.3);
  badge(out, "80 GUINEA PIGS", "#f272b0", pop(f, 786), E(0, 3.15, 2.0), 1.9);
  LAWN.forEach(([x, z], i) => { const [px, py, pz] = E(x, 0, z); pig(out, `lawn${i}`, { ...PIGS[i % PIGS.length], expr: "happy", mirror: i % 2 === 1 }, px, py, pz, 0.55, pop(f, 790 + i * 3)); });
};
// 8: RENT-A-GUINEA-PIG
const shot8 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: PRISKA, i: 20, at: E(-0.75, 0, 1.6), facing: 1, look: 1, expr: "grin", prop: ["point", q(clamp01((f - 836) / 8), 16)] });
  const k = pop(f, 839); if (k > 0) card(out, `rent|${k}`, 900, 300, (p) => fxRentSign(p), E(0.3, 3.55, 0.1), 2.6 * k, 0.867 * k, true);
  LAWN.slice(0, 5).forEach(([x, z], i) => { const [px, py, pz] = E(x * 0.5 + 0.6, 0, z * 0.4 + 1.2); pig(out, `lawn${i}`, { ...PIGS[i % PIGS.length], expr: "happy", mirror: i % 2 === 1 }, px, py, pz, 0.42); });
};
// 9: a roommate arrives in a suitcase; later it goes home
const shot9 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  pennant(out, t);
  const al = 1 - clamp01((f - 958) / 26);
  if (al > 0) trayPig(out, "A", { ...PIGS[0], expr: f >= 915 ? "love" : "sad", alpha: al }, PIG_A);
  const suit = (x: number) => card(out, `suit|${PIGS[3].fur}`, 360, 300, (p) => fxSuitcase(p, PIGS[3].fur), Fl(x, TRAY_Y + 0.1, -0.95), 0.26, 0.22);
  if (f < 913) { if (f >= 899) suit(2.5 - 0.68 * smooth((f - 899) / 13)); }
  else if (f < 995) { trayPig(out, "B", { ...PIGS[3], expr: f >= 960 ? "sad" : "love", mirror: true }, PIG_B); if (f < 958) bubble(out, "heart", pop(f, 915), Fl(1.65, 0.78, -1.0), 0.14); }
  else suit(1.82 + 0.8 * smooth((f - 999) / 22));
};
// 10: MATCHMAKER; grandpa + a young friend
const shot10 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  if (f < 1093) {
    put(cam, t, out, { o: PRISKA, i: 20, at: E(-0.9, 0, 1.7), prop: "sign", expr: "grin", headTilt: 6 });
    const [x, y, z] = E(-0.9, 0.83, 1.95); pig(out, "held", { ...PIGS[2], expr: "love" }, x, y, z, 0.32);
    badge(out, "MATCHMAKER", "#f272b0", pop(f, 1041), E(-0.9, 2.45, 1.85), 1.3);
    return;
  }
  const happy = f >= 1167;
  { const [x, y, z] = E(1.6, 0, 3.3); pig(out, "grandpa", { ...GRANDPA, expr: happy ? "grin" : "tired", hop: happy ? Math.max(0, Math.sin((f - 1167) / 4)) * 0.4 : 0 }, x, y, z, 0.3); }
  if (f >= 1134) { const m = smooth((f - 1134) / 18), x0 = 2.55 - 0.6 * m, hop = f < 1152 ? Math.abs(Math.sin((f - 1134) / 3)) : 0;
    const [x, y, z] = E(x0, 0, 3.3); pig(out, "young", { ...PIGS[2], expr: "grin", mirror: true, hop }, x, y, z, 0.26); }
  if (happy) bubble(out, "heart", pop(f, 1174), E(1.77, 0.48, 3.25), 0.2);
};
// 11: the whole country: pairs everywhere
const PAIRS: [number, number][] = [[-1.4, 5.0], [1.2, 6.0], [-0.9, 7.6], [1.5, 8.6], [-1.6, 9.4], [0.3, 10.2]];
const shot11 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  card(out, `bigflag|${q(t % 1, 12)}`, 300, 300, (p) => fxFlagCH(p, t % 1), E(4.5, 5.5, 1.4), 1.0, 1.0, true);
  PAIRS.forEach(([x, z], i) => {
    for (const s0 of [0, 1]) { const [px, py, pz] = E(x + (s0 ? 0.26 : -0.26), 0, z); pig(out, `pair${i}${s0}`, { ...PIGS[(i * 2 + s0) % PIGS.length], expr: "love", mirror: s0 === 1 }, px, py, pz, 0.5); }
    bubble(out, "heart", pop(f, 1201 + i * 12), E(x, 0.78, z), 0.36);
  });
};
// 12: a lonely flat at night; then Jenny
const shot12 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: LONER, i: 14, at: R("homeN", -0.4, 0, -1.75), mode: "sit", seat: 0.42, prop: "phone", shadow: false, expr: f >= 1366 ? "smile" : "sad", swaps: [1366 / FPS] });
  if (f < 1386) { bubble(out, "dots", pop(f, 1338), R("homeN", 0.2, 1.75, -1.6), 0.42); return; }
  const pose = f >= 1414 && f < 1440 ? "wave" : f >= 1462 && f < 1494 ? "listen" : "smile";
  const [icon, f0]: [BubbleIcon, number] = f >= 1494 ? ["heart", 1494] : ["dots", 99999];
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
  const SH = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8, shot9, shot10, shot11, shot12];
  SH[id - 1]?.(cam, t, out);
  return out;
};
export { FPS };
