// Timeline of "Illegal to Be Lonely" (Swiss guinea pig law -> Feeloy): shots cut to the ElevenLabs read
// (production-pigs/voice/words.json, hand-fixed), same camera grammar as the Pasta short.
export const FPS = 30;
export const TOTAL = 1615;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { flat: -1500, homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
/** the guinea pig tray on the flat's low table: floor height and the two pigs' spots (local x, z) */
export const TRAY_Y = 0.5, PIG_A: [number, number] = [1.46, -1.0], PIG_B: [number, number] = [1.84, -1.0];
// exterior: an Alpine village out on the open grass south of the river town; the chalet front at z = MZ (x -4..4),
// its lawn toward +z, snowy peaks far behind
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -170;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 116, light: "day" },      // hook: one guinea pig; ILLEGAL
  { id: 2, a: 116, b: 186, light: "day" },    // the reason? LONELY
  { id: 3, a: 186, b: 334, light: "day" },    // the 2008 law: a friend of its own kind
  { id: 4, a: 334, b: 433, light: "day" },    // love it, talk to it: DOESN'T COUNT
  { id: 5, a: 433, b: 614, light: "day" },    // one goes: the owner is BREAKING THE LAW
  { id: 6, a: 614, b: 697, light: "day" },    // buy a young one: the cycle
  { id: 7, a: 697, b: 824, light: "day" },    // Priska's chalet: TEACHER, 80 GUINEA PIGS
  { id: 8, a: 824, b: 889, light: "day" },    // RENT-A-GUINEA-PIG
  { id: 9, a: 889, b: 1024, light: "day" },   // a roommate in a suitcase; then it goes home
  { id: 10, a: 1024, b: 1196, light: "day" }, // MATCHMAKER: grandpa + a young friend
  { id: 11, a: 1196, b: 1305, light: "day" }, // the whole country: pairs everywhere
  { id: 12, a: 1305, b: TOTAL, light: "night" },// a lonely flat at night; Jenny -> end card
];
export const XFADE: Record<number, number> = { 7: 8, 9: 8, 10: 8, 12: 10 };
export const FLASH_AT = 116;
export const CARD_AT = 1515;

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
// 1-3, 9: close on the tray
const TRAY = (f: number, f0: number, k = 0.0015, punch = 0) => dolly(Fl(1.66, 1.0, 0.5), Fl(1.65, 0.66, -1.0), pushK(f, f0, k, punch, 30), { fov: 42, roll: 0.02 });
const S1a = (f: number) => TRAY(f, 0, 0.0015, 0.006);
const S2a = (f: number) => dolly(Fl(1.5, 0.85, 0.05), Fl(1.47, 0.64, -1.0), pushK(f, 112, 0.002), { fov: 40, roll: -0.02 });
const S3a = (f: number) => TRAY(f, 182, 0.0012);
const S9a = (f: number) => TRAY(f, 885, 0.0012);
// 4-6: the owner on the sofa
const SOFA = (f: number, f0: number, k = 0.0015) => dolly(Fl(1.6, 1.3, 1.6), Fl(1.6, 0.9, -1.6), pushK(f, f0, k), { fov: 44 });
const S4a = (f: number) => SOFA(f, 330);
const S5a = (f: number) => dolly(Fl(1.7, 1.3, 2.0), Fl(1.62, 0.9, -1.5), pushK(f, 429, 0.0015, 0.005, 30), { fov: 44, roll: 0.02 });
const S6a = (f: number) => SOFA(f, 610, 0.001);
// 7, 8, 10, 11: the village
const S7a = (f: number) => dolly(E(0.2, 1.7, 9.5), E(0, 2.1, 1.0), pushK(f, 693, 0.0015), { fov: 46, roll: 0.02 });
const S8a = (f: number) => dolly(E(0.1, 2.3, 7.5), E(0, 2.9, 0.8), pushK(f, 820, 0.0025, 0.006, 30), { fov: 44 });
const S10a = (f: number) => dolly(E(-0.6, 1.5, 5.6), E(-0.9, 1.3, 1.7), pushK(f, 1020, 0.0015), { fov: 44 });
const S10b = (f: number) => dolly(E(1.77, 0.5, 4.75), E(1.76, 0.2, 3.3), pushK(f, 1093, 0.0012), { fov: 42, roll: 0.02 });
const S11a = (f: number) => dolly(E(-0.4, 2.3, 12.5), E(0, 0.7, 5.5), pushK(f, 1192, 0.0015), { fov: 48 });
// 12: the lonely flat at night, then the phone
const S12a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 1301, 0.0018), { fov: 44 });
const S12b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 1386, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 112, s: S2a }], 3: [{ f: 182, s: S3a }], 4: [{ f: 330, s: S4a }], 5: [{ f: 429, s: S5a }], 6: [{ f: 610, s: S6a }],
  7: [{ f: 693, s: S7a }], 8: [{ f: 820, s: S8a }], 9: [{ f: 885, s: S9a }], 10: [{ f: 1020, s: S10a }, { f: 1093, cut: true, s: S10b }],
  11: [{ f: 1192, s: S11a }], 12: [{ f: 1301, s: S12a }, { f: 1386, cut: true, s: S12b }],
};

// impact kicks: ILLEGAL, LONELY, DOESN'T COUNT, BREAKING THE LAW, 80, the sign
const KICKS: [number, number][] = [[40 / FPS, 0.7], [162 / FPS, 0.3], [403 / FPS, 0.4], [573 / FPS, 0.5], [788 / FPS, 0.4], [839 / FPS, 0.4]];
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
  { f: 0, cInf: 14 }, { f: 186, cInf: 13 }, { f: 334, cInf: 9 }, { f: 614, cInf: 9 }, { f: 697, cInf: 6 }, { f: 824, cInf: 6 },
  { f: 889, cInf: 14 }, { f: 1024, cInf: 8 }, { f: 1093, cInf: 14 }, { f: 1196, cInf: 4 }, { f: 1305, cInf: 9 }, { f: 1386, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
