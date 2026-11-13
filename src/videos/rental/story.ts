// Timeline of "Rent a Dad" (Japan's rental families -> Feeloy): shots cut to the ElevenLabs read
// (rental-short/voice/words.json + units.json), same camera grammar as the ELIZA short.
export const FPS = 30;
export const TOTAL = 1866;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { show: -1500, wed: -1600, office: -1700, apt: -1800, bed: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior landmarks (the town of the ELIZA short)
export const BENCH: V3 = [70, D0, -75];
export const QUAY_Z = -33.8;
export const LINEUP = [-2.0, -1.0, 0, 1.0, 2.0]; // showroom stage slots (x), z = -3.0, stage top 0.25
export const STAGE_Y = 0.25;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 84, light: "day" },          // hook: the showroom lineup, the rental dad
  { id: 2, a: 84, b: 207, light: "day" },        // dad + kid on the quay, checks his watch on "an hour"
  { id: 3, a: 207, b: 398, light: "day" },       // wedding guests: price tags, a singer, a tearful speech
  { id: 4, a: 398, b: 481, light: "day" },       // all thirty guests wave; the groom deadpan
  { id: 5, a: 481, b: 620, light: "day" },       // the apology bow with a rented boss
  { id: 6, a: 620, b: 760, light: "golden" },    // rental dad + girl with an ice cream, park bench
  { id: 7, a: 760, b: 900, light: "day" },       // rental husband holding hands; staffer with a clipboard
  { id: 8, a: 900, b: 1005, light: "day" },      // she proposes
  { id: 9, a: 1005, b: 1218, light: "golden" },  // grandmother talks, the rental son listens
  { id: 10, a: 1218, b: 1365, light: "night" },  // the nightlight
  { id: 11, a: 1365, b: 1484, light: "golden" }, // the founder alone in the empty showroom
  { id: 12, a: 1484, b: 1567, light: "golden" }, // the girl and her phone on the quay
  { id: 13, a: 1567, b: 1752, light: "golden" }, // Feeloy on the phone: shows up, listens, remembers
  { id: 14, a: 1752, b: TOTAL, light: "day" },   // callback: the lineup checks their watches -> end card
];
export const XFADE: Record<number, number> = { 6: 8, 7: 8, 9: 8, 10: 10, 11: 10, 12: 8 };
export const FLASH_AT = 84;
export const CARD_AT = 1792;

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

