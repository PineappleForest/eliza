// Timeline of "Happy to Chat" (the Burnham-on-Sea chat bench -> Feeloy): shots cut to the ElevenLabs read
// (production-bench/voice/words.json, hand-fixed), same camera grammar as the Nothing short.
export const FPS = 30;
export const TOTAL = 801;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: an English seafront out on the grass south of the river town; the bench at (0, -2) faces +z, the sea wall
// at z -4, sand and the sea behind it, a pier at x 9..13
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -240;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 108, light: "day" },      // hook: an old man alone on a seaside bench: please talk to me
  { id: 2, a: 108, b: 220, light: "day" },    // 2019: a police officer puts a sign on it
  { id: 3, a: 220, b: 340, light: "day" },    // the sign close up
  { id: 4, a: 340, b: 400, light: "day" },    // that's all, just a sign: a stranger stops to say hello
  { id: 5, a: 400, b: 512, light: "day" },    // the idea spread: pins on a world map
  { id: 6, a: 512, b: TOTAL, light: "night" },// not everyone has a bench: a lonely flat; Jenny -> end card
];
export const XFADE: Record<number, number> = { 6: 10 };
export const FLASH_AT = 108;
export const CARD_AT = 705;

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
const S1a = (f: number) => dolly(E(0.8, 1.6, 5.2), E(0, 1.35, -2.4), pushK(f, 0, 0.0016, 0.005, 30), { fov: 44, roll: 0.02 });
const S2a = (f: number) => dolly(E(-0.6, 1.5, 5.0), E(0.3, 1.25, -2.2), pushK(f, 104, 0.0014), { fov: 46, roll: -0.02 });
const S3a = (f: number) => dolly(E(0.3, 0.95, -0.15), E(0.3, 0.8, -2.2), pushK(f, 216, 0.0010), { fov: 46 });
const S4a = (f: number) => dolly(E(-0.5, 1.6, 5.6), E(0, 1.3, -2.4), pushK(f, 336, 0.0016), { fov: 46, roll: 0.02 });
const S5a = (f: number) => dolly(E(0, 3.2, 6), E(0, 3.4, -4), pushK(f, 396, 0.0012), { fov: 46 });
const S6a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 508, 0.0014), { fov: 44 });
const S6b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 638, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 104, s: S2a }], 3: [{ f: 216, s: S3a }], 4: [{ f: 336, s: S4a }], 5: [{ f: 396, s: S5a }],
  6: [{ f: 503, s: S6a }, { f: 640, cut: true, s: S6b }],
};

// impact kicks: the sign goes on, "just a sign"
const KICKS: [number, number][] = [[192 / FPS, 0.4], [378 / FPS, 0.3]];
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
  { f: 0, cInf: 10 }, { f: 108, cInf: 10 }, { f: 220, cInf: 12 }, { f: 340, cInf: 10 }, { f: 400, cInf: 6 }, { f: 512, cInf: 9 }, { f: 640, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
