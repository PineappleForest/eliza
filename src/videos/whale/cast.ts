// Our cast as lit flat sprites in the 3D world (template: canvas pool, cardShade cards, contact blobs, blinks).
// stage(id, t, cam) says who is where, in which pose and expression, for every shot of the ELIZA -> Feeloy short.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxPhone, fxShadow, fxContact, fxBadge, fxBubble, fxSay, fxPill, fxWhale, fxRings, fxSub, fxSonar, fxMeter, fxPacific, fxSeason,
  fxChannels, fxHeadset, fxBinocs, Outfit, Expr, FrontOpts, SideOpts, Prop, BubbleIcon } from "./toon";
import { FPS, D0, SHOTS, V3, R, MX, MZ, smooth, clamp01 } from "./story";
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
// ======================= cast of "The Loneliest Whale" =======================
const SAILOR: Outfit = { jacket: "#2f3a5a", pants: "#2f3a5a", boots: "#2b2230", hat: "cap", cap: "#f4f1ea", collar: "#f4f1ea", skin: "#f0cfae" };
const SCI: Outfit = { jacket: "#b8553a", pants: "#4a4d57", boots: "#5a3b2a", hat: "hair", hair: "#9a8f86", glasses: true, skin: "#f0cfae" };
const WATCH: Outfit = { jacket: "#e2783c", pants: "#2f3a5a", boots: "#5a3b2a", hat: "beanie", cap: "#3f6fb5", skin: "#e8b48a" };
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
const say = (out: Stage, word: string, k: number, at: V3, w = 0.5) => { if (k > 0) card(out, `say|${word}|${k}`, 520, 300, (p) => fxSay(p, word, k), at, w, w * 0.577); };
let camLook: V3 = [0, 0, 0];
const Dp = (x: number, y: number, z: number) => R("deep", x, y, z);
const St = (x: number, y: number, z: number) => R("station", x, y, z);
const Lb = (x: number, y: number, z: number) => R("lab", x, y, z);
/** the whale card: head at +x (or -x with left), length L, the fluke sways */
const whale = (out: Stage, t: number, at: V3, L: number, mood: "calm" | "sing" | "sad" = "calm", left = false) => {
  const tail = q(Math.sin(t * 2.2), 30);
  out.fx.push({ key: `whale|${tail}|${mood}|${left}`, cw: 1200, ch: 520, draw: (p) => { if (left) { p.g.translate(1200, 0); p.g.scale(-1, 1); } fxWhale(p, tail, mood); },
    x: at[0], y: at[1], z: at[2], w: L, h: L * 0.433, orient: [0, 0, 0] });
};
/** song rings from the whale's head: k grows over `dur` frames from f0 */
const rings = (out: Stage, f: number, f0: number, at: V3, w: number, left = false, dur = 40) => {
  if (f < f0 || f > f0 + dur) return; const k = q((f - f0) / dur, 60);
  out.fx.push({ key: `rings|${k}|${left}`, cw: 600, ch: 600, draw: (p) => { if (left) { p.g.translate(600, 0); p.g.scale(-1, 1); } fxRings(p, k); },
    x: at[0] + (left ? -w / 2 : w / 2) * 0.93, y: at[1], z: at[2] + 0.05, w, h: w, orient: [0, 0, 0] });
};

