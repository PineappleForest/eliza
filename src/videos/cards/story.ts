// Timeline of "100 Cards" (Joe Cuba's 100th birthday -> Feeloy): shots cut to the ElevenLabs read
// (production-cards/voice/words.json, hand-fixed), same camera grammar as the Monowi short.
export const FPS = 30;
export const TOTAL = 1700;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { lounge: -1500, mail: -1700, homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: the care home, out on the open grass south of the river town. Its front is at z = MZ, the porch to MZ + 1.7,
// a sidewalk at z MZ + 3.3, the road at z MZ + 4..+8, the mailbox by the path at (MX + 2.4, MZ + 3.7)
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -170;
/** Joe's armchair in the lounge (local x, z) */
export const JOE_X = -0.5, JOE_Z = -1.85;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 127, light: "day" },        // hook: Joe in his armchair with his sign: 100 ... birthday cards
  { id: 2, a: 127, b: 186, light: "day" },      // the mailman staggers along under a sack: "not ready"
  { id: 3, a: 186, b: 261, light: "day" },      // the care home; Joe waves from the porch; TEXAS
  { id: 4, a: 261, b: 407, light: "day" },      // a caregiver asks; nothing really ... just happiness
  { id: 5, a: 407, b: 591, light: "day" },      // her phone photo; then the sign close up
  { id: 6, a: 591, b: 729, light: "day" },      // within days: the table fills, 2,500
  { id: 7, a: 729, b: 835, light: "day" },      // 16,000; the map: Japan, Germany, Australia, Guam
  { id: 8, a: 835, b: 973, light: "day" },      // the mailman runs one glowing envelope: $300, EXPRESS, HONG KONG
  { id: 9, a: 973, b: 1061, light: "day" },     // the empty room fills with mail
  { id: 10, a: 1061, b: 1153, light: "day" },   // birthday: cake, 50,000, confetti
  { id: 11, a: 1153, b: 1229, light: "day" },   // did he get his hundred? "I bet I have."
  { id: 12, a: 1229, b: 1321, light: "golden" },// evening: Joe reads one card; just to be thought of
  { id: 13, a: 1321, b: TOTAL, light: "night" },// a lonely flat at night; Jenny -> end card
];
export const XFADE: Record<number, number> = { 4: 8, 9: 8, 12: 8, 13: 10 };
export const FLASH_AT = 127;
export const CARD_AT = 1604;

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
const L = (x: number, y: number, z: number) => R("lounge", x, y, z);
// 1: Joe and his sign, mid shot
const S1a = (f: number) => dolly(L(JOE_X + 0.15, 1.2, 1.15), L(JOE_X, 0.95, JOE_Z), pushK(f, 0, 0.002, 0.006, 40), { fov: 40, roll: 0.03 });
// 2: the mailman on the sidewalk (side on), 3: the care home with Joe on the porch
const S2a = (f: number) => dolly(E(-2.6, 1.45, 9.6), E(-2.6, 1.1, 3.3), pushK(f, 123, 0.0025, 0.006, 30), { fov: 44, roll: -0.03 });
const S3a = (f: number) => dolly(E(0.6, 2.2, 13.5), E(0, 1.9, 0.5), pushK(f, 182, 0.0025), { fov: 46 });
// 4-6, 10-12: the lounge
const S4a = (f: number) => dolly(L(0.0, 1.5, 2.7), L(-0.12, 1.05, -1.5), pushK(f, 257, 0.0015), { fov: 46 });
const S5a = (f: number) => dolly(L(0.2, 1.5, 2.6), L(-0.1, 1.05, -1.5), pushK(f, 403, 0.0018), { fov: 46, roll: 0.02 });
const S5b = (f: number) => dolly(L(JOE_X + 0.05, 0.98, 0.25), L(JOE_X, 0.86, -1.42), pushK(f, 472, 0.0012, 0.004, 40), { fov: 40 }); // aimed at the sign
const S6a = (f: number) => dolly(L(0.25, 1.55, 2.6), L(0.12, 1.05, -1.4), pushK(f, 587, 0.0015), { fov: 48, roll: -0.02 });
const S7a = (f: number) => dolly(L(1.25, 2.05, 0.75), L(1.25, 2.05, -2.9), pushK(f, 725, 0.002), { fov: 44 });
const S10a = (f: number) => dolly(L(0.4, 1.55, 2.8), L(0.3, 1.15, -1.4), pushK(f, 1057, 0.0018, 0.005, 30), { fov: 50, roll: 0.02 });
const S11a = (f: number) => dolly(L(JOE_X + 0.1, 1.32, -0.1), L(JOE_X, 1.25, JOE_Z), pushK(f, 1153, 0.0018, 0.005, 25), { fov: 38 });
const S12a = (f: number) => dolly(L(JOE_X + 0.45, 1.35, 0.65), L(JOE_X, 1.08, JOE_Z), pushK(f, 1225, 0.0016), { fov: 44, roll: -0.02 });
// 8: the mailman runs right to left along the sidewalk; the lens tracks him
export const RUN_X = (f: number) => 5.2 - (f - 835) * 0.05;
const S8a = (f: number) => { const x = RUN_X(Math.max(835, Math.min(973, f))) - 0.4; return { pos: E(x, 1.45, 8.6), look: E(x, 1.15, 3.3), fov: 46, roll: 0.02 } as Shot; };
// 9: the empty room
const S9a = (f: number) => dolly(R("mail", 0, 1.6, 2.6), R("mail", 0, 0.9, -1.5), pushK(f, 969, 0.0018), { fov: 50 });
// 13: the lonely flat at night, then the phone
const S13a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 1317, 0.0018), { fov: 44 });
const S13b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 1420, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }],
  2: [{ f: 123, s: S2a }],
  3: [{ f: 182, s: S3a }],
  4: [{ f: 257, s: S4a }],
  5: [{ f: 403, s: S5a }, { f: 472, cut: true, s: S5b }],
  6: [{ f: 587, s: S6a }],
  7: [{ f: 725, s: S7a }],
  8: [{ f: 831, s: S8a }],
  9: [{ f: 969, s: S9a }],
  10: [{ f: 1057, s: S10a }],
  11: [{ f: 1153, s: S11a }],
  12: [{ f: 1225, s: S12a }],
  13: [{ f: 1317, s: S13a }, { f: 1420, cut: true, s: S13b }],
};

// impact kicks: the sack lands, each counter, the room fills, fifty thousand
const KICKS: [number, number][] = [[148 / FPS, 0.6], [616 / FPS, 0.4], [729 / FPS, 0.5], [1040 / FPS, 0.5], [1094 / FPS, 0.7], [1124 / FPS, 0.5]];
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
  { f: 0, cInf: 11 }, { f: 127, cInf: 7 }, { f: 186, cInf: 5 }, { f: 261, cInf: 9 }, { f: 472, cInf: 14 }, { f: 591, cInf: 9 },
  { f: 729, cInf: 7 }, { f: 835, cInf: 8 }, { f: 973, cInf: 6 }, { f: 1061, cInf: 9 }, { f: 1153, cInf: 13 }, { f: 1229, cInf: 11 },
  { f: 1321, cInf: 9 }, { f: 1420, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
