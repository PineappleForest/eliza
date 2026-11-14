// Static scenery: merged batches (one mesh per material), box-section strands rebuilt along a path every frame
// (chains, rails), and the town on both banks: gabled houses with painted facades, church, mill + chimneys, quay,
// hills and CC0 Kenney props (trees, lanterns, stalls, hedges).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { D0, R, QUAY_Z, MX, MZ, Room } from "./story";
import { brick, rng, ctex, rep, facadeHD, roofHD, stoneHD } from "./paint";
import { twoTone } from "./shade";

export type Kit = Record<string, THREE.Object3D>;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- materials (shared, cached) ----------------
const mats = new Map<string, THREE.Material>();
/** materials whose Strands are built as real interlocking chain links (MAT pass) instead of a textured box tube */
const CHAIN_MATS = new WeakSet<THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    if (key === "chainHD") {
      // MAT pass: the chain material (world.ts) becomes slate blue-grey iron with a soft painted-metal highlight;
      // its Strands switch to link geometry, so links read in close-ups (bank f1780, overhead f1650)
      const c = twoTone(new THREE.MeshPhongMaterial({ color: "#7a8490", specular: "#6c727b", shininess: 30 }));
      CHAIN_MATS.add(c);
      m = c as unknown as THREE.MeshLambertMaterial;
    } else m = twoTone(new THREE.MeshLambertMaterial(make()));
    mats.set(key, m);
  }
  return m;
};
const lamOf = new Map<string, THREE.MeshLambertMaterial>();
// the nature kit ships a teal palette; our valley wants storybook greens and browns
const GREENS = ["#62ae4c", "#56a447", "#72b853"];
const RECOLOR: Record<string, string> = { grass: "#6aab4f", leafsDark: "#4a9142", woodBark: "#8a5a3c", woodInner: "#e8cfa4", wood: "#a8724a",
  woodDark: "#7a4f33", dirt: "#8a6a4a", stone: "#b7b4ad" };
/** Kenney GLB materials -> Lambert, so the whole world shares one lighting model */
const toLambert = (m: THREE.Material) => {
  let l = lamOf.get(m.uuid);
  if (!l) {
    const s = m as THREE.MeshStandardMaterial;
    const col = m.name === "leafsGreen" ? GREENS[lamOf.size % 3] : RECOLOR[m.name];
    l = twoTone(new THREE.MeshLambertMaterial({ color: col ? new THREE.Color(col) : s.color?.clone() ?? new THREE.Color("#ffffff"), map: s.map ?? null, side: s.side, alphaTest: s.alphaTest }));
    lamOf.set(m.uuid, l);
  }
  return l;
};

// ---------------- geometry pieces ----------------
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};
/** quad a,b,c,d counter-clockwise seen from its front; uv (u0,v0) at a, (u1,v1) at c */
export const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1, u0 = 0, v0 = 0) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
};
export const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  return g;
};
/** axis box from min to max, texture tiled every `tile` metres (0 = one image per face) */
export const boxGeo = (min: THREE.Vector3, max: THREE.Vector3, tile = 0, bottom = false) => {
  const [x0, y0, z0] = [min.x, min.y, min.z], [x1, y1, z1] = [max.x, max.y, max.z];
  const t = (a: number) => (tile ? a / tile : 1);
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const faces = [
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ];
  if (bottom) faces.push(quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), t(w), t(d)));
  return mergeGeometries(faces, false);
};

/** collects pieces by material and merges them into one static mesh per material */
export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x); else this.g.set(mat, [x]);
  }
  addObject(o: THREE.Object3D, m: THREE.Matrix4) {
    o.updateMatrixWorld(true);
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      this.add(mesh.geometry, toLambert(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material), new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld));
    });
  }
  build(parent: THREE.Object3D, cast = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

// ---------------- strands: box-section tube along a path, rebuilt in place ----------------
// chain-link template (MAT pass): a stadium-shaped ring tube in link space (x along the chain, y in the ring plane,
// z across), NS centre-line samples x NR tube sides, smooth normals (clean ink silhouettes, no facet creases)
const LNS = 16, LNR = 6;
type LinkT = { p: Float32Array; n: Float32Array; idx: number[]; pitch: number };
const linkTemplate = (h: number): LinkT => {
  const ow = h * 0.85, rb = ow * 0.14, ol = ow * 1.62, rc = ow / 2 - rb, hl = ol / 2 - rb - rc;
  const p = new Float32Array(LNS * LNR * 3), n = new Float32Array(LNS * LNR * 3), idx: number[] = [];
  for (let j = 0; j < LNS; j++) {
    const th = (2 * Math.PI * (j + 0.5)) / LNS, nx = Math.cos(th), ny = Math.sin(th);
    const cx = rc * nx + Math.sign(nx) * hl, cy = rc * ny;
    for (let k = 0; k < LNR; k++) {
      const ph = (2 * Math.PI * k) / LNR, cp = Math.cos(ph), sp = Math.sin(ph), o = (j * LNR + k) * 3;
      p[o] = cx + rb * cp * nx; p[o + 1] = cy + rb * cp * ny; p[o + 2] = rb * sp;
      n[o] = cp * nx; n[o + 1] = cp * ny; n[o + 2] = sp;
      const a = j * LNR + k, b = j * LNR + ((k + 1) % LNR), c = ((j + 1) % LNS) * LNR + ((k + 1) % LNR), d = ((j + 1) % LNS) * LNR + k;
      idx.push(a, d, c, a, c, b); // outward winding
    }
  }
  return { p, n, idx, pitch: ol - 4 * rb };
};

export class Strand {
  mesh: THREE.Mesh;
  private pos: Float32Array; private nor: Float32Array; private uv: Float32Array;
  private lt: LinkT | null = null; private maxLinks = 0;
  constructor(public n: number, public w: number, public h: number, mat: THREE.Material, public tile = 1, cast = true) {
    const g = new THREE.BufferGeometry();
    if (CHAIN_MATS.has(mat)) {
      // link mode: up to maxLinks interlocking links laid along the path every frame (draw range = links used)
      const lt = (this.lt = linkTemplate(h)), nv = LNS * LNR;
      this.maxLinks = 440;
      this.pos = new Float32Array(this.maxLinks * nv * 3); this.nor = new Float32Array(this.maxLinks * nv * 3); this.uv = new Float32Array(this.maxLinks * nv * 2);
      const idx = new Uint32Array(this.maxLinks * lt.idx.length);
      for (let l = 0; l < this.maxLinks; l++) for (let i = 0; i < lt.idx.length; i++) idx[l * lt.idx.length + i] = lt.idx[i] + l * nv;
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.setDrawRange(0, 0);
    } else {
      this.pos = new Float32Array(n * 12); this.nor = new Float32Array(n * 12); this.uv = new Float32Array(n * 8);
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
      const idx: number[] = [];
      for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) {
        const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = (i + 1) * 4 + ((k + 1) % 4), d = (i + 1) * 4 + k;
        idx.push(a, b, c, a, c, d);
      }
      g.setIndex(idx);
    }
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.castShadow = cast; this.mesh.receiveShadow = true;
  }
  private T = new THREE.Vector3(); private S = new THREE.Vector3(); private N = new THREE.Vector3();
  /** link mode: links every `pitch` along the polyline, centred, alternating ring plane (vertical / horizontal) */
  private setLinks(pts: THREE.Vector3[], lt: LinkT) {
    const { T, S, N } = this, nv = LNS * LNR;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = cum[cum.length - 1], count = Math.max(0, Math.min(this.maxLinks, Math.floor(total / lt.pitch)));
    const s0 = (total - (count - 1) * lt.pitch) / 2;
    let seg = 1;
    for (let l = 0; l < count; l++) {
      const s = s0 + l * lt.pitch;
      while (seg < pts.length - 1 && cum[seg] < s) seg++;
      const a = pts[seg - 1], b = pts[seg], u = (s - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
      const px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u, pz = a.z + (b.z - a.z) * u;
      T.subVectors(b, a).normalize();
      S.set(-T.z, 0, T.x); // T x up
      if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
      S.normalize(); N.crossVectors(S, T).normalize();
      const odd = l % 2 === 1;
      // ring plane: (T, N) for even links, (T, S) for odd links; z (thickness) across it
      const yx = odd ? S.x : N.x, yy = odd ? S.y : N.y, yz = odd ? S.z : N.z;
      const zx = odd ? -N.x : S.x, zy = odd ? -N.y : S.y, zz = odd ? -N.z : S.z;
      const base = l * nv * 3;
      for (let v = 0; v < nv * 3; v += 3) {
        const x = lt.p[v], y = lt.p[v + 1], z = lt.p[v + 2], o = base + v;
        this.pos[o] = px + T.x * x + yx * y + zx * z;
        this.pos[o + 1] = py + T.y * x + yy * y + zy * z;
        this.pos[o + 2] = pz + T.z * x + yz * y + zz * z;
        const nx = lt.n[v], ny = lt.n[v + 1], nz = lt.n[v + 2];
        this.nor[o] = T.x * nx + yx * ny + zx * nz;
        this.nor[o + 1] = T.y * nx + yy * ny + zy * nz;
        this.nor[o + 2] = T.z * nx + yz * ny + zz * nz;
      }
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, count * lt.idx.length);
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  }
  set(pts: THREE.Vector3[]) {
    if (this.lt) { this.setLinks(pts, this.lt); return; }
    const { T, S, N } = this;
    let len = 0;
    for (let i = 0; i < this.n; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      T.subVectors(b, a).normalize();
      S.crossVectors(T, V(0, 1, 0));
      if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
      S.normalize(); N.crossVectors(S, T).normalize();
      if (i) len += p.distanceTo(pts[Math.min(i - 1, pts.length - 1)]);
      for (let k = 0; k < 4; k++) {
        const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1, j = (i * 4 + k) * 3;
        this.pos[j] = p.x + S.x * sx * this.w / 2 + N.x * sy * this.h / 2;
        this.pos[j + 1] = p.y + S.y * sx * this.w / 2 + N.y * sy * this.h / 2;
        this.pos[j + 2] = p.z + S.z * sx * this.w / 2 + N.z * sy * this.h / 2;
        const nx = S.x * sx + N.x * sy, ny = S.y * sx + N.y * sy, nz = S.z * sx + N.z * sy, nl = Math.hypot(nx, ny, nz);
        this.nor[j] = nx / nl; this.nor[j + 1] = ny / nl; this.nor[j + 2] = nz / nl;
        this.uv[(i * 4 + k) * 2] = k / 4; this.uv[(i * 4 + k) * 2 + 1] = len / this.tile;
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true;
  }
}

// ---------------- set dressing around the lens ----------------
/** a sight line of the film: from the lens toward the shot's subject, `len` along d (d has unit forward component) */
export type Ray = { o: THREE.Vector3; d: THREE.Vector3; len: number; core: boolean };
let sight: Ray[] = [];
/** does any sight line pass through this box? (centre lines only for small props, so they can still frame a shot) */
const inTheWay = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, coreOnly = false) => {
  for (const { o, d, len, core } of sight) {
    if (coreOnly && !core) continue;
    let t0 = 0, t1 = len;
    for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < a || oo > b) t0 = Infinity; continue; }
      const ta = (a - oo) / dd, tb = (b - oo) / dd;
      t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    }
    if (t0 <= t1) return true;
  }
  return false;
};