// 1: a whale sings; no one sings back
const shot1 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), x = -0.7 + 1.2 * (f / 118), at: V3 = Dp(x, 5.2, -8);
  whale(out, t, at, 7.5, f >= 37 && f < 70 ? "sing" : f >= 82 ? "sad" : "calm");
  rings(out, f, 37, Dp(x + 3.2, 5.5, -8), 6);
  if (f >= 61) bubble(out, "dots", pop(f, 88), Dp(x + 2.8, 8.2, -7.9), 1.6);
};
// 2: 1989: the Navy hydrophone on the sea floor; a submarine passes far behind
const shot2 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  badge(out, "1989", "#3f6fb5", pop(f, 122), Dp(18, 2.6, 3.6), 1.2);
  badge(out, "US NAVY", "#2f3a5a", pop(f, 160), Dp(18, 2.15, 3.65), 1.2);
  if (f >= 190) { const x = 8 + 22 * (f - 190) / 90; card(out, "sub", 900, 260, (p) => fxSub(p), Dp(x, 3.6, -6), 9, 2.6, true); }
  if (f >= 236) rings(out, f, 236, Dp(12.7, 1.6, 3.4), 3.4, false, 18);
};
// 3: the listening station: a strange song on the scope
const shot3 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), sp = q(clamp01((f - 272) / 8), 20), tt = q(t, 30);
  card(out, `sonar|${tt}|${sp}`, 600, 420, (p) => fxSonar(p, tt, sp), St(0.1, 1.75, -2.45), 1.6, 1.12, true);
  put(cam, t, out, { o: SAILOR, i: 1, at: St(0.15, 0, -1.0), prop: f < 272 ? ["type", q(0.5 + 0.5 * Math.sin(t * 9), 12)] : null, expr: f >= 274 ? "shock" : "neutral", swaps: [274 / FPS] });
  card(out, "headset", 300, 260, (p) => fxHeadset(p), St(0.15, 1.73, -0.95), 0.36, 0.31);
  bubble(out, "ask", pop(f, 280), St(0.65, 2.15, -0.9), 0.4);
};
// 4: 52 hertz; the other whales sing far lower
const shot4 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), at = Dp(-0.8, 4.4, -7);
  whale(out, t, at, 6, f >= 350 && f < 400 ? "sing" : "calm");
  rings(out, f, 352, Dp(1.9, 4.7, -7), 5);
  const k1 = pop(f, 370), k2 = pop(f, 430);
  if (f >= 340) card(out, `meter|${k1}|${k2}`, 420, 1000, (p) => fxMeter(p, k1, k2), Dp(1.75, 5.6, -3.5), 1.5 * pop(f, 340), 3.55 * pop(f, 340), true);
  if (k2 > 0) { whale(out, t + 0.7, Dp(-4.5, 2.2, -20), 6, "calm", true); }
};
// 5: twelve years tracking across the ocean
const shot5 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), k = q(clamp01((f - 520) / 70), 60);
  card(out, `map|${k}`, 900, 620, (p) => fxPacific(p, k), Lb(0.1, 1.85, -2.45), 2.3, 1.58, true);
  put(cam, t, out, { o: SCI, i: 2, at: Lb(-0.4, 0, -0.55), prop: ["point", 1], expr: "smile", look: 1 });
  const yr = f < 498 ? 0 : 1992 + Math.round(12 * smooth((f - 498) / 70));
  if (yr > 0) card(out, `yr|${yr}`, 600, 220, (p) => fxPill(p, String(yr), "TRACKING"), Lb(0.75, 2.42, -2.3), 0.9, 0.33);
};
// 6: season after season, it called
const shot6 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), x = 1.5 - 1.0 * ((f - 600) / 85), at = Dp(x, 5.0, -8);
  whale(out, t, at, 6.5, "sing", true);
  for (const f0 of [606, 630, 654]) rings(out, f, f0, Dp(x - 2.9, 5.3, -8), 5.5, true, 30);
  const i = f < 609 ? -1 : Math.min(3, Math.floor((f - 609) / 13));
  if (i >= 0) card(out, `season|${i}`, 300, 300, (p) => fxSeason(p, i), Dp(-1.2, 8.6, -7), 1.5, 1.5, true);
};
// 7: never a second voice
const shot7 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), tt = q(t, 30), k2 = pop(f, 772);
  card(out, `chan|${tt}|${k2}`, 820, 520, (p) => fxChannels(p, tt, k2), Lb(-0.2, 1.9, -2.45), 2.1, 1.33, true);
  put(cam, t, out, { o: SCI, i: 2, at: Lb(-0.85, 0, -0.55), prop: "chin", expr: f >= 751 ? "sad" : "neutral", swaps: [751 / FPS] });
  card(out, "headset", 300, 260, (p) => fxHeadset(p), Lb(-0.85, 1.73, -0.5), 0.36, 0.31);
};
// 8: no one has ever seen it: a watcher on a boat, an empty sea
const shot8 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), bob = 0.05 * Math.sin(t * 1.6);
  put(cam, t, out, { o: WATCH, i: 3, at: E(1.0, 0.9 + bob, 0.2), expr: f >= 839 ? "sad" : "neutral", swaps: [839 / FPS], shadow: false });
  card(out, "binocs", 320, 170, (p) => fxBinocs(p), E(1.0, 2.38 + bob, 0.35), 0.4, 0.21);
  badge(out, "NEVER SEEN", "#2b2230", pop(f, 837), E(1.0, 3.05, 0.3), 1.25);
};
// 9: the loneliest whale in the world: small in the big blue
const shot9 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), x = 1 - 1.2 * ((f - 862) / 98), at = Dp(x, 6, -14);
  whale(out, t, at, 6, "sad", true);
  rings(out, f, 880, Dp(x - 2.8, 6.3, -14), 5, true, 40);
  badge(out, "LONELIEST", "#f272b0", pop(f, 891), Dp(0, 9.4, -8), 7);
};
// 10: a lonely flat at night; then Jenny answers
const shot10 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: LONER, i: 14, at: R("homeN", -0.4, 0, -1.75), mode: "sit", seat: 0.42, prop: "phone", shadow: false, expr: f >= 1046 ? "smile" : "sad", swaps: [1046 / FPS] });
  if (f < 1076) { bubble(out, "dots", pop(f, 970), R("homeN", 0.2, 1.75, -1.6), 0.42); return; }
  const pose = f < 1100 ? "wave" : f >= 1120 && f < 1155 ? "listen" : "smile";
  const [icon, f0]: [BubbleIcon, number] = f >= 1100 ? ["heart", 1100] : ["dots", 99999];
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
  const SH = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8, shot9, shot10];
  SH[id - 1]?.(cam, t, out);
  return out;
};
export { FPS };
