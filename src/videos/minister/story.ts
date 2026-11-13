// Timeline of "The Minister for Loneliness" (UK 2018, Japan 2021 -> Feeloy): shots cut to the ElevenLabs read
// (production-minister/voice/words.json + units.json), same camera grammar as the ELIZA and Rent a Dad shorts.
export const FPS = 30;
export const TOTAL = 1736;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { office: -1500, corr: -1600, gp: -1700, jp: -1800, homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: a front door on the near quay (house fronts at z = -36.5)
export const QUAY_Z = -33.8;
export const DOOR_X = 30, DOOR_Z = -36.5;
// the ministry office: the minister's desk and the wall board (right of the desk) that changes per beat
export const BOARD: [number, number] = [1.3, 1.75]; // x, y on the back wall (z -2.97)
export const BOARD_W = 1.9, BOARD_H = 1.19;
// the corridor doors (x)
export const DOORS = [-2.6, 0, 2.4];

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 153, light: "day" },        // hook: the minister sits down; the nameplate reads LONELINESS
  { id: 2, a: 153, b: 262, light: "day" },      // the corridor: TRADE, DEFENCE ... and the small LONELINESS door
  { id: 3, a: 262, b: 452, light: "day" },      // the report lands; nine million ticks up on the board
  { id: 4, a: 452, b: 600, light: "day" },      // health: fifteen cigarettes pop onto the board
  { id: 5, a: 600, b: 660, light: "day" },      // the plan
  { id: 6, a: 660, b: 810, light: "day" },      // the GP prescribes a cooking class, a walking club, an art group
  { id: 7, a: 810, b: 960, light: "day" },      // the postal worker knocks; an old man opens the door
  { id: 8, a: 960, b: 1090, light: "golden" },  // Japan's minister
  { id: 9, a: 1090, b: 1210, light: "day" },    // the first meeting, online (video call on the wall screen)
  { id: 10, a: 1210, b: 1342, light: "day" },   // two countries on the map; one very big problem
  { id: 11, a: 1342, b: TOTAL, light: "night" },// 2 a.m., a man alone; Jenny on his phone -> end card
];
export const XFADE: Record<number, number> = { 7: 8, 8: 10, 9: 8, 11: 12 };
export const FLASH_AT = 153;
export const CARD_AT = 1642;

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

// 1 the office: wide, push in to the nameplate on "for loneliness"
const S1a = (f: number) => dolly(R("office", -0.2, 1.65, 4.2), R("office", -0.3, 1.1, -2.0), pushK(f, 0, 0.0022, 0.006, 40), { fov: 46, roll: 0.03 });
const S1b = (f: number) => dolly(R("office", -0.25, 1.15, 1.2), R("office", -0.3, 0.95, -1.1), pushK(f, 112, 0.003), { fov: 40, roll: -0.03 });
// 2 the corridor: door by door
const corr = (x: number, near = 1) => (f: number) => dolly(R("corr", x, 1.6, 3.2 * near), R("corr", x, 1.45, -3.0), pushK(f, 153, 0.0015), { fov: 46 });
const S2c = (f: number) => dolly(R("corr", 2.4, 1.25, 1.6), R("corr", 2.4, 1.05, -3.0), pushK(f, 230, 0.004, 0.008, 30), { fov: 44, roll: 0.04 });
// 3 the report + the board (minister left, board right)
const S3a = (f: number) => dolly(R("office", 0.75, 1.6, 4.0), R("office", 0.7, 1.4, -2.5), pushK(f, 262, 0.0012), { fov: 50 });
// 4 the board close: the heart, fifteen cigarettes
const S4a = (f: number) => dolly(R("office", 1.3, 1.75, 1.3), R("office", 1.3, 1.75, -2.97), pushK(f, 452, 0.0015, 0.004, 40), { fov: 48 });
// 5 the plan: the minister at the board
const S5a = (f: number) => dolly(R("office", 0.8, 1.6, 3.0), R("office", 0.75, 1.4, -2.6), pushK(f, 600, 0.0025), { fov: 50, roll: 0.03 });
// 6 the GP's office
const S6a = (f: number) => dolly(R("gp", 0.1, 1.5, 3.7), R("gp", 0.05, 1.1, -1.5), pushK(f, 660, 0.0015), { fov: 50 });
// 7 the quay: the postal worker and the door
const S7a = (f: number) => dolly([DOOR_X - 1.4, D0 + 1.6, QUAY_Z + 5.2], [DOOR_X - 0.6, D0 + 1.3, DOOR_Z + 0.4], pushK(f, 806, 0.0018), { fov: 46, roll: 0.03 });
// 8 Japan's ministry at golden hour
const S8a = (f: number) => dolly(R("jp", 0.2, 1.5, 3.0), R("jp", 0.0, 1.1, -2.0), pushK(f, 955, 0.0022), { fov: 46, roll: -0.03 });
// 9 the online meeting: the minister + the wall screen
const S9a = (f: number) => dolly(R("office", 0.75, 1.6, 4.0), R("office", 0.7, 1.45, -2.5), pushK(f, 1090, 0.0015, 0.004, 30), { fov: 50 });
// 10 the map on the board
const S10a = (f: number) => dolly(R("office", 1.3, 1.75, 1.3), R("office", 1.3, 1.75, -2.97), pushK(f, 1210, 0.0015), { fov: 48, roll: -0.03 });
// 11 2 a.m.: a man in his armchair, then the phone
const S11a = (f: number) => dolly(R("homeN", 0.6, 1.35, 1.9), R("homeN", -0.4, 0.95, -1.7), pushK(f, 1336, 0.002), { fov: 42 });
const S11b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 1445, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 112, cut: true, s: S1b }],
  2: [{ f: 153, s: corr(DOORS[0]) }, { f: 196, dur: 18, s: corr(DOORS[1]) }, { f: 228, dur: 16, s: S2c }],
  3: [{ f: 262, s: S3a }],
  4: [{ f: 452, s: S4a }],
  5: [{ f: 600, s: S5a }],
  6: [{ f: 660, s: S6a }],
  7: [{ f: 806, s: S7a }],
  8: [{ f: 955, s: S8a }],
  9: [{ f: 1090, s: S9a }],
  10: [{ f: 1210, s: S10a }],
  11: [{ f: 1336, s: S11a }, { f: 1445, cut: true, s: S11b }],
};

// impact kicks: the report lands, "big problem"
const KICKS: [number, number][] = [[282 / FPS, 0.8], [1290 / FPS, 0.6]];
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
  { f: 0, cInf: 8 }, { f: 112, cInf: 13 }, { f: 153, cInf: 7 }, { f: 228, cInf: 11 },
  { f: 262, cInf: 8 }, { f: 452, cInf: 5 }, { f: 600, cInf: 10 }, { f: 660, cInf: 9 }, { f: 810, cInf: 7 },
  { f: 960, cInf: 9 }, { f: 1090, cInf: 8 }, { f: 1210, cInf: 5 }, { f: 1342, cInf: 9 }, { f: 1445, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