// ---------------- cartoon vegetation (MAT pass) ----------------
// Kenney's faceted low-poly trees and box hedges -> rounded storybook shapes: clustered smooth spheres for canopies
// (the two-tone sun term gives each lobe a lit cap and a cool belly), tapered trunks, rounded-box hedges. Smooth
// normals mean the world ink draws clean silhouettes and lobe-to-lobe folds instead of a crease on every facet.
type VegKind = "round" | "fat" | "tall" | "cone" | "bush" | "hedge";
const VEG: Record<string, VegKind> = {
  tree_oak: "round", tree_default: "round", tree_detailed: "round", tree_fat: "fat", "tree-high-round": "tall", tree: "tall",
  tree_cone: "cone", plant_bushLarge: "bush", plant_bushDetailed: "bush", plant_bush: "bush", hedge: "hedge",
};
const LEAF = ["#5aa83c", "#4c9a37", "#69b545", "#55a243", "#3f8f3c"];
/** canopy paint (equal px per metre on a unit sphere: 256 around x 128 pole to pole): light crown, darker belly,
 *  soft leaf-clump dabs (kept low contrast: the two-tone sun term does the main modelling) */
const leafTex = (i: number) => ctex("leafHD" + i, 256, 128, (g, r) => {
  const base = new THREE.Color(LEAF[i]), top = base.clone().offsetHSL(0.012, 0.03, 0.08), bot = base.clone().offsetHSL(-0.015, 0.0, -0.08);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "#" + top.getHexString()); gr.addColorStop(0.42, "#" + base.getHexString()); gr.addColorStop(1, "#" + bot.getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  for (let k = 0; k < 46; k++) {
    const x = r() * 256, y = 10 + r() * 108, rad = 5 + r() * 9, light = y < 64 ? r() < 0.7 : r() < 0.25;
    for (const ox of [-256, 0, 256]) {
      g.strokeStyle = light ? "rgba(225,255,170,0.22)" : "rgba(20,70,30,0.2)"; g.lineWidth = 2.5; g.lineCap = "round";
      g.beginPath(); g.arc(x + ox, y + rad * 0.6, rad, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
  }
});
const leafMat = (i: number) => lam("leafHD" + i, () => ({ map: leafTex(i) }));
const barkMat = () => lam("barkHD", () => ({ color: "#8f5d3b" }));
const vegGeo = new Map<string, THREE.BufferGeometry>();
const lobeGeo = (q: number) => {
  const k = "lobe" + q;
  let g = vegGeo.get(k);
  if (!g) { g = new THREE.SphereGeometry(1, [20, 14, 10][q], [14, 10, 7][q]); vegGeo.set(k, g); }
  return g;
};
const trunkGeo = () => {
  let g = vegGeo.get("trunk");
  if (!g) { g = new THREE.CylinderGeometry(0.6, 1, 1, 10, 1, true).translate(0, 0.5, 0); vegGeo.set("trunk", g); }
  return g;
};
/** rounded box (exact: inner box + radius), unit size along x, smooth normals; used for hedges */
const hedgeGeo = () => {
  let g = vegGeo.get("hedge");
  if (!g) {
    g = new THREE.BoxGeometry(1, 1, 1, 18, 10, 10);
    const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
    // per-axis rounding radii in unit space (~0.35 m at the ends, ~0.45 m on top / sides at 3.3 x 1.56 x 1.17 m);
    // flat bottom (it sits on the lawn)
    const R = [0.106, 0.29, 0.385], v = new THREE.Vector3(), e = new THREE.Vector3(), q = [0, 0, 0];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      for (let a = 0; a < 3; a++) {
        const c = v.getComponent(a), lim = a === 1 && c < 0 ? 0.5 : 0.5 - R[a];
        q[a] = THREE.MathUtils.clamp(c, -lim, lim); e.setComponent(a, (c - q[a]) / R[a]);
      }
      const L = e.length();
      if (L < 1e-6) continue;
      e.divideScalar(L);
      p.setXYZ(i, q[0] + e.x * R[0], q[1] + e.y * R[1], q[2] + e.z * R[2]);
      const nn = new THREE.Vector3(e.x / R[0], e.y / R[1], e.z / R[2]).normalize();
      n.setXYZ(i, nn.x, nn.y, nn.z);
    }
    g.translate(0, 0.5, 0);
    vegGeo.set("hedge", g);
  }
  return g;
};
const yawQ = (a: number) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
/** half-width of a cartoon plant of kind k and height h (for the sight-line test) */
const vegRad = (k: VegKind, h: number) => (k === "hedge" ? 1.7 : k === "bush" ? 0.85 * h : k === "tall" ? 0.2 * h : k === "cone" ? 0.27 * h : k === "fat" ? 0.44 * h : 0.39 * h);
/** add one cartoon plant to a batch: base at (x, y, z), height h, q = lobe detail (0 near .. 2 far) */
const addVeg = (b: Batch, k: VegKind, x: number, y: number, z: number, h: number, seed: number, q = 0) => {
  const r = rng(Math.abs(Math.floor(seed)) % 200000 + 7), U = (a: number, c: number) => a + (c - a) * r();
  const leaf = leafMat(k === "cone" ? 4 : k === "hedge" ? 1 : Math.floor(r() * 4)), lobe = lobeGeo(q), yaw = r() * 6.28;
  const put = (px: number, py: number, pz: number, rad: number, sy = 0.9) =>
    b.add(lobe, leaf, new THREE.Matrix4().compose(V(x + px, y + py, z + pz), yawQ(r() * 6.28), V(rad, rad * sy, rad)));
  const trunk = (th: number, tr: number) =>
    b.add(trunkGeo(), barkMat(), new THREE.Matrix4().compose(V(x, y - 0.15, z), yawQ(yaw), V(tr, th + 0.15, tr)));
  const ring = (n: number, dist: number, r0: number, r1: number, cy: number, dy: number) => {
    const a0 = r() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 6.28) / n + U(-0.35, 0.35), dd = dist * U(0.85, 1.12);
      put(Math.cos(a) * dd, cy + U(-dy, dy), Math.sin(a) * dd, U(r0, r1));
    }
  };
  if (k === "round" || k === "fat") {
    const f = k === "fat";
    trunk((f ? 0.4 : 0.48) * h, 0.055 * h);
    const cy = (f ? 0.58 : 0.64) * h;
    put(0, cy, 0, (f ? 0.29 : 0.26) * h);
    ring(f ? 5 : 4, (f ? 0.22 : 0.18) * h, (f ? 0.19 : 0.17) * h, (f ? 0.23 : 0.21) * h, cy - 0.05 * h, 0.04 * h);
    put(U(-0.05, 0.05) * h, cy + (f ? 0.15 : 0.17) * h, U(-0.05, 0.05) * h, (f ? 0.19 : 0.17) * h);
  } else if (k === "tall") {
    trunk(0.34 * h, 0.045 * h);
    put(0, 0.47 * h, 0, 0.17 * h, 1.3);
    put(U(-0.03, 0.03) * h, 0.65 * h, U(-0.03, 0.03) * h, 0.15 * h, 1.3);
    put(0, 0.82 * h, 0, 0.11 * h, 1.25);
    ring(3, 0.1 * h, 0.1 * h, 0.12 * h, 0.55 * h, 0.06 * h);
  } else if (k === "cone") {
    trunk(0.2 * h, 0.05 * h);
    put(0, 0.3 * h, 0, 0.26 * h, 0.62);
    put(0, 0.5 * h, 0, 0.2 * h, 0.66);
    put(0, 0.68 * h, 0, 0.14 * h, 0.75);
    put(0, 0.84 * h, 0, 0.08 * h, 1.0);
  } else if (k === "bush") {
    put(0, 0.46 * h, 0, 0.5 * h);
    ring(3, 0.42 * h, 0.32 * h, 0.38 * h, 0.32 * h, 0.04 * h);
  } else { // hedge segment, 3.3 m along local x
    b.add(hedgeGeo(), leaf, new THREE.Matrix4().compose(V(x, y - 0.06, z), new THREE.Quaternion(), V(3.3, h + 0.06, Math.max(0.9, h * 0.78))));
  }
};

