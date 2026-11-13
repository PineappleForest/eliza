// Timeline of "The Slow Lane" (Jumbo's chat checkout -> Feeloy): shots cut to the ElevenLabs read
// (production-chat/voice/words.json + units.json), same camera grammar as the ELIZA and Rent a Dad shorts.
export const FPS = 30;
export const TOTAL = 2145;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { shop: -1500, home: -1650, homeN: -1800 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: the shopfront on the near quay (house fronts at z = -36.5), the quay walk line
export const QUAY_Z = -33.8;
export const SHOP_X = 44; // shopfront centre x (8 m wide)
export const SHOP_Z = -36.5;
// supermarket layout (room-local): two checkout counters along x, the chat lane (A) on the left
export const LANE_A = -2.1, LANE_B = 2.1; // counter centres x (2.6 m long, z -1.5..-0.9, 0.9 high)
export const COUNTER_H = 0.9;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 143, light: "day" },        // hook: the slow lane, push in on "slow on purpose"
  { id: 2, a: 143, b: 244, light: "day" },      // the race: beep beep bag pay next (kicks)
  { id: 3, a: 244, b: 402, light: "golden" },   // Oma walks the quay to the shop
  { id: 4, a: 402, b: 533, light: "day" },      // the different lane -> the Kletskassa sign
  { id: 5, a: 533, b: 706, light: "day" },      // one banana; the cashier asks and waits (chin on hand)
  { id: 6, a: 706, b: 835, light: "day" },      // weather / knees / grandkids / cat bubbles
  { id: 7, a: 835, b: 966, light: "day" },      // the trolley man shrugs and switches tills
  { id: 8, a: 966, b: 1006, light: "day" },     // "Customers loved it": waves goodbye
  { id: 9, a: 1006, b: 1180, light: "day" },    // the map: two hundred more stores
  { id: 10, a: 1180, b: 1294, light: "day" },   // the coffee corner
  { id: 11, a: 1294, b: 1492, light: "golden" },// Oma alone at home, one cup
  { id: 12, a: 1492, b: 1608, light: "golden" },// she thinks of the cashier
  { id: 13, a: 1608, b: 1767, light: "golden" },// the shop shutter rolls down
  { id: 14, a: 1767, b: TOTAL, light: "night" },// 3 a.m., Jenny on Oma's phone -> end card
];
export const XFADE: Record<number, number> = { 3: 8, 11: 12, 13: 10, 14: 12 };
export const FLASH_AT = 143;
export const CARD_AT = 2056;

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

