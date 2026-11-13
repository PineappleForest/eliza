// Timeline of "No One to Save" (Rome police cook spaghetti -> Feeloy): shots cut to the ElevenLabs read
// (production-pasta/voice/words.json, hand-fixed), same camera grammar as the Cards short.
export const FPS = 30;
export const TOTAL = 1830;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { flat: -1500, landing: -1700, homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: a Rome street out on the open grass south of the river town. Three apartment fronts at z = MZ
// (x -9..9), cobbles from z MZ to MZ + 12, the couple's window on the middle house's first floor at (MX - 1.5, 5.2)
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -170;
/** the four officers' run along the street: the leader's local x at frame f */
export const RUN_X = (f: number) => -4.6 + (f - 141) * 0.06;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 141, light: "golden" },     // hook: a Rome street at dusk; sobs from a window; the neighbour calls
  { id: 2, a: 141, b: 244, light: "golden" },   // four officers run up the street
  { id: 3, a: 244, b: 356, light: "day" },      // in the doorway: no burglar, no scam, no crime
  { id: 4, a: 356, b: 539, light: "day" },      // Michele and Jole on the sofa: 94, 70 years
  { id: 5, a: 539, b: 687, light: "day" },      // the news on the TV; they cry
  { id: 6, a: 687, b: 732, light: "day" },      // the calendar: AUGUST
  { id: 7, a: 732, b: 768, light: "day" },      // the landing: every neighbour AWAY
  { id: 8, a: 768, b: 848, light: "day" },      // the two of them alone
  { id: 9, a: 848, b: 914, light: "day" },      // the table: a few grapes
  { id: 10, a: 914, b: 1040, light: "day" },    // one officer cooks: spaghetti, butter, parmesan
  { id: 11, a: 1040, b: 1138, light: "day" },   // the others pull up chairs and talk
  { id: 12, a: 1138, b: 1313, light: "day" },   // the police note
  { id: 13, a: 1313, b: 1430, light: "golden" },// the street: WE'RE ALWAYS THERE
  { id: 14, a: 1430, b: TOTAL, light: "night" },// a lonely flat at night; Jenny -> end card
];
export const XFADE: Record<number, number> = { 3: 8, 13: 8, 14: 10 };
export const FLASH_AT = 141;
export const CARD_AT = 1731;

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
const Fl = (x: number, y: number, z: number) => R("flat", x, y, z);
// 1: the street at dusk, looking up at the couple's window; 13: the street door, the banner
const S1a = (f: number) => dolly(E(0.2, 1.7, 14.5), E(-0.9, 3.6, 0), pushK(f, 0, 0.002, 0.005, 40), { fov: 46, roll: 0.03 });
const S13a = (f: number) => dolly(E(0.2, 1.7, 10.0), E(0, 1.95, 1.2), pushK(f, 1309, 0.0022), { fov: 44, roll: -0.02 });
// 2: the lens tracks the running officers (side on)
const S2a = (f: number) => { const x = RUN_X(Math.max(141, Math.min(244, f))) - 1.65; return { pos: E(x, 1.5, 10.5), look: E(x, 1.3, 3.5), fov: 56, roll: -0.02 } as Shot; };
// 3-12: the flat
const S3a = (f: number) => dolly(Fl(0.6, 1.55, 1.2), Fl(-3.5, 1.15, -1.35), pushK(f, 240, 0.0018), { fov: 46 });
const S4a = (f: number) => dolly(Fl(1.6, 1.4, 2.4), Fl(1.6, 1.15, -2.15), pushK(f, 352, 0.0008, 0.003, 30), { fov: 44, roll: 0.02 });
const S5a = (f: number) => dolly(Fl(1.5, 1.3, 1.3), Fl(1.6, 1.0, -2.15), pushK(f, 535, 0.0018, 0.005, 30), { fov: 44 });
const S5tv = (f: number) => dolly(Fl(-0.82, 1.0, -1.3), Fl(-0.9, 0.86, -2.6), pushK(f, 535, 0.002, 0.005, 30), { fov: 40 });
const S6a = (f: number) => dolly(Fl(0.25, 1.62, -1.55), Fl(0.1, 1.72, -2.97), pushK(f, 683, 0.002), { fov: 40 });
const S7a = (f: number) => dolly(R("landing", 0, 1.5, 3.4), R("landing", 0, 1.3, -1.9), pushK(f, 728, 0.0025), { fov: 56 });
const S8a = (f: number) => dolly(Fl(1.6, 1.6, 3.2), Fl(1.6, 0.95, -2.15), pushK(f, 764, 0.0012), { fov: 50, roll: -0.02 });
const S9a = (f: number) => dolly(Fl(1.63, 1.3, -0.3), Fl(1.6, 0.5, -1.05), pushK(f, 844, 0.0015), { fov: 40 });
const S10a = (f: number) => dolly(Fl(-2.1, 1.5, 1.2), Fl(-3.05, 1.05, -2.3), pushK(f, 910, 0.0016), { fov: 46, roll: 0.02 });
const S11a = (f: number) => dolly(Fl(1.6, 1.65, 4.8), Fl(1.6, 1.0, -2.0), pushK(f, 1036, 0.0015), { fov: 54 });
const S12a = (f: number) => dolly(Fl(1.6, 1.3, 1.4), Fl(1.6, 1.28, 0.9), pushK(f, 1138, 0.0006), { fov: 40 }); // aimed at the note insert
// 14: the lonely flat at night, then the phone
const S14a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 1426, 0.0018), { fov: 44 });
const S14b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 1550, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 137, s: S2a }], 3: [{ f: 240, s: S3a }], 4: [{ f: 352, s: S4a }], 5: [{ f: 535, s: S5tv }, { f: 596, cut: true, s: S5a }],
  6: [{ f: 683, s: S6a }], 7: [{ f: 728, s: S7a }], 8: [{ f: 764, s: S8a }], 9: [{ f: 844, s: S9a }], 10: [{ f: 910, s: S10a }],
  11: [{ f: 1036, s: S11a }], 12: [{ f: 1134, s: S12a }], 13: [{ f: 1309, s: S13a }],
  14: [{ f: 1426, s: S14a }, { f: 1550, cut: true, s: S14b }],
};

// impact kicks: each crossed-out badge, 70 years, parmesan, the banner
const KICKS: [number, number][] = [[262 / FPS, 0.35], [296 / FPS, 0.35], [332 / FPS, 0.4], [497 / FPS, 0.4], [1006 / FPS, 0.3], [1384 / FPS, 0.45]];
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
  { f: 0, cInf: 6 }, { f: 141, cInf: 6 }, { f: 244, cInf: 9 }, { f: 356, cInf: 10 }, { f: 539, cInf: 13 }, { f: 596, cInf: 12 }, { f: 687, cInf: 13 },
  { f: 732, cInf: 7 }, { f: 768, cInf: 8 }, { f: 848, cInf: 15 }, { f: 914, cInf: 10 }, { f: 1040, cInf: 8 }, { f: 1138, cInf: 15 },
  { f: 1313, cInf: 6 }, { f: 1430, cInf: 9 }, { f: 1550, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
