// Timeline of "Asked to Leave the Room" (ELIZA -> Feeloy): shots timed to the voice words (eliza-short/voice/words.json),
// cameras in the template's grammar: smootherstep glides 18-40 f, hard cuts on big reframes, every hold creeps,
// 7-frame flip kicks on impacts, rolls of ~4-5 deg on emphasis beats.
export const FPS = 30;
export const TOTAL = 1860;
export const D0 = 6.0; // street / bank / interior floor height (m)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

/** the 1966 interior set (office + corridor) sits far down the valley, out of sight of everything else: local -> world */
export const IZ = -1500;
export const I = (x: number, y: number, z: number): V3 => [x, D0 + y, IZ + z];
/** interior layout (local metres): office x -4.5..4.5, z -5..3.2; corridor z 3.4..6.8, x -7..9; door opening x 2.15..3.05 */
export const DOOR = { x0: 2.15, x1: 3.05, z: 3.4, h: 2.1 };
export const TT = { chair: [1.2, -1.55] as [number, number], desk: [1.3, 2.5, -2.0, -1.3] as const, paper: I(1.9, 1.0, -1.86) };
export const SEC_DESK = { chair: [-3.55, -1.2] as [number, number] };
// exterior landmarks
export const DOME = { x: -40, z: 56 };
export const BENCH: V3 = [70, D0, -75];
export const QUAY_Z = -33.8;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Set = "corridor" | "office" | "dome" | "booths" | "park" | "quay" | "phone";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: Set; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 158, light: "day", set: "corridor" },          // hook: the inventor sent out of his own office
  { id: 2, a: 158, b: 197, light: "day", set: "dome" },            // "M I T."
  { id: 3, a: 197, b: 358, light: "day", set: "office" },          // Weizenbaum at the teletype; the question mark
  { id: 4, a: 358, b: 487, light: "day", set: "office" },          // the secretary watching
  { id: 5, a: 487, b: 600, light: "day", set: "office" },          // she types, turns, points at the door
  { id: 6, a: 600, b: 735, light: "day", set: "corridor" },        // queue of visitors -> psychiatrists (office, cut)
  { id: 7, a: 735, b: 850, light: "day", set: "booths" },          // Sagan's therapy booths
  { id: 8, a: 850, b: 985, light: "day", set: "office" },          // close the session -> it forgot you
  { id: 9, a: 985, b: 1105, light: "day", set: "office" },         // luckily / unluckily
  { id: 10, a: 1105, b: 1240, light: "day", set: "corridor" },     // the mirror
  { id: 11, a: 1240, b: 1405, light: "day", set: "park" },         // talking to your dog
  { id: 12, a: 1405, b: 1478, light: "golden", set: "dome" },      // the ELIZA effect
  { id: 13, a: 1478, b: 1630, light: "golden", set: "quay" },      // sixty years later: Feeloy listens and remembers
  { id: 14, a: 1630, b: 1705, light: "day", set: "corridor" },     // callback: still outside his office
  { id: 15, a: 1705, b: TOTAL, light: "golden", set: "quay" },     // how did your interview go? -> end card
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 12: 8, 13: 10, 15: 8 };
export const FLASH_AT = 158;
/** the end card (logo) fades in over 8 frames from here */
export const CARD_AT = 1776;

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
/** push-in factor since f0 (see the bridge template): rate per frame, `punch` for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

// ---- framings ----
// 1 hook: corridor, the office door (frosted glass); the professor is put out; then his deadpan MS with the mug
const S1a = (f: number) => zoom(I(4.6, 1.45, 6.5), I(2.5, 1.25, 3.6), 44, pushK(f, 0, 0.002));
const S1b = (f: number) => dolly(I(3.25, 1.55, 6.3), I(2.75, 1.5, 4.25), pushK(f, 146, 0.004), { fov: 38, roll: -0.04 });
// 2 MIT: the domed building across the river
const S2a = (f: number) => dolly([-22, 22, -22], [-40, 19, 48], pushK(f, 158, 0.0025), { fov: 42 });
// 3 professor at the teletype -> paper insert with the question mark
const S3a = (f: number) => dolly(I(1.75, 1.5, 2.3), I(1.45, 1.0, -1.6), pushK(f, 197, 0.0022), { fov: 40 });
const S3b = (f: number) => dolly(I(1.6, 1.3, -0.65), I(1.9, 1.18, -1.86), pushK(f, 289, 0.003, 0.006, 30), { fov: 36, roll: 0.04 });
// 4 the secretary at her desk; push in on "She knew exactly what it was"
const S4a = (f: number) => dolly(I(-2.9, 1.45, 2.1), I(-3.3, 1.0, -1.2), pushK(f, 358, 0.002), { fov: 40 });
const S4b = (f: number) => dolly(I(-3.25, 1.4, 1.6), I(-3.45, 1.3, -1.1), pushK(f, 435, 0.002, 0.006, 30), { fov: 36, roll: -0.04 });
// 5 she types at the teletype, turns, points at the door; he stands behind her
const S5a = (f: number) => dolly(I(1.2, 1.55, 3.1), I(1.15, 1.05, -1.6), pushK(f, 487, 0.0025), { fov: 46 });
const S5b = (f: number) => dolly(I(1.15, 1.45, 2.9), I(1.1, 1.15, -1.5), pushK(f, 555, 0.003), { fov: 40, roll: 0.045 });
// 6 queue down the corridor -> psychiatrists by the mainframe
const S6a = (f: number) => dolly(I(4.4, 1.6, 6.1), I(-2, 1.2, 4.2), pushK(f, 600, 0.0025), { fov: 42 });
const S6b = (f: number) => dolly(I(-1.15, 1.5, 1.6), I(-1.15, 1.3, -3.2), pushK(f, 656, 0.0025), { fov: 40 });
// 7 the therapy booths: high down the street -> into one booth
const S7a = (f: number) => dolly([0.5, D0 + 10, -42], [0, D0 + 1.2, -76], pushK(f, 735, 0.0025), { fov: 44 });
const S7b = (f: number) => dolly([1.5, D0 + 1.55, -55.6], [-3.6, D0 + 1.1, -60.2], pushK(f, 811, 0.0025), { fov: 42 });
// 8 "But ELIZA had a problem": a visitor at the teletype, tears off the session, waves
const S8a = (f: number) => dolly(I(1.75, 1.5, 2.3), I(1.45, 1.0, -1.6), pushK(f, 850, 0.002), { fov: 40 });
const S8b = (f: number) => dolly(I(1.2, 1.4, 1.5), I(1.2, 1.15, -1.5), pushK(f, 926, 0.003), { fov: 38, roll: -0.04 });
// 9 luckily (relief MS) / unluckily (he is back, waving, the question mark again)
const S9a = (f: number) => dolly(I(1.4, 1.35, 1.4), I(1.2, 1.1, -1.55), pushK(f, 985, 0.0025), { fov: 38 });
const S9b = (f: number) => dolly(I(1.45, 1.45, 2.0), I(1.3, 1.1, -1.5), pushK(f, 1036, 0.002, 0.006, 30), { fov: 40, roll: 0.045 });
// 10 the mirror at the corridor's end
const S10a = (f: number) => dolly(I(-1.2, 1.5, 3.65), I(-6.6, 1.35, 5.35), pushK(f, 1105, 0.0025), { fov: 40 });
const S10b = (f: number) => dolly(I(-2.4, 1.45, 3.7), I(-6.65, 1.4, 5.3), pushK(f, 1197, 0.003, 0.006, 30), { fov: 36, roll: 0.04 });
// 11 kid + dog on a park bench; closer on "he looks at you like he does"
const S11a = (f: number) => dolly([BENCH[0] + 0.45, D0 + 1.2, BENCH[2] - 5.4], [BENCH[0] + 0.15, D0 + 0.7, BENCH[2] - 0.3], pushK(f, 1240, 0.002), { fov: 40 });
const S11b = (f: number) => dolly([BENCH[0] + 0.5, D0 + 1.0, BENCH[2] - 4.0], [BENCH[0] + 0.2, D0 + 0.6, BENCH[2] - 0.5], pushK(f, 1326, 0.0025, 0.006, 30), { fov: 38, roll: -0.04 });
// 12 golden dome, slow crane up
const S12a = (f: number) => { const u = glide((f - 1400) / 80); return { pos: [-27 + 4 * u, 17 + 6 * u, -20] as V3, look: [-40, 18 + 2 * u, 48] as V3, fov: 44, roll: 0 }; };
// 13 sixty years later: quay at golden hour, everyone on a phone -> the Feeloy phone insert
const S13a = (f: number) => dolly([13.5, D0 + 2.4, -27.6], [19.5, D0 + 0.9, QUAY_Z - 0.4], pushK(f, 1474, 0.002), { fov: 44 });
const S13b = (f: number) => dolly([18.3, D0 + 1.12, QUAY_Z + 2.35], [18.25, D0 + 1.05, QUAY_Z + 1.9], pushK(f, 1512, 0.0012), { fov: 40 });
// 14 callback: the corridor, the professor still outside
const S14a = (f: number) => dolly(I(4.2, 1.55, 6.4), I(2.75, 1.4, 4.2), pushK(f, 1630, 0.003), { fov: 40, roll: 0.03 });
// 15 the girl in her interview blazer on the bench -> her phone asks how it went -> the end card covers it
const S15a = (f: number) => dolly([22.6, D0 + 1.25, QUAY_Z + 3.4], [21.6, D0 + 1.05, QUAY_Z], pushK(f, 1700, 0.0025), { fov: 40 });
const S15b = (f: number) => dolly([21.75, D0 + 1.12, QUAY_Z + 2.35], [21.7, D0 + 1.05, QUAY_Z + 1.9], pushK(f, 1726, 0.0012), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 146, cut: true, s: S1b }],
  2: [{ f: 158, s: S2a }],
  3: [{ f: 197, s: S3a }, { f: 289, cut: true, s: S3b }],
  4: [{ f: 358, s: S4a }, { f: 435, cut: true, s: S4b }],
  5: [{ f: 487, s: S5a }, { f: 555, cut: true, s: S5b }],
  6: [{ f: 600, s: S6a }, { f: 656, cut: true, s: S6b }],
  7: [{ f: 735, s: S7a }, { f: 811, cut: true, s: S7b }],
  8: [{ f: 850, s: S8a }, { f: 926, cut: true, s: S8b }],
  9: [{ f: 985, s: S9a }, { f: 1036, cut: true, s: S9b }],
  10: [{ f: 1105, s: S10a }, { f: 1197, dur: 28, s: S10b }],
  11: [{ f: 1240, s: S11a }, { f: 1326, cut: true, s: S11b }],
  12: [{ f: 1400, s: S12a }],
  13: [{ f: 1474, s: S13a }, { f: 1512, cut: true, s: S13b }],
  14: [{ f: 1630, s: S14a }],
  15: [{ f: 1700, s: S15a }, { f: 1726, cut: true, s: S15b }],
};

// impact kicks (seconds, gain): door slam, the point at the door, "Unluckily", "remembered", the callback door rattle
const KICKS: [number, number][] = [[144 / FPS, 1.4], [580 / FPS, 0.8], [1036 / FPS, 0.6], [1066 / FPS, 0.5]];
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
/** cInf = blur-disc radius in px at 1080x1920 for things at infinity (0 = all sharp); focus = world point, else the look point */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 10, focus: () => I(2.6, 1.5, 3.6) },     // the door
  { f: 146, cInf: 13, focus: () => I(2.75, 1.65, 4.3) }, // his face
  { f: 158, cInf: 0 },                                    // dome establishing
  { f: 197, cInf: 10, focus: () => I(1.0, 1.35, -1.55) }, // professor at the teletype
  { f: 289, cInf: 14 },                                   // paper insert (look point)
  { f: 358, cInf: 11, focus: () => I(-3.55, 1.4, -1.2) }, // secretary
  { f: 435, cInf: 13, focus: () => I(-3.55, 1.45, -1.2) },
  { f: 487, cInf: 10, focus: () => I(1.0, 1.35, -1.55) },
  { f: 555, cInf: 12, focus: () => I(1.0, 1.4, -1.55) },
  { f: 600, cInf: 6 },                                    // queue (look point, mid-queue)
  { f: 656, cInf: 11 },                                   // psychiatrists
  { f: 735, cInf: 0 },                                    // booth street wide
  { f: 811, cInf: 10 },                                   // into the booth
  { f: 850, cInf: 10, focus: () => I(1.0, 1.35, -1.55) },
  { f: 926, cInf: 12, focus: () => I(1.0, 1.4, -1.55) },
  { f: 985, cInf: 12, focus: () => I(1.0, 1.35, -1.55) },
  { f: 1036, cInf: 11, focus: () => I(1.0, 1.4, -1.55) },
  { f: 1105, cInf: 11 },                                  // mirror
  { f: 1240, cInf: 8 },                                   // park (look point between kid and dog)
  { f: 1326, cInf: 12 },
  { f: 1405, cInf: 0 },                                   // golden dome
  { f: 1478, cInf: 5 },                                   // quay wide
  { f: 1512, cInf: 16 },                                  // phone insert: phone sharp, the quay soft
  { f: 1630, cInf: 12, focus: () => I(2.75, 1.65, 4.3) },
  { f: 1705, cInf: 11 },
  { f: 1726, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

/** near framing objects (kept for the world's API; none in this short) */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
