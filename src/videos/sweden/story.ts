// Timeline of "Call Sweden" (The Swedish Number, 2016 -> Feeloy): shots cut to the ElevenLabs read
// (production-sweden/voice/words.json + units.json), same camera grammar as the ELIZA and Rent a Dad shorts.
export const FPS = 30;
export const TOTAL = 1540;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { office: -1500, kitchen: -1650, homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: the giant red phone on the near quay
export const QUAY_Z = -33.8;
export const PHONE_AT: V3 = [27.5, D0, QUAY_Z - 0.6]; // past the last quay bench (x 21.6)
// the control room (the office) wall board
export const BOARD: [number, number] = [1.3, 1.75];
export const BOARD_W = 1.9, BOARD_H = 1.19;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 108, light: "day" },        // hook: a giant red phone rings on the quay
  { id: 2, a: 108, b: 170, light: "night" },    // far away, at night, someone dials
  { id: 3, a: 170, b: 360, light: "day" },      // a Swede in her kitchen picks up: no script, "hej!"
  { id: 4, a: 360, b: 488, light: "day" },      // meatballs, darkness, feminism
  { id: 5, a: 488, b: 583, light: "day" },      // the map: 186 countries
  { id: 6, a: 583, b: 689, light: "day" },      // the counter: 200,000 calls, day and night
  { id: 7, a: 689, b: 833, light: "day" },      // the calendar: 376 days
  { id: 8, a: 833, b: 953, light: "day" },      // the longest call: the clock spins, 4:42
  { id: 9, a: 953, b: 1159, light: "night" },   // the caller, alone at night: longer than most movies; maybe ...
  { id: 10, a: 1159, b: TOTAL, light: "night" },// no country on speed dial; Jenny picks up -> end card
];
export const XFADE: Record<number, number> = { 2: 8, 3: 8, 5: 8, 8: 8, 9: 10 };
export const FLASH_AT = 108;
export const CARD_AT = 1446;

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

// 1 the quay: low, looking up at the giant ringing phone
const S1a = (f: number) => dolly([PHONE_AT[0] + 1.6, D0 + 1.1, QUAY_Z + 4.6], [PHONE_AT[0], D0 + 1.1, PHONE_AT[2]], pushK(f, 0, 0.003, 0.007, 40), { fov: 46, roll: -0.04 });
// 2 the caller dials (night living room)
const S2a = (f: number) => dolly(R("homeN", 0.5, 1.3, 1.6), R("homeN", -0.4, 1.0, -1.7), pushK(f, 104, 0.003), { fov: 42 });
// 3-4 the kitchen: the Swede picks up; closer for the topics
const S3a = (f: number) => dolly(R("kitchen", 0.2, 1.55, 2.9), R("kitchen", 0.0, 1.3, -1.6), pushK(f, 166, 0.0018), { fov: 46 });
const S4a = (f: number) => dolly(R("kitchen", 0.1, 1.7, 1.7), R("kitchen", 0.0, 1.7, -1.4), pushK(f, 360, 0.0015), { fov: 44, roll: 0.03 });
// 5-7 the control room board, close
const S5a = (f: number) => dolly(R("office", 1.3, 1.75, 1.3), R("office", 1.3, 1.75, -2.97), pushK(f, 484, 0.0018), { fov: 48 });
const S6a = (f: number) => dolly(R("office", 1.25, 1.75, 1.4), R("office", 1.3, 1.75, -2.97), pushK(f, 583, 0.002, 0.004, 30), { fov: 48, roll: -0.03 });
const S7a = (f: number) => dolly(R("office", 1.35, 1.75, 1.3), R("office", 1.3, 1.75, -2.97), pushK(f, 689, 0.0018), { fov: 48, roll: 0.03 });
// 8 the longest call: the Swede, the spinning clock
const S8a = (f: number) => dolly(R("kitchen", 0.5, 1.6, 2.6), R("kitchen", 0.2, 1.45, -1.6), pushK(f, 829, 0.0022), { fov: 46, roll: -0.03 });
// 9 the caller alone at night, slow push
const S9a = (f: number) => dolly(R("homeN", 0.3, 1.25, 1.2), R("homeN", -0.4, 1.05, -1.7), pushK(f, 948, 0.0018), { fov: 40 });
// 10 wider, alone; then the phone
const S10a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 1159, 0.0015), { fov: 44 });
const S10b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 1250, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }],
  2: [{ f: 104, s: S2a }],
  3: [{ f: 166, s: S3a }],
  4: [{ f: 360, s: S4a }],
  5: [{ f: 484, s: S5a }],
  6: [{ f: 583, s: S6a }],
  7: [{ f: 689, s: S7a }],
  8: [{ f: 829, s: S8a }],
  9: [{ f: 948, s: S9a }],
  10: [{ f: 1159, s: S10a }, { f: 1250, cut: true, s: S10b }],
};

// impact kicks: the phone's rings, "picks up"
const KICKS: [number, number][] = [[12 / FPS, 0.4], [30 / FPS, 0.4], [60 / FPS, 0.4], [78 / FPS, 0.4], [198 / FPS, 0.6]];
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
  { f: 0, cInf: 9 }, { f: 108, cInf: 10 }, { f: 170, cInf: 9 }, { f: 360, cInf: 12 }, { f: 488, cInf: 5 },
  { f: 833, cInf: 10 }, { f: 953, cInf: 12 }, { f: 1159, cInf: 9 }, { f: 1250, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
