// Timeline of "The Loneliest Whale" (52 Hz -> Feeloy): shots cut to the ElevenLabs read
// (production-whale/voice/words.json, hand-fixed), same camera grammar as the Nothing short.
export const FPS = 30;
export const TOTAL = 1258;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { deep: -1500, homeN: -1900, station: -2300, lab: -2700 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: the open sea out on the grass south of the river town (a water plane to the horizon), a boat at (0, 0);
// the deep is a room: a gradient sphere around R("deep", 0, 0, 0) with a sand floor
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -240;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 118, light: "day" },      // hook: a whale sings; no one sings back
  { id: 2, a: 118, b: 250, light: "day" },    // 1989: a Navy hydrophone, a submarine passes
  { id: 3, a: 250, b: 338, light: "day" },    // the listening station: a strange song
  { id: 4, a: 338, b: 480, light: "day" },    // 52 hertz; other whales far lower
  { id: 5, a: 480, b: 600, light: "day" },    // twelve years of tracking across the ocean
  { id: 6, a: 600, b: 685, light: "day" },    // season after season, it called
  { id: 7, a: 685, b: 800, light: "day" },    // never a second voice
  { id: 8, a: 800, b: 862, light: "day" },    // no one has ever seen it
  { id: 9, a: 862, b: 960, light: "day" },    // the loneliest whale in the world
  { id: 10, a: 960, b: TOTAL, light: "night" },// a lonely flat at night; Jenny answers -> end card
];
export const XFADE: Record<number, number> = { 3: 6, 5: 8, 8: 8, 10: 10 };
export const FLASH_AT = 118;
export const CARD_AT = 1162;

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
const Dp = (x: number, y: number, z: number) => R("deep", x, y, z);
const St = (x: number, y: number, z: number) => R("station", x, y, z);
const Lb = (x: number, y: number, z: number) => R("lab", x, y, z);
const S1a = (f: number) => dolly(Dp(0, 3.4, 12), Dp(0, 5, -8), pushK(f, 0, 0.0015, 0.004, 30), { fov: 46, roll: 0.02 });
const S2a = (f: number) => dolly(Dp(20.5, 1.7, 9.0), Dp(18, 1.6, 3.0), pushK(f, 114, 0.0012), { fov: 48, roll: -0.02 });
const S3a = (f: number) => dolly(St(0.2, 1.5, 3.2), St(0.1, 1.3, -1.6), pushK(f, 246, 0.0016, 0.005, 30), { fov: 46 });
const S4a = (f: number) => dolly(Dp(0, 4.2, 9), Dp(0, 4.7, -7), pushK(f, 334, 0.0012), { fov: 46, roll: 0.02 });
const S5a = (f: number) => dolly(Lb(0.2, 1.55, 3.6), Lb(0.1, 1.45, -1.6), pushK(f, 476, 0.0012), { fov: 46 });
const S6a = (f: number) => dolly(Dp(-1.5, 4.5, 10), Dp(0, 5, -8), pushK(f, 596, 0.0012), { fov: 46, roll: -0.02 });
const S7a = (f: number) => dolly(Lb(-0.45, 1.5, 3.6), Lb(-0.4, 1.45, -1.6), pushK(f, 681, 0.0012, 0.004, 30), { fov: 46 });
const S8a = (f: number) => dolly(E(2.6, 2.4, 5.6), E(0.7, 2.0, 0.2), pushK(f, 796, 0.0012), { fov: 46, roll: 0.02 });
const S9a = (f: number) => dolly(Dp(0, 3, 24), Dp(0, 6, -12), pushK(f, 858, 0.0012, 0.003, 30), { fov: 48 });
const S10a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 956, 0.0014), { fov: 44 });
const S10b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 1074, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 114, s: S2a }], 3: [{ f: 246, s: S3a }], 4: [{ f: 334, s: S4a }], 5: [{ f: 476, s: S5a }], 6: [{ f: 596, s: S6a }],
  7: [{ f: 681, s: S7a }], 8: [{ f: 796, s: S8a }], 9: [{ f: 858, s: S9a }], 10: [{ f: 951, s: S10a }, { f: 1076, cut: true, s: S10b }],
};

// impact kicks: 52 HZ, far lower, LONELIEST
const KICKS: [number, number][] = [[389 / FPS, 0.6], [456 / FPS, 0.3], [910 / FPS, 0.4]];
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
  { f: 0, cInf: 0 }, { f: 118, cInf: 8 }, { f: 250, cInf: 10 }, { f: 338, cInf: 0 }, { f: 480, cInf: 9 }, { f: 600, cInf: 0 }, { f: 685, cInf: 9 },
  { f: 800, cInf: 6 }, { f: 862, cInf: 0 }, { f: 960, cInf: 9 }, { f: 1076, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