// ---------------- painted cloth banner (MAT round 3) ----------------
// The Kenney banner is one flat face of the saturated colour atlas: in golden light it kept a uniform, hot red and
// read as pasted on. Ours is a hanging cloth with real folds (smooth normals, so the two-tone light rolls across
// them), a swallow-tail hem, a muted crimson (sat ~-25 %) with an ochre border and a diamond like the tower flags.
const BANNER_COL: Record<string, string> = { "banner-red": "#b8553a", "banner-green": "#4f8a5a" }; // warm red: no purple in shade
const FOLD = 0.27, CLOTH_W = 1.1, CLOTH_H = 2.6; // fold period across the cloth, cloth size (m)
const bannerTex = (col: string) => ctex("bannerHD" + col, 256, 700, (g) => {
  const W = 256, H = 700, base = new THREE.Color(col);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#" + base.clone().offsetHSL(0, 0, 0.04).getHexString()); gr.addColorStop(1, "#" + base.clone().offsetHSL(0, 0, -0.06).getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x++) { // painted fold shading, in phase with the geometry folds
    const s = Math.sin((x / W) * (CLOTH_W / FOLD) * Math.PI * 2);
    g.fillStyle = s > 0 ? `rgba(255,235,215,${0.1 * s})` : `rgba(60,15,15,${-0.12 * s})`; g.fillRect(x, 0, 1, H);
  }
  g.fillStyle = "#" + base.clone().offsetHSL(0, -0.05, -0.12).getHexString(); g.fillRect(0, 0, W, 54); // top hem
  g.strokeStyle = "#d1aa5c"; g.lineWidth = 9; g.strokeRect(20, 66, W - 40, H - 86);                 // ochre border
  g.strokeStyle = "rgba(60,30,20,0.45)"; g.lineWidth = 2; g.strokeRect(14, 60, W - 28, H - 74); g.strokeRect(26, 72, W - 52, H - 98);
  g.fillStyle = "#d1aa5c"; g.fillRect(0, 46, W, 8);
  const cx = W / 2, cy = 250; // emblem: diamond (the tower flags' motif) on a light disc
  g.fillStyle = "#efe2c2"; g.beginPath(); g.arc(cx, cy, 62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(60,30,20,0.55)"; g.lineWidth = 3; g.stroke();
  g.fillStyle = "#d1aa5c"; g.beginPath(); g.moveTo(cx, cy - 46); g.lineTo(cx + 34, cy); g.lineTo(cx, cy + 46); g.lineTo(cx - 34, cy); g.closePath(); g.fill();
  g.strokeStyle = "rgba(60,30,20,0.6)"; g.lineWidth = 2.5; g.stroke();
});
const bannerGeo = () => {
  let geo = vegGeo.get("banner");
  if (!geo) {
    const w = CLOTH_W, hh = CLOTH_H, notch = 0.42;
    geo = new THREE.PlaneGeometry(w, hh, 16, 20).translate(0, -hh / 2, 0); // top edge at y = 0
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), t = -y / hh; // 0 top .. 1 bottom
      p.setY(i, y + notch * (1 - Math.abs(x) / (w / 2)) * t * t);                              // swallow-tail hem
      p.setZ(i, (0.025 + 0.055 * t) * Math.sin((x / FOLD) * Math.PI * 2 + 0.6) + 0.04 * t * t); // folds deepen downwards
    }
    geo.computeVertexNormals();
    vegGeo.set("banner", geo);
  }
  return geo;
};
/** gonfalon on a pole where the Kenney banner plate stood: its plate hung 0.4 x scale beside the placement point,
 *  facing local +-x, so the pole goes there (same framing) and the cloth faces that way */
const bannerProp = (b: Batch, name: string, x0: number, y: number, z0: number, h: number, yaw0: number) => {
  const off = 0.4 * (h / 0.84), x = x0 + Math.cos(yaw0) * off, z = z0 - Math.sin(yaw0) * off, yaw = yaw0 + Math.PI / 2;
  if (inTheWay(x - 0.7, x + 0.7, y, y + h, z - 0.7, z + 0.7, true)) return;
  const col = BANNER_COL[name] ?? "#b4524b";
  const M = (px: number, py: number, pz: number) => new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z).multiply(new THREE.Matrix4().makeTranslation(px, py, pz));
  const pole = lam("bannerPole", () => ({ color: "#6e4b33" })), gold = lam("bannerGold", () => ({ color: "#c9a24e" }));
  b.add(new THREE.CylinderGeometry(0.045, 0.06, h, 10).translate(0, h / 2, 0), pole, M(0, 0, 0));
  b.add(new THREE.SphereGeometry(0.1, 14, 10), gold, M(0, h + 0.06, 0));
  b.add(new THREE.CylinderGeometry(0.03, 0.03, CLOTH_W + 0.2, 8).rotateZ(Math.PI / 2), pole, M(0, h - 0.18, 0.06));
  for (const s of [-1, 1]) b.add(new THREE.SphereGeometry(0.045, 10, 8), gold, M(s * (CLOTH_W / 2 + 0.12), h - 0.18, 0.06));
  b.add(bannerGeo(), lam("bannerHD" + col, () => ({ map: bannerTex(col), side: THREE.DoubleSide })), M(0, h - 0.2, 0.1));
};

// ---------------- Kenney props ----------------
const boxes = new Map<THREE.Object3D, THREE.Box3>();
/** place a Kenney model with its base on y, scaled to height h (left out when it would stand in front of the lens).
 *  Trees, bushes and hedges are drawn as cartoon vegetation, banners as painted cloth instead (MAT pass). */
export const prop = (b: Batch, kit: Kit, name: string, x: number, y: number, z: number, h: number, yaw = 0) => {
  if (name.startsWith("banner")) { bannerProp(b, name, x, y, z, h, yaw); return; }
  const vk = VEG[name];
  if (vk) {
    const rad = vegRad(vk, h);
    if (inTheWay(x - rad, x + rad, y, y + h, z - rad, z + rad, true)) return;
    const d = Math.hypot(x, z);
    addVeg(b, vk, x, y, z, h, x * 92.7 + z * 31.3 + yaw * 1000, d > 200 ? 2 : Math.abs(z) > 45 && d > 60 ? 1 : 0);
    return;
  }
  const o = kit[name];
  if (!o) return;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const s = h / Math.max(0.01, box.max.y - box.min.y), r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * s * 0.5;
  if (inTheWay(x - r, x + r, y, y + h, z - r, z + r, true)) return;
  b.addObject(o, new THREE.Matrix4().compose(V(x, y - box.min.y * s, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(s, s, s)));
};

/** a Kenney model as its own object (two-tone materials), base at y = 0, scaled to height h (no sight-line test:
 *  used for the CAM agent's FOREGROUND framing objects, which are meant to stand in front of the lens) */
export const kitClone = (kit: Kit, name: string, h: number): THREE.Object3D | null => {
  const vk = VEG[name];
  if (vk) { // cartoon plant as its own object (MAT pass), base at y = 0
    const vb = new Batch(), grp = new THREE.Group();
    addVeg(vb, vk, 0, 0, 0, h, name.length * 977 + h * 131, 0);
    vb.build(grp, false);
    grp.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = true; } });
    return grp;
  }
  const o = kit[name];
  if (!o) return null;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const c = o.clone(true), s = h / Math.max(0.01, box.max.y - box.min.y);
  c.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh) { m.material = toLambert(Array.isArray(m.material) ? m.material[0] : m.material); m.castShadow = false; m.receiveShadow = true; }
  });
  const g = new THREE.Group();
  c.position.y = -box.min.y * s; c.scale.setScalar(s);
  g.add(c);
  return g;
};

// ---------------- houses ----------------
type Style = { wall: string; shutter: string; roof: string; timber?: boolean; brick?: boolean };
// MAT pass: warm ochre / cream / sandstone / salmon walls + one blue-grey (the old pinks, whites and grey-blues read
// lavender: the two-tone shade multiplies by a blue-violet, so a near-neutral albedo turns lilac on every shaded face)
// round 3: saturation -35 % on every wall (neutral warm grey / beige; the salmon became a warm greige)
// round 4: the pale greiges still read lavender-grey in shade -> a muted brick / cream / ochre / terracotta spread
const STYLES: Style[] = [
  { wall: "#ecdab2", shutter: "#3f6fb5", roof: "#d27a62" },              // cream
  { wall: "#d8a95f", shutter: "#2f6a43", roof: "#b8644f" },              // ochre
  { wall: "#c47a5c", shutter: "#2f5f6a", roof: "#8f97a8" },              // muted brick-red plaster
  { wall: "#efdcb8", shutter: "#2f5f6a", roof: "#c9775a", timber: true }, // cream timber frame
  { wall: "#ddbd78", shutter: "#5a3b2a", roof: "#d27a62" },              // straw ochre
  { wall: "#cc9a6c", shutter: "#3f6fb5", roof: "#8e7aa0" },              // terracotta sand
  { wall: "#e2c49a", shutter: "#8c3b4a", roof: "#c9775a" },              // warm sandstone
  { wall: "#e3d2b8", shutter: "#2f6a43", roof: "#8f97a8", brick: true },
];
const roofMat = (col: string) => lam("roof" + col, () => ({ map: roofHD(col, col === "#8f97a8"), side: THREE.DoubleSide }));

