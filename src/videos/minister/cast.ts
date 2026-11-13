// Our cast as lit flat sprites in the 3D world (template: canvas pool, cardShade cards, contact blobs, blinks).
// stage(id, t, cam) says who is where, in which pose and expression, for every shot of the ELIZA -> Feeloy short.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxPhone, fxShadow, fxContact, fxBoard, fxNameplate, fxReport, fxPrescription,
  Outfit, Expr, FrontOpts, SideOpts, Prop, BubbleIcon } from "./toon";
import { FPS, D0, SHOTS, V3, R, QUAY_Z, DOOR_X, DOOR_Z, BOARD, BOARD_W, BOARD_H, DOORS, smooth, clamp01 } from "./story";
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
// ======================= cast of "The Minister for Loneliness" =======================
const MIN_UK: Outfit = { jacket: "#2f3a5a", pants: "#2f3a5a", boots: "#1e1b22", hat: "hair", hair: "#8a7a6a", collar: "#ffffff", build: "stout", skin: "#f5d6be" };
const MIN_JP: Outfit = { jacket: "#2b2b33", pants: "#2b2b33", boots: "#1e1b22", hat: "hair", hair: "#1e1b22", collar: "#ffffff", glasses: true, skin: "#f5d6be" };
const DOCTOR: Outfit = { jacket: "#f4f2ec", pants: "#4a4d57", boots: "#1e1b22", hat: "hair", hair: "#3a2a22", ponytail: "#3a2a22", collar: "#9fc8e6", skin: "#c99067" };
const PATIENT: Outfit = { jacket: "#8a6fb0", pants: "#4a4d57", boots: "#5a3b2a", dress: "#6f5a96", hat: "hair", hair: "#d9d4cc", glasses: true, skin: "#f5d6be" };
const POSTIE: Outfit = { jacket: "#d8433e", pants: "#2f3a5a", boots: "#1e1b22", hat: "cap", cap: "#d8433e", skin: "#ecd0b6" };
const OLDMAN: Outfit = { jacket: "#8a6a4a", pants: "#4a4d57", boots: "#5a3b2a", hat: "hair", hair: "#d9d4cc", moustache: "#d9d4cc", collar: "#f4f1ea", glasses: true };
const NIGHTMAN: Outfit = { jacket: "#6b6f7a", pants: "#3b3f52", boots: "#f4f1ea", hat: "hair", hair: "#2a2230", skin: "#f5c9a0" };
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
const O = (x: number, y: number, z: number) => R("office", x, y, z);
const wallCard = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, at: V3, w: number, h: number) =>
  out.fx.push({ key, cw, ch, draw, x: at[0], y: at[1], z: at[2], w, h, orient: [0, 0, 0] });
const board = (out: Stage, kind: "report" | "health" | "plan" | "call" | "map", k: number, extra: { wave?: number; blink?: number } = {}) =>
  wallCard(out, `board|${kind}|${k}|${extra.wave ?? 0}|${extra.blink ?? 0}`, 800, 500, (p) => fxBoard(p, kind, k, MIN_JP, extra.wave ?? 0, extra.blink ?? 0), O(BOARD[0], BOARD[1], -2.96), BOARD_W, BOARD_H);
const minister = (cam: CamInfo, t: number, out: Stage, a: Partial<Act> = {}) =>
  put(cam, t, out, { o: MIN_UK, i: 10, at: O(-0.3, 0, -2.35), mode: "sit", seat: 0.5, nudge: 0.05, shadow: false, expr: "smile", ...a });
const nameplate = (out: Stage, k: number) => wallCard(out, `plate|${k}`, 600, 160, (p) => fxNameplate(p, k), O(-0.3, 0.83, -1.18), 0.56, 0.15);

