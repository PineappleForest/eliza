// Timeline of "My Battery Is Low" (the Opportunity rover -> Feeloy): shots cut to the ElevenLabs read
// (production-oppy/voice/words.json, hand-fixed), same camera grammar as the Collins short. Mars lives at MOON/M().
export const FPS = 30;
export const TOTAL = 956;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { homeN: -1900, ctrl: -2300 } as const;
/** deep space (star sphere radius 180) high above the valley; the lunar surface in its own star sphere */
export const SPACE: V3 = [0, 420, -2700];
export const S = (x: number, y: number, z: number): V3 => [SPACE[0] + x, SPACE[1] + y, SPACE[2] + z];
export const MOON: V3 = [0, 420, -3300];
export const M = (x: number, y: number, z: number): V3 => [MOON[0] + x, MOON[1] + y, MOON[2] + z];
export const COL: V3 = [0, -2, 0];
/** Mars shots (the surface lives at MOON): orange haze by day; the dust storm thickens it in shot 2 */
export const MARS_SHOTS = new Set([1, 2, 3, 6]);
export const SPACE_SHOTS = new Set<number>([]);
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: an English seafront out on the grass south of the river town; the bench at (0, -2) faces +z, the sea wall
// at z -4, sand and the sea behind it, a pier at x 9..13
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -240;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 169, light: "day" },      // hook: built for 90 days, lasted 15 years
  { id: 2, a: 169, b: 310, light: "day" },    // 2018: a dust storm blocks the sun; it goes quiet
  { id: 3, a: 310, b: 468, light: "night" },  // the last signal: battery low, getting dark
  { id: 4, a: 468, b: 583, light: "day" },    // eight months: NASA calls it 1,000+ times
  { id: 5, a: 583, b: 650, light: "day" },    // then they played it one last song (control room)
  { id: 6, a: 650, b: 701, light: "night" },  // I'll Be Seeing You: notes float up over the rover
  { id: 7, a: 701, b: TOTAL, light: "night" },// no one should go dark alone; Jenny answers -> end card
];
export const XFADE: Record<number, number> = { 2: 6, 3: 10, 6: 8, 7: 10 };
export const FLASH_AT = 169;
export const CARD_AT = 860;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });

const Ct = (x: number, y: number, z: number) => R("ctrl", x, y, z);
const S1a = (f: number) => dolly(M(1.1, 1.0, 3.6), M(0, 0.75, -2.0), pushK(f, 0, 0.0016, 0.005, 30), { fov: 44, roll: 0.02 });
const S2a = (f: number) => dolly(M(-1.4, 1.3, 4.6), M(0, 0.9, -2.0), pushK(f, 165, 0.0012), { fov: 46, roll: -0.02 });
const S3a = (f: number) => dolly(M(0.5, 0.9, 2.6), M(0, 0.7, -2.0), pushK(f, 306, 0.0016, 0.005, 30), { fov: 44 });
const S4a = (f: number) => dolly(Ct(0.3, 1.45, 2.6), Ct(0.1, 1.3, -1.6), pushK(f, 464, 0.0014), { fov: 48, roll: 0.02 });
const S5a = (f: number) => dolly(Ct(-0.4, 1.35, 2.0), Ct(-0.2, 1.2, -1.4), pushK(f, 579, 0.0016), { fov: 46 });
const S6a = (f: number) => dolly(M(0, 0.85, 4.2), M(0, 1.55, -3.0), pushK(f, 646, 0.0016, 0.004, 30), { fov: 48, roll: 0.02 });
const S7a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 697, 0.0012), { fov: 44 });
const S7b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 802, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 165, s: S2a }], 3: [{ f: 306, s: S3a }], 4: [{ f: 464, s: S4a }], 5: [{ f: 579, s: S5a }], 6: [{ f: 646, s: S6a }],
  7: [{ f: 692, s: S7a }, { f: 804, cut: true, s: S7b }],
};

// impact kicks: the X on 90 DAYS, 15 YEARS, a THOUSAND
const KICKS: [number, number][] = [[100 / FPS, 0.5], [143 / FPS, 0.4], [540 / FPS, 0.4]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens: depth of field ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 10 }, { f: 169, cInf: 8 }, { f: 310, cInf: 12 }, { f: 468, cInf: 10 }, { f: 583, cInf: 12 }, { f: 650, cInf: 4 }, { f: 701, cInf: 9 }, { f: 804, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