/** gabled house: front facade (local +z) at width w, depth d, wall height h, ridge along local x (left out if it blocks a shot) */
export const house = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, si: number, y = D0) => {
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 0.6, hz = (across ? w : d) / 2 + 0.6;
  if (inTheWay(x - hx, x + hx, y, y + h + d * 0.42 + 1.2, z - hz, z + hz)) return;
  const st = STYLES[si % STYLES.length];
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  const front = lam(`hf${si}_${w}_${h}`, () => ({ map: facadeHD(`hf${si}_${w}_${h}`, w, h, { ...st, door: true }) }));
  const side = lam(`hs${si}_${h}`, () => ({ map: facadeHD(`hs${si}_${h}`, 8, h, st) }));
  const wall = lam("wall" + st.wall, () => ({ color: st.brick ? "#c8643f" : st.wall }));
  const hw = w / 2, hd = d / 2, rh = d * 0.42, o = 0.35;
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), front, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), side, m);
  b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), side, m);
  b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), side, m);
  b.add(tri(V(-hw, h, -hd), V(-hw, h, hd), V(-hw, h + rh, 0)), wall, m);
  b.add(tri(V(hw, h, hd), V(hw, h, -hd), V(hw, h + rh, 0)), wall, m);
  const ru = (w + 2 * o) / 4, rv = Math.hypot(hd + o, rh) / 4, rm = roofMat(st.roof);
  b.add(quad(V(-hw - o, h - 0.25, hd + o), V(hw + o, h - 0.25, hd + o), V(hw + o, h + rh, 0), V(-hw - o, h + rh, 0), ru, rv), rm, m);
  b.add(quad(V(hw + o, h - 0.25, -hd - o), V(-hw - o, h - 0.25, -hd - o), V(-hw - o, h + rh, 0), V(hw + o, h + rh, 0), ru, rv), rm, m);
  const cx = hw * 0.45 * (si % 2 ? 1 : -1);
  b.add(boxGeo(V(cx - 0.4, h + rh * 0.3, -hd * 0.35 - 0.4), V(cx + 0.4, h + rh + 1.1, -hd * 0.35 + 0.4), 2), lam("chim", () => ({ map: rep(brick(), 1, 1) })), m);
  houseDetail(b, m, w, d, h, rh, cx);
};

// round 4: real 3D relief on every house (was a flat window-textured box): stone plinth, cornice under the eaves,
// window sills + lintel hoods matching facadeHD's window layout, front door step + door hood, chimney cap and pot
const UB = new THREE.BoxGeometry(1, 1, 1);
const trimM = () => lam("trimStone", () => ({ color: "#efe3c8" }));
const capM = () => lam("chimCap", () => ({ color: "#9a8778" }));
const plinthM = () => lam("plinthHD", () => ({ map: stoneHD("copeHD") }));
const ub = (b: Batch, mat: THREE.Material, m: THREE.Matrix4, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  b.add(UB, mat, m.clone().multiply(new THREE.Matrix4().compose(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion(), V(x1 - x0, y1 - y0, z1 - z0))));
const houseDetail = (b: Batch, m: THREE.Matrix4, w: number, d: number, h: number, rh: number, chx: number) => {
  const hw = w / 2, hd = d / 2, tm = trimM(), floors = Math.max(1, Math.floor(h / 2.8));
  b.add(boxGeo(V(-hw - 0.07, -0.05, -hd - 0.07), V(hw + 0.07, 0.45, hd + 0.07), 2), plinthM(), m);          // plinth
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h - 0.52, h - 0.25, hd, hd + 0.17);                                   // cornice front
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h - 0.52, h - 0.25, -hd - 0.17, -hd);                                 // cornice back
  for (const s of [-1, 1]) ub(b, tm, m, s < 0 ? -hw - 0.17 : hw, s < 0 ? -hw : hw + 0.17, h - 0.52, h - 0.25, -hd - 0.12, hd + 0.12);
  // windows: facadeHD puts nWin = floor(width / 2.2) per floor at (i + 0.5) / nWin, sill line fl * 2.8 + 0.9 m
  const wins = (len: number, door: boolean, at: (u: number) => [number, number], out: [number, number]) => {
    const n = Math.max(1, Math.floor(len / 2.2));
    for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) {
      const [px, pz] = at((i + 0.5) / n), yb = fl * 2.8 + 0.9;
      if (door && fl === 0 && i === Math.floor(n / 2)) {
        const along = (k: number) => [px + out[1] * k, pz - out[0] * k] as const; // along the wall (perpendicular to out)
        const [ax, az] = along(-0.82), [bx, bz] = along(0.82), [cx2, cz2] = along(-0.78), [dx2, dz2] = along(0.78);
        ub(b, plinthM(), m, Math.min(ax, bx, ax + out[0] * 0.5), Math.max(ax, bx, ax + out[0] * 0.5), 0, 0.2, Math.min(az, bz, az + out[1] * 0.5), Math.max(az, bz, az + out[1] * 0.5)); // step
        ub(b, tm, m, Math.min(cx2, dx2, cx2 + out[0] * 0.34), Math.max(cx2, dx2, cx2 + out[0] * 0.34), 2.3, 2.44, Math.min(cz2, dz2, cz2 + out[1] * 0.34), Math.max(cz2, dz2, cz2 + out[1] * 0.34)); // hood
        continue;
      }
      for (const [y0, y1, dep, half] of [[yb - 0.2, yb - 0.08, 0.14, 0.6], [yb + 1.33, yb + 1.43, 0.08, 0.55]] as const) {
        const ax = px - out[1] * half, az = pz + out[0] * half, bx = px + out[1] * half, bz = pz - out[0] * half;
        ub(b, tm, m, Math.min(ax, bx, ax + out[0] * dep), Math.max(ax, bx, ax + out[0] * dep), y0, y1, Math.min(az, bz, az + out[1] * dep), Math.max(az, bz, az + out[1] * dep));
      }
    }
  };
  wins(w, true, (u) => [-hw + u * w, hd], [0, 1]);            // front (+z), u from -x to +x
  wins(8, false, (u) => [hw - u * w, -hd], [0, -1]);          // back: side texture (8 m layout) stretched over w
  wins(8, false, (u) => [-hw, -hd + u * d], [-1, 0]);         // left side (-x): side texture is always the 8 m layout
  wins(8, false, (u) => [hw, hd - u * d], [1, 0]);            // right side (+x)
  // chimney cap + pot
  const cz = -hd * 0.35, top = h + rh + 1.1;
  ub(b, capM(), m, chx - 0.52, chx + 0.52, top, top + 0.16, cz - 0.52, cz + 0.52);
  b.add(new THREE.CylinderGeometry(0.13, 0.16, 0.42, 10).translate(0, 0.21, 0), lam("chimPot", () => ({ color: "#b8684a" })), m.clone().multiply(new THREE.Matrix4().makeTranslation(chx, top + 0.16, cz)));
};

// ---------------- painted extras ----------------
const chapelTex = () => ctex("chapel", 512, 512, (g) => {
  g.fillStyle = "#e9e0cc"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(0,0,0,.06)"; for (let y = 0; y < 512; y += 32) g.fillRect(0, y, 512, 2);
  for (const cx of [128, 384]) {
    g.fillStyle = "#33406b"; g.strokeStyle = "rgba(40,30,40,.85)"; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx - 40, 430); g.lineTo(cx - 40, 190); g.arc(cx, 190, 40, Math.PI, 0); g.lineTo(cx + 40, 430); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "rgba(160,200,255,.35)"; g.fillRect(cx - 30, 200, 16, 220);
    g.strokeStyle = "#d9c9a0"; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, 160); g.lineTo(cx, 430); g.moveTo(cx - 40, 300); g.lineTo(cx + 40, 300); g.stroke();
  }
});
const clockTex = () => ctex("clock", 256, 256, (g) => {
  g.fillStyle = "#f7f1e1"; g.strokeStyle = "#221f2e"; g.lineWidth = 12;
  g.beginPath(); g.arc(128, 128, 112, 0, 7); g.fill(); g.stroke();
  g.lineCap = "round";
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; g.lineWidth = 8; g.beginPath(); g.moveTo(128 + 80 * Math.cos(a), 128 + 80 * Math.sin(a)); g.lineTo(128 + 96 * Math.cos(a), 128 + 96 * Math.sin(a)); g.stroke(); }
  g.lineWidth = 12; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 62); g.stroke();
  g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(178, 150); g.stroke();
});
/** round 4: St George's cross (England, 1831): white field, red cross (the old red + yellow diamond read as Vietnam's flag) */
export const flagTex = () => ctex("flagStGeorge", 256, 160, (g) => {
  g.fillStyle = "#f4f0e6"; g.fillRect(0, 0, 256, 160);
  g.fillStyle = "#c8323a"; g.fillRect(0, 62, 256, 36); g.fillRect(110, 0, 36, 160);
  g.fillStyle = "rgba(120,100,90,0.10)"; g.fillRect(0, 150, 256, 10); // soft hem shade
});

// ---------------- town ----------------
/** the Whittier set (tower short) out on the grass: no valley trees there */
const inWhittier = (x: number, z: number) => z < -104 && x > -140 && x < 260;
const inPark = (x: number, z: number) => z < 0 && x > 46 && x < 96 && z > -100 && z < -49;
const inMill = (x: number, z: number) => z < 0 && x > -66 && x < -14 && z > -90 && z < -54;
const inDome = (x: number, z: number) => z > 0 && x > -68 && x < -12 && z > 32 && z < 82;
const inChurch = (x: number, z: number) => (z > 0 && x > 10 && x < 38 && z > 46 && z < 84) || (z > 0 && x > 86 && x < 110 && z > 60 && z < 84);

