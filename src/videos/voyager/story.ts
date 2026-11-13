// Timeline of "Still Saying Hello" (Voyager 1 at one light-day -> Feeloy): shots cut to the ElevenLabs read
// (production-voyager/voice/words.json, hand-fixed), same camera grammar as the Pasta short.
export const FPS = 30;
export const TOTAL = 1800;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { control: -1500, homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
/** deep space: a star sphere (radius 180) high above and far beyond the valley; the probe sits at its centre with its
 *  dish opening toward -z, Earth far below-behind it, Saturn and Jupiter off to the sides */
export const SPACE: V3 = [0, 420, -2700];
export const S = (x: number, y: number, z: number): V3 => [SPACE[0] + x, SPACE[1] + y, SPACE[2] + z];
export const EARTH: V3 = [-2, -30, -20], EARTH_R = 1.4;
export const SATURN: V3 = [-30, 6, -110], JUPITER: V3 = [36, -8, -80];
/** the probe's golden record: on the bus side facing +x */
export const RECORD: V3 = [0.87, 0, 0.27];
// exterior: the launch pad, out on the open grass south of the river town
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -170;
/** the rocket's centre height above the pad at frame f (it lifts off at 350) */
export const ROCKET_Y = (f: number) => 3.6 + Math.max(0, f - 350) ** 2 * 0.0016;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 87, light: "day" },        // hook: the date, NOV 18 / 2026, in deep space
  { id: 2, a: 87, b: 255, light: "day" },      // the probe; 1977; then the wide: Earth, the dotted path, 1 LIGHT-DAY
  { id: 3, a: 255, b: 346, light: "day" },     // past Saturn: FARTHEST EVER
  { id: 4, a: 346, b: 463, light: "golden" },  // 1977: the launch; 5 YEARS crossed out
  { id: 5, a: 463, b: 608, light: "day" },     // a pulse of light takes a whole day: 24 HOURS
  { id: 6, a: 608, b: 864, light: "day" },     // the golden record: greetings, music, a whale, home
  { id: 7, a: 864, b: 937, light: "day" },     // a hello drifts off into the dark
  { id: 8, a: 937, b: 1006, light: "day" },    // the probe alone, far away
  { id: 9, a: 1006, b: 1140, light: "day" },   // the control room: 2023, gibberish, 5 MONTHS
  { id: 10, a: 1140, b: 1260, light: "day" },  // SEND, then 2 DAYS of waiting
  { id: 11, a: 1260, b: 1318, light: "day" },  // "Hi, it's me." cheers
  { id: 12, a: 1318, b: 1488, light: "day" },  // Earth: a hello flies out, 26 BILLION KM
  { id: 13, a: 1488, b: TOTAL, light: "night" },// a lonely flat at night; Jenny -> end card
];
/** shots in deep space: no fog, the star sphere is the sky */
export const SPACE_SHOTS = new Set([1, 2, 3, 5, 6, 7, 8, 12]);
export const XFADE: Record<number, number> = { 4: 8, 5: 8, 9: 8, 12: 8, 13: 10 };
export const FLASH_AT = 87;
export const CARD_AT = 1707;

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
const C = (x: number, y: number, z: number) => R("control", x, y, z);
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
// 1: the date card in front of the probe
const S1a = (f: number) => dolly(S(0.4, 0.4, 7.6), S(0, 0.12, 4.6), pushK(f, 0, 0.0025, 0.007, 30), { fov: 40, roll: 0.02 });
// 2: around the probe, then the wide with Earth
const S2a = (f: number) => dolly(S(10.5, 2.4, 3.0), S(0, 0.5, 0), pushK(f, 87, 0.0015), { fov: 44, roll: 0.03 });
const S2b = (f: number) => dolly(S(7.0, 3.2, -8.5), S(0, 0.5, 0), pushK(f, 120, 0.0015), { fov: 44, roll: -0.02 });
const WIDE = (f: number, f0: number, k = 0.0012) => dolly(S(48, -13, -6), S(-1, -14, -10), pushK(f, f0, k), { fov: 52, roll: 0.02 });
const S2c = (f: number) => WIDE(f, 196);
// 3: past Saturn
const S3a = (f: number) => { const k = clamp01((f - 255) / 91); return { pos: lerp3(S(-4, 16, -78), S(-54, 2, -80), k), look: S(...SATURN), fov: 50, roll: 0.05 - 0.1 * k } as Shot; };
// 4: the launch pad
const S4a = (f: number) => dolly(E(0.5, 1.6, 26), E(0, 7.5, 0), pushK(f, 342, 0.0012), { fov: 46, roll: 0.02 });
// 5: the wide again, the pulse crossing
const S5a = (f: number) => WIDE(f, 459, 0.001);
// 6: the golden record, gliding in
const S6a = (f: number) => dolly(S(6.0, 1.8, 3.4), S(0.6, 0.1, 0.4), pushK(f, 604, 0.001), { fov: 44 });
const S6b = (f: number) => dolly(S(3.4, 0.05, 0.4), S(0.85, -0.05, 0.3), pushK(f, 650, 0.0008), { fov: 46, roll: 0.02 });
// 7: a hello drifts away; 8: the probe alone, far
const S7a = (f: number) => dolly(S(-5.5, 2.4, 7.5), S(-0.6, 0.6, -2.0), pushK(f, 860, 0.0012), { fov: 48, roll: -0.02 });
const S8a = (f: number) => dolly(S(16, 5, 30), S(0, 0, 0), pushK(f, 933, 0.0018), { fov: 38 });
// 9-11: the control room
const S9a = (f: number) => dolly(C(0, 1.8, 5.4), C(0, 1.85, -2.0), pushK(f, 1002, 0.0012), { fov: 50 });
const S10a = (f: number) => dolly(C(0.3, 1.8, 5.0), C(0.1, 1.85, -2.0), pushK(f, 1136, 0.0012), { fov: 50, roll: 0.02 });
const S11a = (f: number) => dolly(C(0, 1.9, 4.6), C(0, 2.0, -2.9), pushK(f, 1256, 0.002, 0.006, 25), { fov: 50 });
// 12: Earth close, a hello flies out
const S12a = (f: number) => dolly(S(EARTH[0] + 3.4, EARTH[1] + 1.6, EARTH[2] + 4.0), S(EARTH[0] + 0.3, EARTH[1] + 0.4, EARTH[2]), pushK(f, 1314, 0.0010), { fov: 46, roll: 0.03 });
// 13: the lonely flat at night, then the phone
const S13a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 1484, 0.0018), { fov: 44 });
const S13b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 1576, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 83, s: S2a }, { f: 120, dur: 60, s: S2b }, { f: 196, cut: true, s: S2c }], 3: [{ f: 251, s: S3a }],
  4: [{ f: 342, s: S4a }], 5: [{ f: 459, s: S5a }], 6: [{ f: 604, s: S6a }, { f: 618, dur: 36, s: S6b }], 7: [{ f: 860, s: S7a }],
  8: [{ f: 933, s: S8a }], 9: [{ f: 1002, s: S9a }], 10: [{ f: 1136, s: S10a }], 11: [{ f: 1256, s: S11a }], 12: [{ f: 1314, s: S12a }],
  13: [{ f: 1484, s: S13a }, { f: 1576, cut: true, s: S13b }],
};

// impact kicks: the date, the year, light-day, farthest, 5 YEARS crossed, the reply, 26 billion
const KICKS: [number, number][] = [[2 / FPS, 0.6], [39 / FPS, 0.4], [196 / FPS, 0.4], [317 / FPS, 0.3], [414 / FPS, 0.4], [1297 / FPS, 0.6], [1357 / FPS, 0.3]];
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
  { f: 0, cInf: 8 }, { f: 87, cInf: 5 }, { f: 196, cInf: 0 }, { f: 346, cInf: 4 }, { f: 463, cInf: 0 }, { f: 608, cInf: 6 },
  { f: 864, cInf: 0 }, { f: 1006, cInf: 7 }, { f: 1260, cInf: 9 }, { f: 1318, cInf: 0 }, { f: 1488, cInf: 9 }, { f: 1576, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
