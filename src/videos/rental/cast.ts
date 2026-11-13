// Our cast as lit flat sprites in the 3D world (template: canvas pool, cardShade cards, contact blobs, blinks).
// stage(id, t, cam) says who is where, in which pose and expression, for every shot of the ELIZA -> Feeloy short.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxPhone, fxShadow, fxContact, fxTag, fxNightlight, fxNote, COMPANION, KID, INK,
  Outfit, Expr, FrontOpts, SideOpts, Prop } from "./toon";
import { FPS, D0, SHOTS, V3, R, BENCH, QUAY_Z, LINEUP, STAGE_Y, QX_AT, COUPLE_X, GIRL_BENCH_X, smooth, clamp01 } from "./story";
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
// ======================= cast of "Rent a Dad" =======================
const DAD: Outfit = { jacket: "#2f3a5a", pants: "#2f3a5a", boots: "#1e1b22", hat: "hair", hair: "#2a2230", collar: "#ffffff", glasses: true, skin: "#f5d6be" };
const BOSS: Outfit = { jacket: "#6b6f7a", pants: "#4a4d57", boots: "#1e1b22", hat: "hair", hair: "#8a8f98", moustache: "#5a5f68", collar: "#ffffff", build: "stout" };
const GUESTW: Outfit = { jacket: "#c25a7a", pants: "#3b3f52", boots: "#5a3b2a", dress: "#e8a0b8", hat: "hair", hair: "#3a2a22", longHair: "#3a2a22" };
const HUSB: Outfit = { jacket: "#5a8fc2", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#3a2a22", collar: "#f2f0ea", skin: "#ecd0b6" };
const SON: Outfit = { jacket: "#d9a441", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#1e1b22", skin: "#f5c9a0" };
const GIRLKID: Outfit = { jacket: "#f272b0", pants: "#3b5b9a", boots: "#f4f1ea", hat: "hair", hair: "#2a2230", longHair: "#2a2230", build: "kid", skin: "#f5d6be" };
const GROOM: Outfit = { jacket: "#f4f2ec", pants: "#f4f2ec", boots: "#1e1b22", hat: "hair", hair: "#2a2230", collar: "#c9ccd2", skin: "#f5c9a0" };
const EMP: Outfit = { jacket: "#3f6fb5", pants: "#2f3a5a", boots: "#1e1b22", hat: "hair", hair: "#2f2a26", collar: "#ffffff", skin: "#ecd0b6" };
const CLIENT: Outfit = { jacket: "#2b2b33", pants: "#2b2b33", boots: "#1e1b22", hat: "hair", hair: "#5a5f68", collar: "#ffffff", glasses: true };
const WOMAN2: Outfit = { jacket: "#c25a7a", pants: "#3b3f52", boots: "#5a3b2a", dress: "#d9a441", hat: "hair", hair: "#5a3b2a", longHair: "#5a3b2a", skin: "#f5d6be" };
const STAFF: Outfit = { jacket: "#1e1b22", pants: "#1e1b22", boots: "#1e1b22", hat: "hair", hair: "#2a2230", collar: "#ffffff", glasses: true };
const GRANNY: Outfit = { jacket: "#8a6fb0", pants: "#4a4d57", boots: "#5a3b2a", dress: "#6f5a96", hat: "hair", hair: "#d9d4cc", glasses: true, skin: "#f5d6be" };
const KID2: Outfit = { jacket: "#9fc3e6", pants: "#9fc3e6", boots: "#f4f1ea", hat: "hair", hair: "#3a2a22", build: "kid", skin: "#f5c9a0" };
const FOUNDER: Outfit = { jacket: "#1e1b22", pants: "#1e1b22", boots: "#1e1b22", hat: "hair", hair: "#1e1b22", collar: "#ffffff" };
const GIRL: Outfit = { jacket: "#f2c94c", pants: "#3b5b9a", boots: "#f4f1ea", hat: "hair", hair: "#2a2230", longHair: "#2a2230", skin: "#f5d6be" };
const GUESTS: Outfit[] = [
  { jacket: "#2f3a5a", pants: "#2f3a5a", boots: "#1e1b22", hat: "hair", hair: "#2a2230", collar: "#ffffff" },
  { jacket: "#3f8f8a", pants: "#3b3f52", boots: "#5a3b2a", dress: "#3f8f8a", hat: "hair", hair: "#5a3b2a", longHair: "#5a3b2a" },
  { jacket: "#4a4d57", pants: "#4a4d57", boots: "#1e1b22", hat: "hair", hair: "#8a8f98", glasses: true, collar: "#ffffff" },
  { jacket: "#c25a7a", pants: "#3b3f52", boots: "#5a3b2a", dress: "#e8a0b8", hat: "hair", hair: "#2a2230", longHair: "#2a2230", skin: "#ecd0b6" },
  { jacket: "#1e1b22", pants: "#1e1b22", boots: "#1e1b22", hat: "hair", hair: "#3a2a22", collar: "#ffffff", skin: "#f5c9a0" },
  { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#5a3b2a", dress: "#9a7ad9", hat: "hair", hair: "#e0b050", longHair: "#e0b050" },
];
const MODERN: Outfit[] = [
  { jacket: "#e86e5a", pants: "#3b5b9a", boots: "#f4f1ea", hat: "hair", hair: "#2a2230" },
  { jacket: "#5a8fc2", pants: "#3b3f52", boots: "#f4f1ea", hat: "hair", hair: "#8a4a2a", longHair: "#8a4a2a", skin: "#ecd0b6" },
  { jacket: "#6aab4f", pants: "#2f3a5a", boots: "#1e1b22", hat: "hair", hair: "#1e1b22", skin: "#c99067" },
  { jacket: "#c25a7a", pants: "#3b5b9a", boots: "#f4f1ea", hat: "hair", hair: "#e0b050", longHair: "#e0b050" },
];
const OKEY = new Map<Outfit, string>();
const okeyOf = (o: Outfit) => { let k = OKEY.get(o); if (!k) { k = "o" + OKEY.size; OKEY.set(o, k); } return k; };

const SIT = 0.3;
const F = (t: number) => t * FPS;
const wob = (t: number, hz: number, ph = 0) => q(Math.sin(2 * Math.PI * hz * t + ph), 8);
const sideOf = (cam: CamInfo, a: V3, b: V3) => ((b[0] - a[0]) * cam.right.x + (b[2] - a[2]) * cam.right.z >= 0 ? 1 : -1);

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
/** side view (bows, walks): faces screen-right unless `left` */
const putSide = (cam: CamInfo, t: number, out: Stage, o: Outfit, i: number, at: V3, so: SideOpts, left = false, scale = 1) => {
  const pl = person(cam, { i, o, okey: okeyOf(o) }, at[0], at[1], at[2], { side: true, mirror: left }, {}, { ...so, blink: lidAt(t, i) }, scale);
  const bow = so.mode === "stand" ? so.pose ?? 0 : 0;
  if (bow > 0) { // a deep bow reaches past the 600-unit canvas: draw shifted back, move the card forward by the same amount
    const sh = 170 * bow, draw = pl.draw, s = (left ? -1 : 1) * sh * SU * scale;
    pl.draw = (p) => { p.g.save(); p.g.translate(-sh, 0); draw(p); p.g.restore(); };
    pl.key += `|bow${q(bow, 20)}`; pl.x += cam.right.x * s; pl.z += cam.right.z * s;
  }
  out.places.push(pl); blob(out, at[0], at[1], at[2], scale);
};
const tag = (out: Stage, x: number, y: number, z: number, i: number, t: number) =>
  out.fx.push({ key: `tag|${q(0.15 * Math.sin(t * 2.2 + i), 12)}`, cw: 240, ch: 220, draw: (p) => fxTag(p, q(0.15 * Math.sin(t * 2.2 + i), 12)), x, y, z, w: 0.2, h: 0.183 });

// ---- 1 + 14: the showroom lineup (+ 11: empty, the founder at his desk) ----
const LINE: Outfit[] = [GUESTW, BOSS, DAD, HUSB, SON];
const lineup = (cam: CamInfo, t: number, out: Stage, callback: boolean) => {
  const f = F(t);
  LINE.forEach((o, k) => {
    const x = LINEUP[k], at: V3 = R("show", x, STAGE_Y + 0.044, -3.0 - (k % 2) * 0.06); // on the spot disc; alternate depth so overlapping cards never share a plane
    const dad = k === 2;
    if (callback) put(cam, t, out, { o, i: 10 + k, at, expr: f > 1768 && k % 2 ? "nervous" : "neutral", prop: "watch", look: k < 2 ? 1 : k > 2 ? -1 : 0 });
    else put(cam, t, out, { o, i: 10 + k, at, expr: dad ? (f > 40 ? "grin" : "smile") : "smile", wave: dad && f > 46 ? wob(t, 2.6) : undefined });
    tag(out, at[0] + 0.2, at[1] + 1.08, at[2] + 0.12, k, t);
  });
};
// ---- 2: rental dad + kid walk the quay, he checks his watch ----
const quayWalk = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), x = QX_AT(f), z = QUAY_Z + 1.2, walking = f < 178, ph = q(((f - 84) / 22) % 1, 12);
  if (walking) {
    putSide(cam, t, out, DAD, 20, [x, D0, z], { mode: "march", phase: ph, expr: "smile", stomp: 0.5, stride: 0.6 }, true);
    putSide(cam, t, out, KID, 21, [x + 0.7, D0, z + 0.15], { mode: "march", phase: (ph + 0.5) % 1, expr: "grin", stomp: 0.5, stride: 0.5 }, true, 0.75);
  } else {
    put(cam, t, out, { o: DAD, i: 20, at: [x, D0, z], expr: f < 192 ? "smile" : "neutral", prop: "watch", look: 0, swaps: [192 / FPS] });
    put(cam, t, out, { o: KID, i: 21, at: [x + 0.65, D0, z + 0.1], expr: "smile", scale: 0.75, look: -1, facing: -1 });
  }
};
// ---- 3-4: the wedding ----
const TABLES: [number, number][] = [];
for (const z of [-2.6, 0.4, 3.2]) for (const x of [-4.6, -1.6, 1.6, 4.6]) TABLES.push([x, z]);
const wedding = (cam: CamInfo, t: number, out: Stage, id: number) => {
  const f = F(t), tags = id === 3 && f >= 248 && f < 296, singer = id === 3 && f >= 294, inSync = id === 4 && f >= 424;
  TABLES.forEach(([tx, tz], ti) => {
    for (const dx of [-0.5, 0, 0.5]) {
      const i = 100 + ti * 3 + (dx + 0.5) * 2, o = GUESTS[(ti * 3 + (dx + 0.5) * 2) % 6];
      const at = R("wed", tx + dx, 0, tz - 0.62);
      const isSinger = singer && ti === 6 && dx === 0; // table (1.6, 0.4), middle seat
      if (Math.hypot(at[0] - cam.pos.x, at[2] - cam.pos.z) < 1.8) continue; // nobody sits in front of the lens
      if (isSinger) {
        put(cam, t, out, { o, i, at: R("wed", tx, 0, tz - 0.66), expr: Math.floor(t * 4) % 2 ? "laugh" : "grin", prop: "mic", shadow: false });
        for (let n = 0; n < 3; n++) {
          const age = ((t * 0.9 + n * 0.33) % 1);
          out.fx.push({ key: `note${n % 2}`, cw: 220, ch: 260, draw: (p) => fxNote(p, n % 2), x: at[0] + 0.25 + 0.25 * age, y: at[1] + 1.75 + 0.6 * age, z: at[2] + 0.1, w: 0.18, h: 0.21, rot: 0.3 * Math.sin(age * 6 + n) });
        }
        continue;
      }
      put(cam, t, out, { o, i, at, mode: "sit", seat: 0.46, nudge: 0.1, shadow: false, expr: inSync ? "grin" : "smile", wave: inSync ? wob(t, 2.4) : undefined });
      if (tags && ti >= 4 && ti < 8) tag(out, at[0] + 0.2, at[1] + 1.18, at[2] + 0.22, ti * 3 + dx, t);
    }
  });
  // head table: the groom, deadpan
  put(cam, t, out, { o: GROOM, i: 140, at: R("wed", 0.3, 0, -5.95), mode: "sit", seat: 0.46, nudge: 0.1, shadow: false, expr: "neutral" });
  if (id === 3 && f >= 334) // the tearful speech at the mic stand
    put(cam, t, out, { o: GUESTW, i: 141, at: R("wed", -0.25, 0, -5.0), expr: "cry", prop: "mic" });
};
// ---- 5: the apology, with a rented boss (side views) ----
const office = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  const empBow = 0.85 * smooth((f - 489) / 12), bossBow = smooth((f - 520) / 16);
  putSide(cam, t, out, CLIENT, 30, R("office", 1.45, 0, -1.6), { mode: "stand", expr: "stern" }, true);
  putSide(cam, t, out, EMP, 31, R("office", -0.3, 0, -1.6), { mode: "stand", pose: q(empBow, 20), expr: "nervous" });
  putSide(cam, t, out, BOSS, 32, R("office", -1.25, 0, -1.65), { mode: "stand", pose: q(bossBow, 20), expr: f < 586 ? "neutral" : "smile_closed" });
};
// ---- 6: rental dad + girl on the park bench (golden) ----
const park = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), girl: V3 = [BENCH[0] - 0.42, D0 - 0.05, BENCH[2]], dad: V3 = [BENCH[0] + 0.45, D0 - 0.05, BENCH[2]];
  put(cam, t, out, { o: DAD, i: 40, at: dad, mode: "sit", expr: "smile", facing: sideOf(cam, dad, girl) as -1 | 1, look: sideOf(cam, dad, girl) });
  const lick = Math.floor(t * 1.6) % 3 === 0;
  put(cam, t, out, { o: GIRLKID, i: 41, at: girl, mode: "sit", scale: 0.8, prop: "icecream", expr: f >= 729 ? (lick ? "lick" : "relief_open") : lick ? "lick" : "laugh",
    facing: sideOf(cam, girl, dad) as -1 | 1, look: f >= 729 ? 0 : sideOf(cam, girl, dad) });
};
// ---- 7-8: the rental husband, the rules, the proposal (quay bench, day) ----
const couple = (cam: CamInfo, t: number, out: Stage, id: number) => {
  const f = F(t), cx = COUPLE_X, z = QUAY_Z - 0.25;
  const left: V3 = [cx - 0.45, D0, z], right: V3 = [cx + 0.45, D0, z];
  const reach = id === 7 ? q(smooth((f - 846) / 12), 10) : 1;
  if (id === 7) {
    put(cam, t, out, { o: WOMAN2, i: 50, at: left, mode: "sit", expr: "smile_closed", prop: ["hold", reach] });
    put(cam, t, out, { o: HUSB, i: 51, at: right, mode: "sit", expr: "smile", prop: ["hold", reach], mirror: true });
  } else {
    const shock = f >= 976;
    put(cam, t, out, { o: WOMAN2, i: 50, at: [cx - 0.35, D0, QUAY_Z + 0.55], expr: "grin", prop: "ring", look: 1, facing: 1 });
    put(cam, t, out, { o: HUSB, i: 51, at: right, mode: "sit", expr: shock ? "shock" : "neutral", look: -1, swaps: [976 / FPS] });
  }
  // the agency's staffer keeps an eye on the rules from behind the bench
  const nod = id === 7 && f >= 822 && f < 860 ? 5 * wob(t, 2) : 0;
  put(cam, t, out, { o: STAFF, i: 52, at: [cx + 0.95, D0, QUAY_Z - 1.9], expr: id === 8 && f >= 978 ? "shock" : "stern", prop: "clipboard", headTilt: nod, look: -1 });
};
// ---- 9: grandmother talks, the rental son listens (apartment, golden window) ----
const apartment = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), named = f >= 1196;
  const talk = ["smile", "grin", "smile_closed"] as Expr[];
  put(cam, t, out, { o: GRANNY, i: 60, at: R("apt", -0.6, 0, -2.35), mode: "sit", expr: named ? "relief_open" : talk[Math.floor(t * 6) % 3], facing: 1, look: 1 });
  put(cam, t, out, { o: SON, i: 61, at: R("apt", 0.6, 0, -2.35), mode: "sit", expr: named ? "smile_closed" : "smile", facing: -1, look: -1, headTilt: 4 * wob(t, 0.9) });
};
// ---- 10: the nightlight (bedroom, night) ----
const bedroom = (cam: CamInfo, t: number, out: Stage) => {
  put(cam, t, out, { o: KID2, i: 70, at: R("bed", -0.25, 0.45, -1.75), mode: "sit", seat: 0.14, nudge: 0.05, scale: 0.8, expr: "smile_closed", shadow: false });
  const [x, y, z] = R("bed", 1.9, 0.78, -2.43);
  out.fx.push({ key: "nightlight", cw: 300, ch: 300, draw: fxNightlight, x, y, z, w: 0.42, h: 0.42, orient: [0, 0, 0], glow: 2.6, soft: true });
};
// ---- 11: the founder alone (showroom at dusk) ----
const founder = (cam: CamInfo, t: number, out: Stage) =>
  put(cam, t, out, { o: FOUNDER, i: 80, at: R("show", 2.75, 0, -1.3), mode: "sit", expr: "neutral", prop: "chin", look: -1, facing: -1 });