export const buildTown = (root: THREE.Object3D, kit: Kit, rays: Ray[] = []) => {
  const b = new Batch(), r = rng(11);
  sight = rays;
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
  for (const bank of [-1, 1]) {
    const away = bank > 0 ? Math.PI : 0; // fronts face the river
    // riverfront rows, fronts on the quay at |z| = 36.5
    for (const sx of [-1, 1]) {
      let x = 8.5;
      while (x < 134) {
        const w = pick([7, 9]), h = pick([7, 8.4, 9.8]), cx = sx * (x + w / 2), cz = bank * 40.5;
        if (!inDome(cx, cz)) house(b, cx, cz, away, w, 8, h, Math.floor(r() * 8));
        x += w + (r() < 0.25 ? 2.5 : 0.25);
      }
    }
    // main street, fronts on |x| = 6
    for (const sx of [-1, 1]) {
      let z = 46;
      while (z < 150) {
        const w = pick([7, 9]), h = pick([7, 8.4, 9.8]);
        if (!inChurch(sx * 10, bank * (z + w / 2))) house(b, sx * 10, bank * (z + w / 2), sx < 0 ? Math.PI / 2 : -Math.PI / 2, w, 8, h, Math.floor(r() * 8));
        z += w + (r() < 0.2 ? 3 : 0.3);
      }
    }
    // back rows
    for (const zf of [52, 66, 80, 96]) for (const sx of [-1, 1]) {
      let x = 17 + r() * 4;
      while (x < 124) {
        const w = pick([7, 9]), h = pick([7, 8.4, 9.8]), cx = sx * (x + w / 2), cz = bank * (zf + 4 + r() * 2);
        if (r() > 0.22 && !inPark(cx, cz) && !inMill(cx, cz) && !inChurch(cx, cz) && !inDome(cx, cz)) house(b, cx, cz, away, w, 8, h, Math.floor(r() * 8));
        x += w + 1 + r() * 4;
      }
    }
  }
  // church on the far bank: nave, tower, spire, clock
  const ch = lam("chapel", () => ({ map: chapelTex() })), st = lam("towerstone", () => ({ map: stoneHD("tstoneHD") })); // 2048 canvas at its own repeat 0.5 (paint.ts)
  b.add(boxGeo(V(18.5, D0, 57), V(29.5, D0 + 9, 80), 6), ch);
  const sl = roofMat("#8f97a8");
  b.add(quad(V(18.1, D0 + 8.8, 57), V(18.1, D0 + 8.8, 80.4), V(24, D0 + 13.5, 80.4), V(24, D0 + 13.5, 57), 6, 2), sl);
  b.add(quad(V(29.9, D0 + 8.8, 80.4), V(29.9, D0 + 8.8, 57), V(24, D0 + 13.5, 57), V(24, D0 + 13.5, 80.4), 6, 2), sl);
  b.add(tri(V(18.5, D0 + 9, 80), V(29.5, D0 + 9, 80), V(24, D0 + 13.5, 80)), st);
  b.add(boxGeo(V(21.4, D0, 51.6), V(26.6, D0 + 19, 57), 4), st);
  b.add(boxGeo(V(21.1, D0 + 18.6, 51.3), V(26.9, D0 + 19.4, 57.3), 4), st);
  const spire = new THREE.ConeGeometry(4.0, 13, 4, 1);
  spire.rotateY(Math.PI / 4);
  b.add(spire, sl, new THREE.Matrix4().makeTranslation(24, D0 + 19.4 + 6.5, 54.3));
  b.add(tri(V(29.5, D0 + 9, 57), V(18.5, D0 + 9, 57), V(24, D0 + 13.5, 57)), st);
  b.add(quad(V(25.1, D0 + 12.4, 51.55), V(22.9, D0 + 12.4, 51.55), V(22.9, D0 + 14.6, 51.55), V(25.1, D0 + 14.6, 51.55)), lam("clock", () => ({ map: clockTex(), alphaTest: 0.5 })));
  // mill (near bank) + chimneys with smoke handled in the world
  const mill = lam("mill", () => ({ map: facadeHD("mill", 30, 13, { wall: "#b5543c", shutter: "#3b3f52", brick: true }) }));
  const millS = lam("mills", () => ({ map: facadeHD("mills", 12, 13, { wall: "#b5543c", shutter: "#3b3f52", brick: true }) }));
  b.add(quad(V(-58, D0, -70), V(-28, D0, -70), V(-28, D0 + 13, -70), V(-58, D0 + 13, -70)), mill);
  b.add(quad(V(-28, D0, -82), V(-58, D0, -82), V(-58, D0 + 13, -82), V(-28, D0 + 13, -82)), mill);
  b.add(quad(V(-58, D0, -82), V(-58, D0, -70), V(-58, D0 + 13, -70), V(-58, D0 + 13, -82)), millS);
  b.add(quad(V(-28, D0, -70), V(-28, D0, -82), V(-28, D0 + 13, -82), V(-28, D0 + 13, -70)), millS);
  b.add(quad(V(-58.4, D0 + 12.8, -69.6), V(-27.6, D0 + 12.8, -69.6), V(-27.6, D0 + 16.5, -76), V(-58.4, D0 + 16.5, -76), 8, 2), sl);
  b.add(quad(V(-27.6, D0 + 12.8, -82.4), V(-58.4, D0 + 12.8, -82.4), V(-58.4, D0 + 16.5, -76), V(-27.6, D0 + 16.5, -76), 8, 2), sl);
  b.add(tri(V(-58, D0 + 13, -82), V(-58, D0 + 13, -70), V(-58, D0 + 16.5, -76)), millS);
  b.add(tri(V(-28, D0 + 13, -70), V(-28, D0 + 13, -82), V(-28, D0 + 16.5, -76)), millS);
  const chim = lam("chimney", () => ({ map: rep(brick(), 2, 8) })), soot = lam("soot", () => ({ color: "#4a3442" }));
  for (const [x, z, hh] of [[-22, -77, 30], [-80, 93, 24]] as const) {
    b.add(new THREE.CylinderGeometry(0.95, 1.35, hh, 14, 1, true), chim, new THREE.Matrix4().makeTranslation(x, D0 + hh / 2, z));
    b.add(new THREE.CylinderGeometry(1.15, 1.1, 1.3, 14), soot, new THREE.Matrix4().makeTranslation(x, D0 + hh + 0.3, z));
  }
  house(b, -80, 100, Math.PI, 16, 10, 9.8, 7);
  // hills around the valley
  const hill = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const hm = [lam("hillA", () => ({ color: "#78b257" })), lam("hillB", () => ({ color: "#6aa24e" })), lam("hillC", () => ({ color: "#8bbf63" }))];
  ([[-360, 250, 190, 52, 120], [140, 380, 240, 64, 140], [430, 150, 170, 48, 130], [-440, -130, 190, 44, 150], [-90, -390, 250, 58, 140],
    [320, -330, 210, 54, 130], [520, -60, 160, 40, 120], [-560, 60, 200, 46, 140]] as const).forEach(([x, z, sx, sy, sz], i) =>
    i === 4 || i === 5 ? undefined : b.add(hill, hm[i % 3], new THREE.Matrix4().compose(V(x, D0 - 2, z), new THREE.Quaternion(), V(sx, sy, sz))));
  // trees: quays, gardens, valley, hilltops
  const trees = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree-high-round", "tree"];
  for (const bank of [-1, 1]) for (let x = -130; x <= 130; x += 22) if (Math.abs(x) > 12 && !(bank < 0 && x > 2 && x < 40) && !(bank > 0 && x > -66 && x < -14)) prop(b, kit, pick(trees), x + r() * 4, D0, bank * 33.6, 7 + r() * 2.5, r() * 6);
  for (let i = 0; i < 140; i++) {
    const x = (r() - 0.5) * 520, z = (r() < 0.5 ? -1 : 1) * (48 + r() * 220);
    if (inPark(x, z) || inMill(x, z) || inChurch(x, z) || inDome(x, z) || Math.abs(x) < 16 || inWhittier(x, z)) continue;
    prop(b, kit, pick(trees), x, D0, z, 7 + r() * 4, r() * 6);
  }
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2, d = 230 + r() * 160;
    if (inWhittier(Math.cos(a) * d * 1.3, Math.sin(a) * d)) continue;
    prop(b, kit, pick(["tree_cone", "tree_default", "tree_oak"]), Math.cos(a) * d * 1.3, D0, Math.sin(a) * d, 12 + r() * 6, r() * 6);
  }
  // quay furniture
  for (const bank of [-1, 1]) {
    for (let x = -126; x <= 126; x += 12) if (Math.abs(x) > 5) prop(b, kit, "lantern", x, D0, bank * 31.0, 2.8);
    prop(b, kit, "banner-red", 5.4, D0, bank * 31.6, 3.6, bank > 0 ? Math.PI : 0);
  }
  prop(b, kit, "stall-red", -14, D0, -34, 3.2);
  prop(b, kit, "stall-green", -21.5, D0, -34.4, 3.2, 0.1);
  // round 4: this cart sat blurred in shot 11's bottom-left corner (lens at 14, 10.5, -47) as a grey "mushroom"
  // (bed + handle + wheel); moved 3.5 m along the quay, out of that frame, still dressing the market
  prop(b, kit, "cart", 17.0, D0, -34.0, 2.2, 1.2);
  prop(b, kit, "stall-bench", 20, D0, -32.2, 1.0);
  prop(b, kit, "stall-green", 16, D0, 34, 3.2, Math.PI);
  prop(b, kit, "stall-red", 23.5, D0, 34.3, 3.2, Math.PI);
  prop(b, kit, "cart", -15, D0, 33.6, 2.2, 2.4);
  prop(b, kit, "windmill", 98, D0, 72, 16, -0.6);
  prop(b, kit, "canoe", -19, 0.02, 27.6, 0.7, 1.5);
  prop(b, kit, "canoe", 31, 0.02, -28.2, 0.7, -1.4);
  for (let i = 0; i < 14; i++) prop(b, kit, "lily_large", (r() - 0.5) * 120, 0.03, (r() < 0.5 ? -1 : 1) * (27.2 + r() * 2.2), 0.08, r() * 6);
  // park around the swing (near bank, x 50..92, z -96..-56)
  for (const [n, x, z, h] of [["tree_oak", 58, -66, 9.5], ["tree_fat", 84, -64, 8], ["tree_detailed", 54, -84, 9], ["tree_default", 88, -86, 9],
    ["tree_oak", 79, -95, 10], ["tree-high-round", 61, -94, 9], ["tree_default", 92, -73, 8.5]] as const) prop(b, kit, n, x, D0, z, h, x);
  for (let x = 50; x < 92; x += 3.2) prop(b, kit, "hedge", x, D0, -57, 1.5);
  for (const [x, z] of [[62, -76], [77, -71], [66, -82], [75, -80], [57, -73]]) prop(b, kit, pick(["plant_bushLarge", "plant_bushDetailed", "plant_bush"]), x, D0, z, 1.3);
  // flowers only (inked grass tufts read as green boxes), and none inside the swing's 4 m circle
  for (let i = 0; i < 26; i++) {
    const f = pick(["flower_redA", "flower_yellowA", "flower_purpleA"]), x = 56 + r() * 30, z = -60 - r() * 32;
    if (Math.hypot(x - 70, z + 75) > 4) prop(b, kit, f, x, D0, z, 0.5);
  }
  prop(b, kit, "stall-bench", 76.5, D0, -79.5, 1.0, Math.PI);
  prop(b, kit, "lantern", 64.5, D0, -71, 2.8);
  for (let x = 8; x <= 24; x += 3.4) bench(b, x, QUAY_Z - 0.3, 0); // quay benches face the river (+z), none near the door (x 30)
  b.build(root);
  sight = [];
};

