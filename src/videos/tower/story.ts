// Timeline of "A Town Under One Roof" (Whittier, Alaska -> Feeloy): shots cut to the ElevenLabs read
// (production-tower/voice/words.json, hand-fixed), same camera grammar as the Pigs short.
export const FPS = 30;
export const TOTAL = 1942;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { apt: -1500, homeN: -1900, hall: -2300, tunnel: -2700 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: Whittier out on the open grass south of the river town; the tower front at z = MZ - 4 (x -10..10),
// the harbour toward +z, the school across the street at x 22..36, the tunnel portal at x -45, z -26
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -240;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 138, light: "day" },      // hook: the harbour town, one tower; 1 BUILDING
  { id: 2, a: 138, b: 303, light: "day" },    // Whittier: 270 people, 14 floors
  { id: 3, a: 303, b: 458, light: "day" },    // built for the army in the 1950s; soldiers leave, a family moves in
  { id: 4, a: 458, b: 608, light: "day" },    // inside: police, post, store, clinic, church
  { id: 5, a: 608, b: 760, light: "day" },    // the school across the street; kids walk the tunnel
  { id: 6, a: 760, b: 890, light: "day" },    // six metres of snow
  { id: 7, a: 890, b: 1072, light: "day" },   // the only road: a one-lane tunnel, trains, CLOSED at night
  { id: 8, a: 1072, b: 1168, light: "day" },  // barely step outside all winter
  { id: 9, a: 1168, b: 1284, light: "day" },  // the hallway: everybody knows you
  { id: 10, a: 1284, b: 1394, light: "day" }, // a teacher: a community under ONE ROOF
  { id: 11, a: 1394, b: 1512, light: "night" },// the tower at night: a few floors from a friend
  { id: 12, a: 1512, b: TOTAL, light: "night" },// a lonely flat at night; Jenny -> end card
];
export const XFADE: Record<number, number> = { 8: 8, 11: 10, 12: 10 };
export const FLASH_AT = 138;
export const CARD_AT = 1846;

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
const Ap = (x: number, y: number, z: number) => R("apt", x, y, z);
const Hl = (x: number, y: number, z: number) => R("hall", x, y, z);
const Tn = (x: number, y: number, z: number) => R("tunnel", x, y, z);
// 1: aerial over the harbour; 2: up at the tower
const S1a = (f: number) => dolly(E(14, 24, 104), E(0, 19, -10), pushK(f, 0, 0.0018, 0.006, 30), { fov: 46, roll: 0.02 });
const S2a = (f: number) => dolly(E(9, 3.5, 50), E(0, 18.5, -4), pushK(f, 134, 0.0012), { fov: 48, roll: -0.02 });
// 3: the street at the tower door; 4: the cutaway
const S3a = (f: number) => dolly(E(0.8, 1.7, 13.5), E(0, 2.3, 1.5), pushK(f, 299, 0.0015), { fov: 44 });
const S4a = (f: number) => dolly(E(0, 7.5, 24), E(0, 8.2, -3.4), pushK(f, 454, 0.001), { fov: 46, roll: 0.02 });
// 5: the tower and the school across the street, then the kids' tunnel
const S5a = (f: number) => dolly(E(19, 12, 27), E(16.5, 4, -6), pushK(f, 604, 0.0015), { fov: 56 });
const S5b = (f: number) => dolly(Tn(0, 1.35, 9), Tn(0, 1.1, -8), pushK(f, 668, 0.0012), { fov: 46, roll: 0.02 });
// 6: the snow gauge in front of the tower
const S6a = (f: number) => dolly(E(0, 3.6, 26.5), E(0, 3.5, 8.5), pushK(f, 756, 0.0009, 0.003, 30), { fov: 46 });
// 7: the road tunnel
const S7a = (f: number) => dolly(E(-42.6, 2.3, -4), E(-45, 3.6, -26), pushK(f, 886, 0.0012), { fov: 46, roll: -0.02 });
// 8: a flat in winter; 9, 10: the hallway
const S8a = (f: number) => dolly(Ap(0.1, 1.5, 2.3), Ap(-0.45, 1.25, -1.8), pushK(f, 1068, 0.0016), { fov: 44 });
const S9a = (f: number) => dolly(Hl(0, 1.6, 7.2), Hl(0, 1.2, -1.3), pushK(f, 1164, 0.001), { fov: 50, roll: 0.02 });
const S10a = (f: number) => dolly(Hl(-1.5, 1.4, 3.4), Hl(-1.5, 1.2, -1.0), pushK(f, 1280, 0.0012, 0.004, 30), { fov: 50 });
// 11: the tower at night
const S11a = (f: number) => dolly(E(-7, 5, 54), E(0, 18.5, -4), pushK(f, 1390, 0.0015), { fov: 48, roll: 0.02 });
// 12: the lonely flat at night, then the phone
const S12a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 1508, 0.0014), { fov: 44 });
const S12b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 1736, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 134, s: S2a }], 3: [{ f: 299, s: S3a }], 4: [{ f: 454, s: S4a }],
  5: [{ f: 604, s: S5a }, { f: 670, cut: true, s: S5b }], 6: [{ f: 756, s: S6a }], 7: [{ f: 886, s: S7a }], 8: [{ f: 1064, s: S8a }],
  9: [{ f: 1164, s: S9a }], 10: [{ f: 1280, s: S10a }], 11: [{ f: 1385, s: S11a }], 12: [{ f: 1503, s: S12a }, { f: 1738, cut: true, s: S12b }],
};

// impact kicks: 1 BUILDING, 14 FLOORS, 6 METRES, CLOSED, ONE ROOF
const KICKS: [number, number][] = [[113 / FPS, 0.7], [272 / FPS, 0.4], [839 / FPS, 0.5], [1057 / FPS, 0.5], [1372 / FPS, 0.4]];
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
  { f: 0, cInf: 0 }, { f: 303, cInf: 8 }, { f: 458, cInf: 3 }, { f: 608, cInf: 0 }, { f: 670, cInf: 10 }, { f: 760, cInf: 5 }, { f: 890, cInf: 4 },
  { f: 1072, cInf: 12 }, { f: 1168, cInf: 9 }, { f: 1284, cInf: 12 }, { f: 1394, cInf: 0 }, { f: 1512, cInf: 9 }, { f: 1738, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