// ---- 12-13: the girl on the quay, the Feeloy phone ----
let camLook: V3 = [0, 0, 0];
const quayGirl = (cam: CamInfo, t: number, out: Stage) => {
  const gx = GIRL_BENCH_X;
  put(cam, t, out, { o: GIRL, i: 90, at: [gx - 0.4, D0, QUAY_Z - 0.25], mode: "sit", expr: "smile", prop: "phone" });
  for (const [k, bx] of [8, 14.8, 18.2].entries()) put(cam, t, out, { o: MODERN[k], i: 91 + k, at: [bx + (k % 2 ? 0.45 : -0.45), D0, QUAY_Z - 0.25], mode: "sit", expr: "smile", prop: "phone" });
};
const phoneInsert = (t: number, out: Stage) => {
  const f = F(t);
  const pose = f < 1600 ? "wave" : f < 1624 ? "listen" : "smile";
  const icon = f < 1684 ? "dots" : f < 1726 ? "heart" : "dots";
  const bubble = f >= 1655 ? smooth((f - 1655) / 6) : 0;
  const blink = lidAt(t, 9) >= 1 ? 1 : 0, wv = pose === "wave" ? wob(t, 2.2) : 0, bb = q(bubble, 8);
  out.fx.push({ key: `phone|${pose}|${blink}|${wv}|${bb}|${icon}`, cw: 500, ch: 1000, draw: (p) => fxPhone(p, pose, blink, wv, bb, icon as "dots" | "heart"),
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
    case 1: lineup(cam, t, out, false); break;
    case 2: quayWalk(cam, t, out); break;
    case 3: case 4: wedding(cam, t, out, id); break;
    case 5: office(cam, t, out); break;
    case 6: park(cam, t, out); break;
    case 7: case 8: couple(cam, t, out, id); break;
    case 9: apartment(cam, t, out); break;
    case 10: bedroom(cam, t, out); break;
    case 11: founder(cam, t, out); break;
    case 12: quayGirl(cam, t, out); break;
    case 13: quayGirl(cam, t, out); phoneInsert(t, out); break;
    case 14: lineup(cam, t, out, true); break;
  }
  return out;
};
export { FPS };