// 1 the slow lane: cashier + Oma at the chat checkout, push in
const S1a = (f: number) => dolly(R("shop", -1.75, 1.75, 5.2), R("shop", -1.95, 1.3, -1.2), pushK(f, 0, 0.0022, 0.005, 40), { fov: 46, roll: 0.03 });
// 2 the race at the normal lane, kicks on every beep
const S2a = (f: number) => dolly(R("shop", 2.3, 1.6, 3.4), R("shop", 2.15, 1.15, -1.3), pushK(f, 143, 0.0015), { fov: 50, roll: -0.05 });
// 3 golden quay: Oma walks to the shopfront
export const OMA_X = (f: number) => SHOP_X - 7.2 + 0.75 * Math.min(Math.max(0, (f - 240) / FPS), 6.4);
const S3a = (f: number) => { const x = OMA_X(f); return { pos: [x - 1.2, D0 + 1.6, QUAY_Z + 6.4] as V3, look: [x + 1.4, D0 + 1.45, SHOP_Z + 1.0] as V3, fov: 46, roll: 0.03 }; };
// 4 inside: the different lane -> the sign
const S4a = (f: number) => dolly(R("shop", -0.9, 1.9, 5.0), R("shop", -2.1, 1.35, -1.2), pushK(f, 398, 0.0025), { fov: 44 });
const S4b = (f: number) => dolly(R("shop", -1.9, 2.3, 2.9), R("shop", -2.1, 2.55, -1.2), pushK(f, 452, 0.0025, 0.005, 30), { fov: 40, roll: -0.04 });
// 5 the banana, the question; closer on the cashier waiting
const S5a = (f: number) => dolly(R("shop", -1.75, 1.6, 3.2), R("shop", -1.95, 1.2, -1.0), pushK(f, 533, 0.0018), { fov: 48 });
const S5b = (f: number) => dolly(R("shop", -2.45, 1.55, 1.0), R("shop", -2.75, 1.4, -2.05), pushK(f, 620, 0.003), { fov: 38, roll: -0.03 });
// 6 Oma talks: bubbles above her
const S6a = (f: number) => dolly(R("shop", -0.8, 1.75, 1.9), R("shop", -1.3, 1.75, -0.3), pushK(f, 706, 0.0018), { fov: 42, roll: 0.03 });
// 7 the queue: the trolley man moves to lane B
const S7a = (f: number) => dolly(R("shop", 1.2, 1.9, 5.0), R("shop", -0.2, 1.15, -0.8), pushK(f, 835, 0.0018), { fov: 46 });
const S7b = (f: number) => dolly(R("shop", 2.2, 1.9, 5.0), R("shop", 1.2, 1.15, -0.8), pushK(f, 835, 0.0018), { fov: 46 });
// 8 waves goodbye
const S8a = (f: number) => dolly(R("shop", -1.8, 1.6, 3.4), R("shop", -1.95, 1.25, -1.0), pushK(f, 966, 0.003), { fov: 48, roll: 0.03 });
// 9 the map poster on the back wall
const S9a = (f: number) => dolly(R("shop", 0.15, 2.05, 1.3), R("shop", 0, 2.05, -5.9), pushK(f, 1006, 0.0018, 0.004, 40), { fov: 44 });
// 10 the coffee corner
const S10a = (f: number) => dolly(R("shop", 4.5, 1.35, 5.8), R("shop", 4.8, 0.95, 2.3), pushK(f, 1180, 0.0025), { fov: 40, roll: -0.03 });
// 11-12 home at dusk: alone at the table, then closer
const S11a = (f: number) => dolly(R("home", 0.7, 1.4, 2.7), R("home", -0.3, 1.0, -1.6), pushK(f, 1288, 0.0018), { fov: 42 });
const S12a = (f: number) => dolly(R("home", 0.0, 1.5, 0.9), R("home", -0.4, 1.42, -2.35), pushK(f, 1492, 0.0022), { fov: 40, roll: 0.03 });
// 13 dusk quay: the shutter comes down
const S13a = (f: number) => dolly([SHOP_X + 2.4, D0 + 2.4, -17.5], [SHOP_X, D0 + 1.9, SHOP_Z + 0.4], pushK(f, 1604, 0.0012), { fov: 46, roll: -0.03 });
// 14 night: Oma in her armchair, then the phone
const S14a = (f: number) => dolly(R("homeN", 0.6, 1.35, 1.9), R("homeN", -0.4, 0.95, -1.7), pushK(f, 1761, 0.002), { fov: 42 });
const S14b = (f: number) => dolly(R("homeN", -0.38, 1.08, -0.45), R("homeN", -0.42, 1.0, -0.95), pushK(f, 1800, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }],
  2: [{ f: 143, s: S2a }],
  3: [{ f: 240, s: S3a }],
  4: [{ f: 398, s: S4a }, { f: 452, cut: true, s: S4b }],
  5: [{ f: 533, s: S5a }, { f: 620, cut: true, s: S5b }],
  6: [{ f: 706, s: S6a }],
  7: [{ f: 835, s: S7a }, { f: 904, dur: 40, s: S7b }],
  8: [{ f: 966, s: S8a }],
  9: [{ f: 1006, s: S9a }],
  10: [{ f: 1180, s: S10a }],
  11: [{ f: 1288, s: S11a }],
  12: [{ f: 1492, s: S12a }],
  13: [{ f: 1604, s: S13a }],
  14: [{ f: 1761, s: S14a }, { f: 1800, cut: true, s: S14b }],
};

// impact kicks: every beep / bag / pay / next of the race
const KICKS: [number, number][] = [[187 / FPS, 0.6], [202 / FPS, 0.6], [215 / FPS, 0.5], [227 / FPS, 0.5], [233 / FPS, 0.9]];
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
  { f: 0, cInf: 9 }, { f: 143, cInf: 12 }, { f: 244, cInf: 7 },
  { f: 402, cInf: 8 }, { f: 452, cInf: 14 }, { f: 533, cInf: 10 }, { f: 620, cInf: 13 },
  { f: 706, cInf: 11 }, { f: 835, cInf: 7 }, { f: 966, cInf: 10 }, { f: 1006, cInf: 6 }, { f: 1180, cInf: 10 },
  { f: 1294, cInf: 8 }, { f: 1492, cInf: 12 }, { f: 1608, cInf: 5 }, { f: 1767, cInf: 9 }, { f: 1800, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
