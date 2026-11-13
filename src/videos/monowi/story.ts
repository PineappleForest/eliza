// Timeline of "Population: One" (Monowi, Nebraska -> Feeloy): shots cut to the ElevenLabs read
// (production-monowi/voice/words.json + units.json), same camera grammar as the ELIZA and Rent a Dad shorts.
export const FPS = 30;
export const TOTAL = 1971;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { tavern: -1500, homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: Monowi, out on the open grass south of the river town. The tavern front is at z = MZ, its porch to MZ + 1.6,
// the road runs along x at z MZ + 4..+8, the town sign stands past the road at (MX - 16, MZ + 9.5)
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -170;
export const SIGN_AT: V3 = [MX - 16, D0, MZ + 9.5];
export const LIB_X = MX + 10;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 107, light: "golden" },     // hook: the town sign, POP. 1
  { id: 2, a: 107, b: 161, light: "golden" },   // Elsie waves from the tavern porch
  { id: 3, a: 161, b: 388, light: "golden" },   // the sign counts down: 130 ... 16; closed shop, school, suitcase
  { id: 4, a: 388, b: 543, light: "golden" },   // Elsie and Rudy on the porch
  { id: 5, a: 543, b: 616, light: "golden" },   // Elsie alone, Rudy's chair empty
  { id: 6, a: 616, b: 827, light: "day" },      // the bar: mayor, clerk, treasurer, librarian, bartender
  { id: 7, a: 827, b: 956, light: "day" },      // the liquor licence: stamp, signature
  { id: 8, a: 956, b: 1037, light: "day" },     // the ballot box: one vote, WINNER
  { id: 9, a: 1037, b: 1160, light: "day" },    // Rudy's photo on the tavern wall
  { id: 10, a: 1160, b: 1306, light: "golden" },// Rudy's Library: she unlocks it, OPEN
  { id: 11, a: 1306, b: 1358, light: "golden" },// the tavern sign lights up
  { id: 12, a: 1358, b: 1496, light: "day" },   // strangers at her bar: 80 miles
  { id: 13, a: 1496, b: 1570, light: "golden" },// the sign: POP. 1 ... and a heart
  { id: 14, a: 1570, b: TOTAL, light: "night" },// a lonely flat at night; Jenny -> end card
];
export const XFADE: Record<number, number> = { 6: 8, 10: 8, 12: 8, 13: 8, 14: 10 };
export const FLASH_AT = 107;
export const CARD_AT = 1878;

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
// 1 + 13: the town sign by the road, the tavern far behind
const S1a = (f: number) => dolly(E(-15.2, 1.5, 17.0), E(-16, 2.0, 9.5), pushK(f, 0, 0.003, 0.006, 40), { fov: 42, roll: 0.03 });
const S13a = (f: number) => dolly(E(-14.8, 1.6, 17.5), E(-16, 2.0, 9.5), pushK(f, 1492, 0.0025), { fov: 44, roll: -0.03 });
// 2, 4, 5: the porch
const S2a = (f: number) => dolly(E(-0.6, 1.7, 7.0), E(-0.6, 1.35, 0.7), pushK(f, 103, 0.0025), { fov: 44 });
const S4a = (f: number) => dolly(E(0, 1.6, 6.6), E(0, 1.25, 0.7), pushK(f, 384, 0.0015), { fov: 44, roll: 0.02 });
const S5a = (f: number) => dolly(E(-0.35, 1.5, 5.8), E(-0.3, 1.15, 0.7), pushK(f, 539, 0.0015), { fov: 46 });
// 3: the sign, closer, as it counts down
const S3a = (f: number) => dolly(E(-15.6, 2.0, 14.6), E(-16, 2.0, 9.5), pushK(f, 157, 0.001), { fov: 46 });
// 6-9, 12: the tavern
const S6a = (f: number) => dolly(R("tavern", 0, 1.9, 2.6), R("tavern", 0, 1.8, -1.9), pushK(f, 612, 0.0012), { fov: 50 });
const S7a = (f: number) => dolly(R("tavern", 0.1, 1.45, 0.9), R("tavern", 0.09, 1.44, 0.4), pushK(f, 827, 0.0006), { fov: 40 }); // aimed at the insert so the focus lands on it
const S8a = (f: number) => dolly(R("tavern", 0.2, 1.5, 1.8), R("tavern", 0.1, 1.3, -1.6), pushK(f, 956, 0.002), { fov: 46, roll: 0.03 });
const S9a = (f: number) => dolly(R("tavern", -0.6, 1.8, 1.2), R("tavern", -1.0, 1.75, -2.9), pushK(f, 1037, 0.0022), { fov: 42 });
const S12a = (f: number) => dolly(R("tavern", 0, 1.8, 3.4), R("tavern", 0, 1.25, -1.5), pushK(f, 1354, 0.0015), { fov: 50 });
// 10: the library shed; 11: the tavern's sign
const S10a = (f: number) => dolly(E(10.3, 1.6, 6.8), E(10, 1.3, 0.3), pushK(f, 1156, 0.002), { fov: 44, roll: 0.03 });
const S11a = (f: number) => dolly(E(1.2, 2.2, 8.0), E(0, 3.3, 0.6), pushK(f, 1302, 0.003), { fov: 44, roll: -0.03 });
// 14: the lonely flat at night, then the phone
const S14a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 1566, 0.0018), { fov: 44 });
const S14b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 1665, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }],
  2: [{ f: 103, s: S2a }],
  3: [{ f: 157, s: S3a }],
  4: [{ f: 384, s: S4a }],
  5: [{ f: 539, s: S5a }],
  6: [{ f: 612, s: S6a }],
  7: [{ f: 827, s: S7a }],
  8: [{ f: 956, s: S8a }],
  9: [{ f: 1037, s: S9a }],
  10: [{ f: 1156, s: S10a }],
  11: [{ f: 1302, s: S11a }],
  12: [{ f: 1354, s: S12a }],
  13: [{ f: 1492, s: S13a }],
  14: [{ f: 1566, s: S14a }, { f: 1665, cut: true, s: S14b }],
};

// impact kicks: each title badge, the stamp, the ballot
const KICKS: [number, number][] = [[648 / FPS, 0.4], [689 / FPS, 0.4], [717 / FPS, 0.4], [748 / FPS, 0.4], [790 / FPS, 0.5], [888 / FPS, 0.8], [1002 / FPS, 0.6]];
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
  { f: 0, cInf: 8 }, { f: 107, cInf: 9 }, { f: 161, cInf: 9 }, { f: 388, cInf: 8 }, { f: 543, cInf: 11 },
  { f: 616, cInf: 8 }, { f: 827, cInf: 14 }, { f: 956, cInf: 9 }, { f: 1037, cInf: 11 }, { f: 1160, cInf: 8 },
  { f: 1306, cInf: 6 }, { f: 1358, cInf: 6 }, { f: 1496, cInf: 8 }, { f: 1570, cInf: 9 }, { f: 1665, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
