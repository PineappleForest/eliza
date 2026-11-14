// Timeline of "Rent Me. I'll Do Nothing." (Shoji Morimoto, Tokyo -> Feeloy): shots cut to the ElevenLabs read
// (production-nothing/voice/words.json, hand-fixed), same camera grammar as the Tower short.
export const FPS = 30;
export const TOTAL = 1250;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { office: -1500, homeN: -1900, train: -2300, plat: -2700, cafe: -3100 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: a Tokyo street out on the open grass south of the river town; shop fronts at z = MZ - 4 (x -20..20),
// the bench at (0, -2), the road toward +z
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -240;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 120, light: "day" },      // hook: a man on a bench doing NOTHING
  { id: 2, a: 120, b: 183, light: "day" },    // thousands of requests
  { id: 3, a: 183, b: 362, light: "day" },    // the office, 2018: FIRED, "useless"
  { id: 4, a: 362, b: 430, light: "day" },    // so he made that his job: the sign
  { id: 5, a: 430, b: 500, light: "day" },    // a marathon finish line
  { id: 6, a: 500, b: 603, light: "day" },    // the train loop, 17 hours
  { id: 7, a: 603, b: 655, light: "day" },    // a goodbye at the station
  { id: 8, a: 655, b: 763, light: "day" },    // the cafe: divorce papers
  { id: 9, a: 763, b: 860, light: "golden" }, // he barely talks, he just stays
  { id: 10, a: 860, b: 960, light: "golden" },// the presence of one human being
  { id: 11, a: 960, b: TOTAL, light: "night" },// a lonely flat at night; Jenny -> end card
];
export const XFADE: Record<number, number> = { 3: 8, 6: 8, 9: 8, 11: 10 };
export const FLASH_AT = 120;
export const CARD_AT = 1154;

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

const E = (x: number, y: number, z: number): V3 => [MX + x, D0 + y, MZ + z];
const Of = (x: number, y: number, z: number) => R("office", x, y, z);
const Tr = (x: number, y: number, z: number) => R("train", x, y, z);
const Pl = (x: number, y: number, z: number) => R("plat", x, y, z);
const Cf = (x: number, y: number, z: number) => R("cafe", x, y, z);
// 1, 2, 4: the street bench; 5: the finish line
const S1a = (f: number) => dolly(E(0.4, 1.5, 4.6), E(0, 1.35, -2.4), pushK(f, 0, 0.0016, 0.006, 30), { fov: 44, roll: 0.02 });
const S2a = (f: number) => dolly(E(-1.2, 2.4, 9), E(0, 2.4, -3), pushK(f, 116, 0.0015), { fov: 46, roll: -0.02 });
const S4a = (f: number) => dolly(E(0.5, 1.45, 4.2), E(0, 1.35, -1.6), pushK(f, 358, 0.0018), { fov: 44 });
const S5a = (f: number) => dolly(E(12.3, 1.7, 8.5), E(12, 1.9, 0.5), pushK(f, 426, 0.0015), { fov: 46, roll: 0.02 });
// 3: the office; 6: the train; 7: the platform; 8: the cafe
const S3a = (f: number) => dolly(Of(0.15, 1.5, 3.9), Of(0.15, 1.3, -1.4), pushK(f, 179, 0.0012, 0.005, 30), { fov: 46 });
const S6a = (f: number) => dolly(Tr(0, 1.25, 2.6), Tr(0, 1.15, -1.3), pushK(f, 496, 0.0012), { fov: 46, roll: 0.02 });
const S7a = (f: number) => dolly(Pl(0.3, 1.6, 4.6), Pl(0, 1.5, -1.6), pushK(f, 599, 0.0015), { fov: 46 });
const S8a = (f: number) => dolly(Cf(-0.35, 1.35, 3.7), Cf(-0.4, 1.05, -1.6), pushK(f, 651, 0.0010, 0.003, 30), { fov: 52, roll: -0.02 });
// 9, 10: the bench in golden light
const S9a = (f: number) => dolly(E(0, 1.3, 3.8), E(0, 1.0, -2.0), pushK(f, 759, 0.0016), { fov: 44 });
const S10a = (f: number) => dolly(E(0.8, 1.5, 5.4), E(0, 1.0, -2.0), pushK(f, 856, 0.0016, 0.004, 30), { fov: 44, roll: 0.02 });
// 11: the lonely flat at night, then the phone
const S11a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 956, 0.0014), { fov: 44 });
const S11b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 1013, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 116, s: S2a }], 3: [{ f: 179, s: S3a }], 4: [{ f: 358, s: S4a }], 5: [{ f: 426, s: S5a }], 6: [{ f: 496, s: S6a }],
  7: [{ f: 599, s: S7a }], 8: [{ f: 651, s: S8a }], 9: [{ f: 759, s: S9a }], 10: [{ f: 856, s: S10a }], 11: [{ f: 951, s: S11a }, { f: 1015, cut: true, s: S11b }],
};

// impact kicks: NOTHING, FIRED, USELESS, 17 HOURS, the papers, one human being
const KICKS: [number, number][] = [[92 / FPS, 0.7], [258 / FPS, 0.6], [337 / FPS, 0.4], [582 / FPS, 0.4], [739 / FPS, 0.4], [941 / FPS, 0.3]];
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
  { f: 0, cInf: 10 }, { f: 120, cInf: 6 }, { f: 183, cInf: 10 }, { f: 362, cInf: 12 }, { f: 430, cInf: 6 }, { f: 500, cInf: 10 }, { f: 603, cInf: 9 },
  { f: 655, cInf: 7 }, { f: 763, cInf: 12 }, { f: 860, cInf: 9 }, { f: 960, cInf: 9 }, { f: 1015, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