// 1 showroom: wide lineup -> push on the dad (centre)
const S1a = (f: number) => dolly(R("show", 0, 1.65, 6.0), R("show", 0, 1.3, -3.0), pushK(f, 0, 0.004, 0.008, 40), { fov: 48 });
// 2 quay: dad + kid walking toward screen-left along the quay; closer on "an hour"
const QX = (f: number) => 16 - 0.9 * Math.min(Math.max(0, T(f) - T(84)), T(178) - T(84)); // walking along -x at 0.9 m/s, stops at f178 (the watch)
const S2a = (f: number) => { const x = QX(f); return dolly([x - 1.4, D0 + 2.0, QUAY_Z + 8.5], [x - 0.1, D0 + 0.95, QUAY_Z + 1.2], pushK(f, 84, 0.0015), { fov: 40 }); };
const S2b = (f: number) => { const x = QX(f); return dolly([x - 0.4, D0 + 1.6, QUAY_Z + 4.6], [x + 0.2, D0 + 1.2, QUAY_Z + 1.2], pushK(f, 186, 0.003), { fov: 38, roll: 0.04 }); };
// 3 wedding: wide over the tables -> the row of identical smiles -> singer -> speech
const S3a = (f: number) => dolly(R("wed", 0, 2.6, 6.2), R("wed", 0, 1.1, -1.5), pushK(f, 207, 0.002), { fov: 46 });
const S3b = (f: number) => dolly(R("wed", -0.3, 1.45, 3.4), R("wed", -0.6, 1.2, 0.0), pushK(f, 250, 0.0025), { fov: 40 });
const S3c = (f: number) => dolly(R("wed", 1.6, 1.6, 3.6), R("wed", 1.9, 1.45, 0.0), pushK(f, 296, 0.003, 0.006, 30), { fov: 38, roll: 0.04 });
const S3d = (f: number) => dolly(R("wed", -0.6, 1.6, -2.0), R("wed", -0.2, 1.5, -5.4), pushK(f, 336, 0.003), { fov: 38, roll: -0.04 });
// 4 wedding high wide: all the guests, the groom at the head table
const S4a = (f: number) => dolly(R("wed", 0, 4.2, 6.6), R("wed", 0, 0.9, -2.5), pushK(f, 398, 0.002, 0.005, 30), { fov: 50 });
// 5 office: the bow (side views), closer on "rent the boss, too"
const S5a = (f: number) => dolly(R("office", 0.3, 1.5, 6.4), R("office", 0.3, 1.0, -1.6), pushK(f, 481, 0.0025), { fov: 44 });
const S5b = (f: number) => dolly(R("office", -0.75, 1.3, 2.7), R("office", -0.95, 1.0, -1.6), pushK(f, 581, 0.003), { fov: 38, roll: -0.04 });
// 6 park bench (golden): dad + girl -> closer on "She didn't know"
const S6a = (f: number) => dolly([BENCH[0] + 0.3, D0 + 1.15, BENCH[2] - 5.0], [BENCH[0] + 0.1, D0 + 0.75, BENCH[2] - 0.4], pushK(f, 616, 0.002), { fov: 40 });
const S6b = (f: number) => dolly([BENCH[0] - 0.15, D0 + 0.95, BENCH[2] - 2.6], [BENCH[0] - 0.3, D0 + 0.75, BENCH[2] - 0.4], pushK(f, 727, 0.0025), { fov: 38, roll: 0.035 });
// 7-8 quay bench (day): the couple, the staffer; the proposal
const CB = 25.0; // couple's bench centre x (benches at 8 + 3.4k)
const S7a = (f: number) => dolly([CB + 0.4, D0 + 1.3, QUAY_Z + 5.4], [CB, D0 + 0.95, QUAY_Z - 0.4], pushK(f, 756, 0.002), { fov: 42 });
const S7b = (f: number) => dolly([CB + 0.2, D0 + 1.0, QUAY_Z + 3.0], [CB, D0 + 0.75, QUAY_Z - 0.2], pushK(f, 848, 0.003), { fov: 38, roll: 0.035 });
const S8a = (f: number) => dolly([CB + 0.6, D0 + 1.35, QUAY_Z + 4.8], [CB + 0.2, D0 + 1.15, QUAY_Z], pushK(f, 900, 0.0025, 0.006, 30), { fov: 40, roll: -0.04 });
// 9 apartment (golden window): grandmother + rental son at the table
const S9a = (f: number) => dolly(R("apt", 0, 1.35, 2.8), R("apt", 0, 1.0, -1.6), pushK(f, 1001, 0.002), { fov: 42 });
const S9b = (f: number) => dolly(R("apt", -0.4, 1.2, 0.9), R("apt", -0.55, 1.1, -1.6), pushK(f, 1168, 0.003), { fov: 38, roll: 0.035 });
// 10 bedroom (night): the nightlight, then the kid, pull back into the dark room on "alone in the dark"
const S10a = (f: number) => dolly(R("bed", 1.25, 0.95, -0.85), R("bed", 1.9, 0.78, -2.43), pushK(f, 1213, 0.003), { fov: 38 });
const S10b = (f: number) => dolly(R("bed", 0.4, 1.2, 1.4), R("bed", -0.1, 0.85, -1.6), pushK(f, 1261, 0.002), { fov: 40 });
const S10c = (f: number) => { const u = glide((f - 1294) / 60); return { pos: R("bed", 0.4 + 0.3 * u, 1.3 + 0.3 * u, 1.4 + 0.9 * u), look: R("bed", 0.1, 0.8, -1.8), fov: 40 + 6 * u, roll: 0 }; };
// 11 founder alone in the showroom at dusk
const S11a = (f: number) => dolly(R("show", 1.4, 1.5, 3.6), R("show", 2.6, 1.15, -0.6), pushK(f, 1360, 0.0025), { fov: 40 });
// 12 the girl on the quay bench (golden), 13 the phone insert
const GB = 11.4; // her bench centre x
const S12a = (f: number) => dolly([GB + 1.6, D0 + 1.5, QUAY_Z + 5.2], [GB - 0.2, D0 + 1.0, QUAY_Z - 0.3], pushK(f, 1480, 0.0025), { fov: 40 });
const S13a = (f: number) => dolly([GB - 0.35, D0 + 1.12, QUAY_Z + 2.35], [GB - 0.4, D0 + 1.05, QUAY_Z + 1.9], pushK(f, 1567, 0.0012), { fov: 40 });
// 14 the lineup again, glancing at their watches
const S14a = (f: number) => dolly(R("show", 0.2, 1.6, 5.6), R("show", 0, 1.3, -3.0), pushK(f, 1752, 0.003), { fov: 46, roll: 0.03 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }],
  2: [{ f: 84, s: S2a }, { f: 186, cut: true, s: S2b }],
  3: [{ f: 207, s: S3a }, { f: 250, cut: true, s: S3b }, { f: 296, cut: true, s: S3c }, { f: 336, cut: true, s: S3d }],
  4: [{ f: 398, s: S4a }],
  5: [{ f: 481, s: S5a }, { f: 581, cut: true, s: S5b }],
  6: [{ f: 616, s: S6a }, { f: 727, cut: true, s: S6b }],
  7: [{ f: 756, s: S7a }, { f: 848, cut: true, s: S7b }],
  8: [{ f: 896, s: S8a }],
  9: [{ f: 1001, s: S9a }, { f: 1168, cut: true, s: S9b }],
  10: [{ f: 1213, s: S10a }, { f: 1261, cut: true, s: S10b }, { f: 1294, cut: true, s: S10c }],
  11: [{ f: 1360, s: S11a }],
  12: [{ f: 1480, s: S12a }],
  13: [{ f: 1567, s: S13a }],
  14: [{ f: 1752, s: S14a }],
};

// impact kicks: the proposal ("proposing"), the boss bow landing ("apologize")
const KICKS: [number, number][] = [[980 / FPS, 1.2], [540 / FPS, 0.5]];
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
  { f: 0, cInf: 8 },
  { f: 84, cInf: 9 }, { f: 186, cInf: 12 },
  { f: 207, cInf: 0 }, { f: 250, cInf: 10 }, { f: 296, cInf: 12 }, { f: 336, cInf: 12 },
  { f: 398, cInf: 0 },
  { f: 481, cInf: 8 }, { f: 581, cInf: 12 },
  { f: 620, cInf: 8 }, { f: 727, cInf: 12 },
  { f: 760, cInf: 8 }, { f: 848, cInf: 12 }, { f: 900, cInf: 10 },
  { f: 1005, cInf: 8 }, { f: 1168, cInf: 12 },
  { f: 1218, cInf: 14 }, { f: 1261, cInf: 8 }, { f: 1294, cInf: 5 },
  { f: 1365, cInf: 9 },
  { f: 1484, cInf: 9 }, { f: 1567, cInf: 16 },
  { f: 1752, cInf: 7 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
export const QX_AT = QX; // the walk on the quay (cast.ts places dad + kid on it)
export const COUPLE_X = CB, GIRL_BENCH_X = GB;