// ======================= ELIZA sets =======================
const col = (key: string, c: string) => lam(key, () => ({ color: c }));
const cyl = (r0: number, r1: number, h: number, n = 16) => new THREE.CylinderGeometry(r0, r1, h, n);
const at = (x: number, y: number, z: number, yaw = 0) => new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);

/** a park / quay bench: seat along local x (2.2 m), facing local +z */
export const bench = (b: Batch, x: number, z: number, yaw: number) => {
  const m = at(x, D0, z, yaw), wood = col("benchWood", "#9a6a43"), iron = col("benchIron", "#3d414c");
  for (const s of [-1, 1]) {
    b.add(boxGeo(V(s * 0.95 - 0.04, 0, -0.25), V(s * 0.95 + 0.04, 0.45, 0.25)), iron, m);
    b.add(boxGeo(V(s * 0.95 - 0.04, 0.45, -0.28), V(s * 0.95 + 0.04, 0.95, -0.2)), iron, m);
  }
  for (const z0 of [-0.22, -0.06, 0.1]) b.add(boxGeo(V(-1.1, 0.42, z0), V(1.1, 0.47, z0 + 0.13)), wood, m);
  for (const y0 of [0.6, 0.78]) b.add(boxGeo(V(-1.1, y0, -0.29), V(1.1, y0 + 0.12, -0.24)), wood, m);
};

// ---------------- interiors: five rooms far down the valley ----------------
const plaster = (key: string, base: string) => ctex("plaster" + key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.10)" : "rgba(120,90,60,0.06)"; g.fillRect(r() * 512, r() * 512, 3 + r() * 14, 2 + r() * 8); }
});
const boards = (key: string, a: string, b2: string) => ctex("boards" + key, 512, 512, (g, r) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b2; g.fillRect(0, i * 64, 512, 64); }
  g.strokeStyle = "rgba(40,25,20,0.4)"; g.lineWidth = 3;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke(); }
  for (let i = 0; i < 8; i++) { const x = (i * 197) % 512; g.beginPath(); g.moveTo(x, i * 64); g.lineTo(x, i * 64 + 64); g.stroke(); }
  for (let i = 0; i < 60; i++) { g.fillStyle = "rgba(90,50,30,0.08)"; g.fillRect(r() * 512, r() * 512, 40 + r() * 80, 2); }
});
const carpet = () => ctex("carpetWed", 256, 256, (g, r) => {
  g.fillStyle = "#b8434e"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,220,200,0.06)" : "rgba(60,0,20,0.08)"; g.fillRect(r() * 256, r() * 256, 2, 2); }
  g.strokeStyle = "rgba(240,200,120,0.35)"; g.lineWidth = 4; g.strokeRect(16, 16, 224, 224);
});
const windowView = (key: string, sky: [string, string], ground: string, moon = false) => ctex("win" + key, 512, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]);
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = ground; for (const [x, w, h] of [[0, 120, 160], [110, 90, 230], [190, 140, 130], [320, 80, 200], [390, 122, 150]]) g.fillRect(x, 512 - h, w, h);
  g.fillStyle = moon ? "#ffe9a8" : "rgba(255,240,200,0.65)"; for (let i = 0; i < 26; i++) g.fillRect(((i * 97) % 480) + 10, 512 - ((i * 53) % 190) - 20, 12, 14);
  if (moon) { g.fillStyle = "#fff6d8"; g.beginPath(); g.arc(380, 110, 46, 0, 7); g.fill(); g.fillStyle = sky[0]; g.beginPath(); g.arc(400, 96, 40, 0, 7); g.fill(); }
  g.fillStyle = "#f6f1e4"; g.fillRect(246, 0, 20, 512); g.fillRect(0, 246, 512, 20);
  g.strokeStyle = "#f6f1e4"; g.lineWidth = 28; g.strokeRect(0, 0, 512, 512);
});
const frameArt = (key: string, c1: string, c2: string) => ctex("art" + key, 256, 320, (g) => {
  g.fillStyle = "#f4ead6"; g.fillRect(0, 0, 256, 320); g.fillStyle = c1; g.beginPath(); g.arc(128, 140, 70, 0, 7); g.fill();
  g.fillStyle = c2; g.fillRect(40, 210, 176, 70); g.strokeStyle = "#5a3b2a"; g.lineWidth = 18; g.strokeRect(0, 0, 256, 320);
});

type RoomOpt = { w: number; d: number; h: number; wall: THREE.Material; floor: THREE.Material; wains?: THREE.Material; win?: THREE.Material; winX?: number };
/** a room open toward +z (the lens side): floor, back + side walls, ceiling, optional wainscot and back-wall window */
const room = (wb: Batch, rm: Room, o: RoomOpt) => {
  const P = (x: number, y: number, z: number) => V(...R(rm, x, y, z));
  const hw = o.w / 2, zb = -o.d / 2, zf = o.d / 2 + 2;
  wb.add(boxGeo(P(-hw, -0.1, zb), P(hw, 0, zf), 1.6), o.floor);
  wb.add(boxGeo(P(-hw - 0.2, 0, zb - 0.2), P(hw + 0.2, o.h, zb)), o.wall);
  for (const s of [-1, 1]) wb.add(boxGeo(P(s < 0 ? -hw - 0.2 : hw, 0, zb), P(s < 0 ? -hw : hw + 0.2, o.h, zf)), o.wall);
  wb.add(boxGeo(P(-hw - 0.2, o.h, zb - 0.2), P(hw + 0.2, o.h + 0.1, zf), 0, true), o.wall);
  if (o.wains) { // flat panels 5 mm off the walls: a 3 cm box top drew a broken, crawling ink line
    wb.add(quad(P(-hw, 0, zb + 0.005), P(hw, 0, zb + 0.005), P(hw, 1.0, zb + 0.005), P(-hw, 1.0, zb + 0.005)), o.wains);
    wb.add(quad(P(-hw + 0.005, 0, zf), P(-hw + 0.005, 0, zb), P(-hw + 0.005, 1.0, zb), P(-hw + 0.005, 1.0, zf)), o.wains);
    wb.add(quad(P(hw - 0.005, 0, zb), P(hw - 0.005, 0, zf), P(hw - 0.005, 1.0, zf), P(hw - 0.005, 1.0, zb)), o.wains); }
  if (o.win) { const x = o.winX ?? 0; wb.add(quad(P(x - 1.1, 1.0, zb + 0.02), P(x + 1.1, 1.0, zb + 0.02), P(x + 1.1, 2.5, zb + 0.02), P(x - 1.1, 2.5, zb + 0.02)), o.win); }
};
const tableRound = (fb: Batch, rm: Room, x: number, z: number, r: number) => {
  const cloth = col("cloth", "#f7f3ea");
  fb.add(cyl(r, r * 1.02, 0.7, 28), cloth, new THREE.Matrix4().makeTranslation(...R(rm, x, 0.35, z)));
  fb.add(new THREE.SphereGeometry(0.1, 12, 8), col("flowers", "#f08aa8"), new THREE.Matrix4().makeTranslation(...R(rm, x, 0.74, z))); // low posy
};
const tableRect = (fb: Batch, rm: Room, x0: number, x1: number, z0: number, z1: number, top: THREE.Material, h = 0.74) => {
  const P = (x: number, y: number, z: number) => V(...R(rm, x, y, z)), leg = col("tableLeg", "#5a3b2a");
  fb.add(boxGeo(P(x0, h - 0.06, z0), P(x1, h, z1)), top);
  for (const [x, z] of [[x0 + 0.04, z0 + 0.04], [x1 - 0.1, z0 + 0.04], [x0 + 0.04, z1 - 0.1], [x1 - 0.1, z1 - 0.1]]) fb.add(boxGeo(P(x, 0, z), P(x + 0.06, h - 0.06, z + 0.06)), leg);
};
const chair = (fb: Batch, rm: Room, x: number, z: number, back = -1) => {
  const P = (px: number, y: number, pz: number) => V(...R(rm, px, y, pz)), wood = col("chairWood", "#8a5a34"), dark = col("chairLeg", "#3a3d47");
  fb.add(boxGeo(P(x - 0.23, 0.44, z - 0.23), P(x + 0.23, 0.5, z + 0.23)), wood);
  fb.add(boxGeo(P(x - 0.23, 0.5, z + back * 0.27), P(x + 0.23, 1.0, z + back * 0.21)), wood);
  for (const [lx, lz] of [[-0.21, -0.21], [0.18, -0.21], [-0.21, 0.18], [0.18, 0.18]]) fb.add(boxGeo(P(x + lx, 0, z + lz), P(x + lx + 0.03, 0.44, z + lz + 0.03)), dark);
};
// ---------------- "The Slow Lane" textures ----------------
const tiles = () => ctex("tilesShop", 512, 512, (g, r) => {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? "#e9e3d6" : "#d9d1c0"; g.fillRect(x * 128, y * 128, 128, 128); }
  g.strokeStyle = "rgba(90,80,70,0.35)"; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); }
  for (let i = 0; i < 120; i++) { g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(r() * 512, r() * 512, 20 + r() * 40, 2); }
});
const PRODUCTS = ["#e2563f", "#f2c94c", "#5a8fc2", "#6aab4f", "#f272b0", "#f4f1ea", "#d9a05a", "#7b5ac9", "#3f8f8a"];
/** shelf front: four shelves of colourful packs, 1024 x 512 for a 5.5 x 2.0 m unit */
const shelfTex = (key: string) => ctex("shelf" + key, 1024, 512, (g, r) => {
  g.fillStyle = "#cfd6dd"; g.fillRect(0, 0, 1024, 512);
  for (let row = 0; row < 4; row++) {
    const y1 = 120 + row * 124; let x = 8;
    while (x < 1010) {
      const w = 26 + r() * 40, h = 60 + r() * 44, c = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
      const n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n && x < 1010; k++, x += w + 3) {
        g.fillStyle = c; g.fillRect(x, y1 - h, w, h); g.fillStyle = "rgba(255,255,255,0.55)"; g.fillRect(x + 4, y1 - h + 10, w - 8, 10);
        g.strokeStyle = "rgba(36,23,38,0.6)"; g.lineWidth = 2.5; g.strokeRect(x, y1 - h, w, h);
      }
      x += 6;
    }
    g.fillStyle = "#8a929c"; g.fillRect(0, y1, 1024, 12); g.fillStyle = "#f6f1e4"; for (let px = 30; px < 1000; px += 90) g.fillRect(px, y1 + 2, 30, 8);
  }
  g.fillStyle = "#8a929c"; g.fillRect(0, 0, 1024, 10);
});
/** shop window seen from the quay: lit shelves inside, glass sheen; unlit material (the interior glows at dusk) */
const shopWin = (key: string) => ctex("shopWin" + key, 512, 384, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, "#fff3d4"); gr.addColorStop(1, "#f0d9a8"); g.fillStyle = gr; g.fillRect(0, 0, 512, 384);
  for (let row = 0; row < 3; row++) { let x = 0; const y1 = 130 + row * 100;
    while (x < 512) { const w = 20 + r() * 30, h = 40 + r() * 30; g.fillStyle = PRODUCTS[Math.floor(r() * PRODUCTS.length)]; g.fillRect(x, y1 - h, w, h); x += w + 4; }
    g.fillStyle = "#a8aeb6"; g.fillRect(0, y1, 512, 8); }
  g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.moveTo(60, 0); g.lineTo(150, 0); g.lineTo(40, 384); g.lineTo(-50, 384); g.fill();
  g.strokeStyle = "#2f5f5a"; g.lineWidth = 18; g.strokeRect(0, 0, 512, 384);
});
const signBand = () => ctex("shopSign", 1024, 128, (g) => {
  g.fillStyle = "#2f5f5a"; g.fillRect(0, 0, 1024, 128);
  g.font = "900 82px Montserrat, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 10; g.strokeStyle = "#1b1420"; g.strokeText("SUPERMARKET", 512, 68); g.fillStyle = "#f6d24a"; g.fillText("SUPERMARKET", 512, 68);
  g.strokeStyle = "#f6d24a"; g.lineWidth = 6; g.strokeRect(10, 10, 1004, 108);
});
const awning = () => ctex("awning", 256, 128, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f4f1ea" : "#3f8f8a"; g.fillRect(i * 32, 0, 32, 128); } });
const wallClock = (h: number) => ctex("wallClock" + h, 256, 256, (g) => {
  g.fillStyle = "#f7f1e1"; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.strokeStyle = "#5a3b2a"; g.lineWidth = 14; g.stroke();
  g.fillStyle = "#241726"; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillRect(128 + 96 * Math.sin(a) - 4, 128 - 96 * Math.cos(a) - 4, 8, 8); }
  g.strokeStyle = "#241726"; g.lineCap = "round"; const ah = (h / 12) * Math.PI * 2;
  g.lineWidth = 12; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 56 * Math.sin(ah), 128 - 56 * Math.cos(ah)); g.stroke();
  g.lineWidth = 8; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 40); g.stroke();
});
const unlit = (key: string, tex: () => THREE.Texture, k = 1) => { const m = new THREE.MeshBasicMaterial({ map: tex() }); m.color.setScalar(k); m.name = key; return m; };