// 1: the minister sits at his desk; the nameplate's last word appears on "for loneliness"
const shot1 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  minister(cam, t, out, { expr: f < 60 ? "smile" : f < 118 ? "grin" : "nervous", swaps: [60 / FPS, 118 / FPS] });
  nameplate(out, q(smooth((f - 116) / 7), 20));
};
// 2: the corridor; the minister walks to the small door
const shot2 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  if (f >= 222) { const x = Math.min(DOORS[2] - 0.55, 1.2 + (f - 222) * 0.03);
    if (x < DOORS[2] - 0.55) putSide(cam, t, out, MIN_UK, 10, R("corr", x, 0, -2.3), { mode: "march", phase: q(((f - 222) / 22) % 1, 12), expr: "neutral", stomp: 0.4, stride: 0.5 });
    else put(cam, t, out, { o: MIN_UK, i: 10, at: R("corr", x, 0, -2.3), facing: 1, look: 1, expr: "nervous" }); }
};
// 3: the report lands; the count ticks up
const shot3 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), fall = clamp01((f - 268) / 14), [x, , z] = O(-0.7, 0, -1.4);
  minister(cam, t, out, { expr: f >= 282 && f < 300 ? "shock" : f >= 420 ? "sad" : "nervous", prop: f >= 300 ? "clipboard" : undefined, swaps: [282 / FPS, 300 / FPS] });
  if (f >= 268 && f < 300) out.fx.push({ key: "report", cw: 300, ch: 220, draw: fxReport, x, y: D0 + 0.9 + 1.6 * (1 - fall * fall), z, w: 0.42, h: 0.31 });
  board(out, "report", q(smooth((f - 330) / 50), 60));
};
// 4: the heart and fifteen cigarettes
const shot4 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t); board(out, "health", Math.max(0, Math.min(15, Math.floor((f - 546) / 2.4))));
};
// 5: the plan
const shot5 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: MIN_UK, i: 10, at: O(-0.05, 0, -2.45), facing: 1, look: 1, expr: "grin", prop: ["point", 1] });
  board(out, "plan", Math.max(0, Math.min(3, Math.floor((f - 612) / 12))));
};
// 6: the GP prescribes a cooking class, a walking club, an art group
const shot6 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), n = f >= 787 ? 3 : f >= 753 ? 2 : f >= 719 ? 1 : 0;
  put(cam, t, out, { o: DOCTOR, i: 20, at: R("gp", 0.8, 0, -2.35), mode: "sit", seat: 0.5, nudge: 0.05, shadow: false, facing: -1, look: -1, expr: f >= 719 ? "grin" : "smile" });
  put(cam, t, out, { o: PATIENT, i: 21, at: R("gp", -0.7, 0, -1.2), mode: "sit", seat: 0.46, facing: 1, look: 1, expr: n === 0 ? "neutral" : n < 3 ? "relief_open" : "laugh", swaps: [719 / FPS] });
  const [x, y, z] = R("gp", 0.15, 1.12, -0.55);
  out.fx.push({ key: `rx|${n}`, cw: 400, ch: 500, draw: (p) => fxPrescription(p, n), x, y, z, w: 0.36, h: 0.45, rot: -0.06 });
};
// 7: the postal worker knocks; an old man opens the door
const shot7 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), x = Math.min(DOOR_X - 1.05, DOOR_X - 3.4 + (f - 812) * 0.042), z = DOOR_Z + 1.55;
  if (x < DOOR_X - 1.05) putSide(cam, t, out, POSTIE, 30, [x, D0, z], { mode: "march", phase: q(((f - 812) / 22) % 1, 12), expr: "smile", stomp: 0.4, stride: 0.55 });
  else put(cam, t, out, { o: POSTIE, i: 30, at: [x, D0, z], facing: 1, look: 1, expr: f >= 886 ? "grin" : "smile", wave: f >= 868 && f < 886 ? wob(t, 3) : undefined });
  if (f >= 886) put(cam, t, out, { o: OLDMAN, i: 31, at: [DOOR_X + 0.05, D0 + 0.15, DOOR_Z + 0.62], facing: -1, look: -1, expr: f >= 905 ? "laugh" : "relief_open", shadow: false });
};
// 8: Japan's minister
const shot8 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: MIN_JP, i: 40, at: R("jp", 0, 0, -2.35), mode: "sit", seat: 0.5, nudge: 0.05, shadow: false, expr: f >= 1003 ? "grin" : "smile", wave: f >= 1072 ? wob(t, 2.2) : undefined });
};
// 9: the first meeting, online
const shot9 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), on = f >= 1176;
  minister(cam, t, out, { expr: on ? "grin" : "nervous", wave: on ? wob(t, 2.2) : undefined, swaps: [1176 / FPS] });
  board(out, "call", 1, { wave: f >= 1183 ? wob(t, 2.2, 1) : 0, blink: lidAt(t, 41) >= 1 ? 1 : 0 }); // the far side waves a beat late (the lag)
};
// 10: two dots on the map; then one very big problem
const shot10 = (cam: CamInfo, t: number, out: Stage) => { const f = F(t); board(out, "map", q(smooth((f - 1279) / 14), 30)); };
// 11: 2 a.m.; the phone
let camLook: V3 = [0, 0, 0];
const shot11 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: NIGHTMAN, i: 50, at: R("homeN", -0.4, 0, -1.75), mode: "sit", seat: 0.42, prop: "phone", expr: f >= 1440 ? "smile" : "sad", shadow: false, swaps: [1440 / FPS] });
  if (f < 1445) return;
  const pose = f >= 1493 && f < 1505 ? "wave" : f >= 1505 && f < 1525 ? "listen" : f >= 1560 && f < 1620 ? "listen" : "smile";
  const [icon, f0]: [BubbleIcon, number] = f >= 1620 ? ["heart", 1620] : f >= 1560 ? ["dots", 1560] : f >= 1525 ? ["note", 1525] : ["dots", 99999];
  const bb = f >= f0 ? q(smooth((f - f0) / 6), 8) : 0;
  const blink = lidAt(t, 9) >= 1 ? 1 : 0, wv = pose === "wave" ? wob(t, 2.2) : 0;
  out.fx.push({ key: `phone|${pose}|${blink}|${wv}|${bb}|${icon}`, cw: 500, ch: 1000, draw: (p) => fxPhone(p, pose, blink, wv, bb, icon, "2:00"),
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
    case 11: shot11(cam, t, out); break;
  }
  return out;
};
export { FPS };