const panel = () => ctex("panelOffice", 512, 512, (g, r) => {
  g.fillStyle = "#8a5a3c"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 128) for (let y = 0; y < 512; y += 256) {
    g.fillStyle = "#9a6a48"; g.fillRect(x + 14, y + 14, 100, 228); g.strokeStyle = "rgba(40,22,14,0.55)"; g.lineWidth = 5; g.strokeRect(x + 14, y + 14, 100, 228);
    for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(60,30,15,0.10)"; g.fillRect(x + 20 + r() * 80, y + 20 + r() * 200, 2, 30 + r() * 60); }
  }
});
const doorTex = (key: string, col: string) => ctex("door" + key, 256, 512, (g) => {
  g.fillStyle = col; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = "rgba(30,18,12,0.55)"; g.lineWidth = 8; g.strokeRect(30, 30, 196, 200); g.strokeRect(30, 270, 196, 210);
  g.fillStyle = "#d9b46a"; g.beginPath(); g.arc(210, 270, 12, 0, 7); g.fill(); g.strokeStyle = "#1b1420"; g.lineWidth = 6; g.strokeRect(0, 0, 256, 512);
});
const plate = (key: string, text: string, w = 512) => ctex("plate" + key, w, 128, (g) => {
  g.fillStyle = "#d9b46a"; g.fillRect(0, 0, w, 128); g.strokeStyle = "#5a3b2a"; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, 116);
  g.font = "900 64px Montserrat, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#2b2230"; g.fillText(text, w / 2, 68, w - 40);
});
const shoji = () => ctex("shoji", 512, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#ffe2b0"); gr.addColorStop(1, "#ffc98a"); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#5a3b2a"; g.lineWidth = 10; for (let x = 0; x <= 512; x += 85) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.lineWidth = 24; g.strokeRect(0, 0, 512, 512);
});
const eyeChart = () => ctex("eyeChart", 256, 384, (g) => {
  g.fillStyle = "#fbfbf6"; g.fillRect(0, 0, 256, 384); g.fillStyle = "#1b1420"; g.textAlign = "center";
  [["E", 96, 70], ["F P", 60, 150], ["T O Z", 40, 215], ["L P E D", 28, 265], ["P E C F D", 20, 305], ["E D F C Z P", 14, 340]].forEach(([t, s, y]) => { g.font = `900 ${s}px Arial`; g.fillText(t as string, 128, y as number); });
  g.strokeStyle = "#5a3b2a"; g.lineWidth = 10; g.strokeRect(0, 0, 256, 384);
});
const snowWin = () => ctex("snowWin", 512, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#9fc3e6"); gr.addColorStop(1, "#e6f0fa"); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#f7f9fc"; g.fillRect(0, 360, 512, 152);
  for (const [x, h] of [[30, 150], [90, 190], [400, 170], [460, 210], [350, 130]]) { g.fillStyle = "#2f5a3f"; g.beginPath(); g.moveTo(x, 380 - h); g.lineTo(x - 34, 380); g.lineTo(x + 34, 380); g.fill();
    g.fillStyle = "#f7f9fc"; g.beginPath(); g.moveTo(x, 380 - h); g.lineTo(x - 12, 380 - h + 40); g.lineTo(x + 12, 380 - h + 40); g.fill(); }
  g.fillStyle = "#b8343a"; g.fillRect(180, 290, 130, 90); g.fillStyle = "#f7f9fc"; g.beginPath(); g.moveTo(168, 292); g.lineTo(245, 240); g.lineTo(322, 292); g.fill();
  g.fillStyle = "#ffe9a8"; g.fillRect(210, 315, 26, 24); g.fillRect(256, 315, 26, 24);
  g.fillStyle = "#f6f1e4"; g.fillRect(246, 0, 20, 512); g.fillRect(0, 246, 512, 20); g.strokeStyle = "#f6f1e4"; g.lineWidth = 28; g.strokeRect(0, 0, 512, 512);
});
const deskAt = (fb: Batch, rm: Room, x0: number, x1: number, z0: number, z1: number, top: string, front: string) => {
  const P = (x: number, y: number, z: number) => V(...R(rm, x, y, z));
  fb.add(boxGeo(P(x0, 0, z0), P(x1, 0.76, z1)), col("desk" + rm, top));
  fb.add(quad(P(x0 + 0.05, 0.06, z1 + 0.005), P(x1 - 0.05, 0.06, z1 + 0.005), P(x1 - 0.05, 0.7, z1 + 0.005), P(x0 + 0.05, 0.7, z1 + 0.005)), col("deskFront" + rm, front));
};
const bigChair = (fb: Batch, rm: Room, x: number, z: number, c: string) => {
  const P = (px: number, y: number, pz: number) => V(...R(rm, px, y, pz)), m = col("bigChair" + rm, c);
  fb.add(boxGeo(P(x - 0.3, 0.4, z - 0.28), P(x + 0.3, 0.5, z + 0.25)), m);
  fb.add(boxGeo(P(x - 0.32, 0.5, z - 0.36), P(x + 0.32, 1.45, z - 0.26)), m);
  fb.add(cyl(0.04, 0.04, 0.4, 8), col("chairLeg", "#3a3d47"), new THREE.Matrix4().makeTranslation(...R(rm, x, 0.2, z)));
};
const siding = (key: string, base: string, alt: string) => ctex("siding" + key, 512, 512, (g, r) => {
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? base : alt; g.fillRect(0, i * 32, 512, 32); }
  g.strokeStyle = "rgba(40,22,14,0.45)"; g.lineWidth = 3; for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(512, i * 32); g.stroke(); }
  for (let i = 0; i < 80; i++) { g.fillStyle = "rgba(60,30,15,0.08)"; g.fillRect(r() * 512, r() * 512, 30 + r() * 60, 2); }
});
const frontTex = (key: string, wall: string, alt: string, text: string, doorX: number, wins: number[]) => ctex("front" + key, 1024, 512, (g, r) => {
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? wall : alt; g.fillRect(0, i * 32, 1024, 32); }
  g.strokeStyle = "rgba(40,22,14,0.4)"; g.lineWidth = 3; for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(1024, i * 32); g.stroke(); }
  for (const x of wins) { g.fillStyle = "#f6f1e4"; g.fillRect(x - 74, 170, 148, 170); g.fillStyle = "#ffd98a"; g.fillRect(x - 60, 184, 120, 142); g.fillStyle = "#f6f1e4"; g.fillRect(x - 4, 184, 8, 142); g.fillRect(x - 60, 250, 120, 8); }
  g.fillStyle = "#f6f1e4"; g.fillRect(doorX - 70, 200, 140, 312); g.fillStyle = "#5a3b2a"; g.fillRect(doorX - 56, 214, 112, 298);
  g.fillStyle = "#ffd98a"; g.fillRect(doorX - 40, 236, 80, 70); g.fillStyle = "#f2c94c"; g.beginPath(); g.arc(doorX + 36, 380, 8, 0, 7); g.fill();
  if (text) { g.fillStyle = "#f6f1e4"; g.fillRect(150, 40, 724, 96); g.strokeStyle = "#5a3b2a"; g.lineWidth = 8; g.strokeRect(150, 40, 724, 96);
    g.font = "900 70px Montserrat, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#5a3b2a"; g.fillText(text, 512, 92, 680); }
});
const asphalt = () => ctex("asphalt", 256, 256, (g, r) => { g.fillStyle = "#5a5d66"; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"; g.fillRect(r() * 256, r() * 256, 2, 2); } });
// ======================= "The Loneliest Whale" sets =======================
/** the deep: a vertical gradient for the inside of the water sphere (top of the canvas = surface) */
const deepTex = () => ctex("deepSky", 64, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#bfe8f5"); gr.addColorStop(0.3, "#4aa3c9"); gr.addColorStop(0.5, "#1f6f9a"); gr.addColorStop(0.75, "#0f3f66"); gr.addColorStop(1, "#08243f");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
});
const sandTex = () => ctex("seaSand", 512, 512, (g, r) => {
  g.fillStyle = "#c9b98f"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.10)" : "rgba(90,70,40,0.10)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 4 + r() * 22, 2 + r() * 6, 0, 0, 7); g.fill(); }
});
const sonarTex = () => ctex("sonarWall", 512, 512, (g, r) => {
  g.fillStyle = "#5a6470"; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) { g.fillStyle = "rgba(0,0,0,0.10)"; g.fillRect(0, y, 512, 3); }
  for (let i = 0; i < 40; i++) { g.fillStyle = ["#d8433e", "#6aab4f", "#f2c94c"][Math.floor(r() * 3)]; g.beginPath(); g.arc(r() * 512, r() * 512, 5, 0, 7); g.fill(); }
});
const conc = (key: string, base: string, stripe: string) => ctex("conc" + key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512); g.fillStyle = stripe; g.fillRect(0, 300, 512, 60);
  for (let i = 0; i < 160; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.08)" : "rgba(80,60,40,0.06)"; g.fillRect(r() * 512, r() * 512, 4 + r() * 16, 2 + r() * 6); }
});
const lampTex = () => ctex("ceilLamp", 64, 64, (g) => { g.fillStyle = "#fff4d6"; g.fillRect(0, 0, 64, 64); });
const seaTex = () => ctex("seaTop", 512, 512, (g, r) => {
  g.fillStyle = "#2f6f9a"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.16)" : "rgba(10,40,70,0.18)"; g.fillRect(r() * 512, r() * 512, 10 + r() * 40, 2 + r() * 3); }
});
export const buildRooms = (root: THREE.Object3D) => {
  const wb = new Batch(), fb = new Batch();
  const lamp = new THREE.MeshBasicMaterial({ map: lampTex(), color: new THREE.Color(1.4, 1.35, 1.2) });
  // ---- the lonely flat at night: armchair, side table, moon window, clock ----
  room(wb, "homeN", { w: 5, d: 5, h: 2.6, wall: lam("plHomeN", () => ({ map: plaster("homeN", "#c9b48f") })), floor: lam("bdHomeN", () => ({ map: boards("homeN", "#8f6a48", "#86613f") })),
    win: new THREE.MeshBasicMaterial({ map: windowView("homeN", ["#0d1838", "#2b3c70"], "#141c3a", true), color: new THREE.Color(0.75, 0.78, 1.0) }), winX: 1.1 });
  const Q = (x: number, y: number, z: number) => V(...R("homeN", x, y, z)), cloth = col("armchair", "#3f6f6a");
  fb.add(boxGeo(Q(-0.9, 0, -2.15), Q(0.1, 0.42, -1.3)), cloth);
  fb.add(boxGeo(Q(-0.9, 0.42, -2.3), Q(0.1, 1.15, -2.1)), cloth);
  for (const x of [-0.98, 0.02]) fb.add(boxGeo(Q(x, 0, -2.15), Q(x + 0.16, 0.66, -1.3)), cloth);
  fb.add(boxGeo(Q(0.4, 0, -2.2), Q(0.85, 0.6, -1.75)), col("sideTable", "#8a5a34"));
  fb.add(quad(Q(-1.75, 1.6, -2.47), Q(-1.25, 1.6, -2.47), Q(-1.25, 2.1, -2.47), Q(-1.75, 2.1, -2.47)), lam("clock2", () => ({ map: wallClock(2) })));
  // ---- the deep: a big unlit gradient sphere (no corners to ink), a sand floor disc, rocks, a Navy hydrophone ----
  { const c = V(...R("deep", 0, 0, 0));
    const sph = new THREE.Mesh(new THREE.SphereGeometry(70, 48, 24), new THREE.MeshBasicMaterial({ map: deepTex(), side: THREE.BackSide, fog: false }));
    sph.position.copy(c); root.add(sph);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(66, 64), new THREE.MeshLambertMaterial({ map: (() => { const t = sandTex(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 16); return t; })() }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(c.x, c.y + 0.01, c.z); disc.receiveShadow = true; root.add(disc); }
  const Dp = (x: number, y: number, z: number) => V(...R("deep", x, y, z));
  for (const [x, z, r] of [[-7, -6, 1.6], [6, -9, 2.2], [-12, -16, 3], [10, -20, 3.5], [2, -4, 0.8], [-3, -12, 1.2]] as number[][])
    fb.add(new THREE.DodecahedronGeometry(r, 0), col("seaRock", "#6f7a86"), new THREE.Matrix4().makeScale(1, 0.6, 1).setPosition(Dp(x, r * 0.3, z)));
  fb.add(boxGeo(Dp(17.1, 0, 2.6), Dp(18.9, 0.3, 4.4)), col("hydroBase", "#3a3d47"));
  fb.add(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 18), col("hydro", "#f2c94c"), new THREE.Matrix4().makeTranslation(...Dp(18, 0.85, 3.5).toArray() as [number, number, number]));
  fb.add(new THREE.SphereGeometry(0.34, 18, 12), col("hydro", "#f2c94c"), new THREE.Matrix4().makeTranslation(...Dp(18, 1.42, 3.5).toArray() as [number, number, number]));
  // ---- the Navy listening station: grey walls, consoles ----
  room(wb, "station", { w: 6, d: 5, h: 2.7, wall: lam("plStation", () => ({ map: conc("station", "#a9b2bc", "#5a6470") })), floor: lam("flStation", () => ({ color: "#4d5566" })) });
  const St = (x: number, y: number, z: number) => V(...R("station", x, y, z));
  fb.add(boxGeo(St(-2.6, 0, -2.5), St(2.6, 0.85, -1.7)), lam("console", () => ({ map: sonarTex() })));
  for (const x of [-2.2, 2.2]) wb.add(quad(St(x - 0.4, 2.69, 0.4), St(x + 0.4, 2.69, 0.4), St(x + 0.4, 2.69, -0.4), St(x - 0.4, 2.69, -0.4)), lamp);
  // ---- the Woods Hole lab: warm walls, a desk, a big map board ----
  room(wb, "lab", { w: 6, d: 5, h: 2.7, wall: lam("plLab", () => ({ map: plaster("lab", "#e9d6b0") })), floor: lam("bdLab", () => ({ map: boards("lab", "#a8724a", "#9f6a43") })),
    wains: lam("wnLab", () => ({ color: "#3f6f8a" })) });
  const Lb = (x: number, y: number, z: number) => V(...R("lab", x, y, z));
  fb.add(boxGeo(Lb(-1.6, 0, -1.6), Lb(1.6, 0.74, -0.9)), col("deskLab", "#8a5a34"));
  fb.add(boxGeo(Lb(0.5, 0.74, -1.5), Lb(1.1, 1.14, -1.45)), col("monitor", "#2b2230"));
  for (const x of [-1.5, 1.5]) wb.add(quad(Lb(x - 0.5, 2.69, 0.4), Lb(x + 0.5, 2.69, 0.4), Lb(x + 0.5, 2.69, -0.4), Lb(x - 0.5, 2.69, -0.4)), lamp);
  // ---- the open sea at the surface: water to the horizon, a small research boat ----
  const W = (x: number, y: number, z: number) => V(MX + x, D0 + y, MZ + z);
  wb.add(quad(W(-250, 0.05, 120), W(250, 0.05, 120), W(250, 0.05, -300), W(-250, 0.05, -300), 40, 34), lam("seaTop", () => ({ map: (() => { const t = seaTex(); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })() })));
  fb.add(boxGeo(W(-2.6, -0.3, -1.1), W(2.6, 0.9, 1.1)), col("hullW", "#f4f1ea")); fb.add(boxGeo(W(-2.6, -0.3, -1.12), W(2.6, 0.2, 1.12)), col("hullR", "#d8433e"));
  fb.add(boxGeo(W(-2.0, 0.9, -0.9), W(-0.2, 2.2, 0.9)), col("cabinW", "#3f6f8a"));
  wb.build(root, false);
  fb.build(root, true);
};
/** a flat ground quad (y from the first corner) between two corners in x/z */
const quadUp2 = (a: THREE.Vector3, b: THREE.Vector3) => quad(V(a.x, a.y, b.z), V(b.x, a.y, b.z), V(b.x, a.y, a.z), V(a.x, a.y, a.z));
