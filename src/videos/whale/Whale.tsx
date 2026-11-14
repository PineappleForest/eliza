// "The Loneliest Whale" (52 Hz -> Feeloy): ~42 s vertical short in the flat-characters-in-a-3D-toon-world style,
// built on the bridge template's look (ink, lens blur, bloom, grade). Ends on the Feeloy end card (2D overlay).
// One three.js world (world.ts) posed per frame from the story timeline (story.ts). Post chain (look-match pass):
//   InkPass (world ink lines, own pass) -> lens blur pre + main (thin-lens DOF per shot from dofAt) ->
//   [bloom (emissive only) + NEUTRAL tone mapping + colour grade] (one merged EffectPass), MSAA 4.
// Ink runs before the DOF so lines blur with what they belong to; bloom after the DOF so glows defocus with their
// source; the grade is display-referred, so it comes after tone mapping. Every pixel-sized parameter is specified at
// 1080x1920 and scaled with the output size, so stills at --scale 0.5 and the 1440x2560 final match.
// Place changes crossfade by stacking a second canvas for the fade frames; the hook ends on a 4-frame white flash.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, Img, continueRender, delayRender, getInputProps, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { Kit } from "./build";
import { TOTAL, FLASH_AT, CARD_AT, SHOTS, layersAt, dofAt, FPS } from "./story";
import CAPTIONS from "./captions.json";

export const WHALE_FRAMES = TOTAL;

/** A/B switches for test stills only (Remotion inputProps `{ post: { ink: false, ... } }`); everything is on by default. */
type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean; grain: boolean };
const toggles = (): PostToggles => ({ ink: true, lens: true, pre: true, bloom: true, grade: true, grain: false, ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });

/** Bloom for emissive sources only (depth.md 6.4). Its MIP chain always starts at 540x960 (half of 1080x1920),
 *  whatever the output size, so the glow keeps the same size relative to the frame (e-fold ~30 px at 1080p,
 *  ~1.5 % of the frame height) at 540, 1080 and 1440 widths. ADD blend: HDR-safe (SCREEN darkens values > 1). */
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("monowi kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
    grain: new GrainEffect({ amount: 0.025, cellPx: 1.5 }), // film grain, OFF by default (inputProps post.grain): the reference measures no grain and it quadruples the file size
  }), [camera, scene]);
  // the composer disposes its passes on unmount (crossfade layers come and go), so the ink pass may already be gone
  useEffect(() => () => { try { (fx.ink as unknown as { dispose?: () => void }).dispose?.(); } catch { /* already disposed */ } }, [fx]);
  const post = useMemo(() => (
    <EffectComposer multisampling={4}>
      {on.ink ? <primitive object={fx.ink} dispose={null} /> : <></>}
      {on.lens && on.pre ? <primitive object={fx.lens.pre} dispose={null} /> : <></>}
      {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : <></>}
      {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : <></>}
      <primitive object={fx.tone} dispose={null} />
      {on.grade ? <primitive object={fx.grade} dispose={null} /> : <></>}
      {on.grain ? <primitive object={fx.grain} dispose={null} /> : <></>}
    </EffectComposer>
  ), [fx, on]);
  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);
  // thin-lens focus: distance along the view axis to the shot's focus point (default: the camera's look target)
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  fx.grain.seed = f; // deterministic per frame
  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

/** test stills only: inputProps `{ post: { dpr: 0.5 } }` forces the WebGL buffer size (R3F clamps dpr to >= 1 by default) */
const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}>
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

/** end card: the Feeloy art as an app icon + wordmark on a soft lilac-to-pink gradient (logo file: public/eliza/logo.png
 *  replaces the wordmark when present, via inputProps { logo: true }) */
const EndCard: React.FC<{ f: number }> = ({ f }) => {
  const a = interpolate(f, [CARD_AT, CARD_AT + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s = interpolate(f, [CARD_AT, CARD_AT + 14, TOTAL], [0.92, 1.0, 1.04], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logo = (getInputProps() as { logo?: boolean }).logo;
  return (
    <AbsoluteFill style={{ opacity: a, background: "linear-gradient(180deg, #2d3e74 0%, #6f6fb0 48%, #f3a6c8 100%)", alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${s})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 64 }}>
        {logo
          // the Feeloy logo is the app icon; its PNG has a baked-in checkerboard outside the rounded square, so clip to it
          ? <div style={{ width: 500, height: 500, borderRadius: "13.5%", overflow: "hidden", boxShadow: "0 30px 80px rgba(20,16,40,0.45)" }}>
              <Img src={staticFile("eliza/logo.png")} style={{ width: "103%", height: "103%", marginLeft: "-1.5%", marginTop: "-1.5%" }} />
            </div>
          : <div style={{ width: 520, height: 520, borderRadius: 120, overflow: "hidden", boxShadow: "0 30px 80px rgba(20,16,40,0.45)", border: "10px solid #ffffff", background: "#ffffff" }}>
              <Img src={staticFile("eliza/feeloy_art.png")} style={{ width: "112%", marginLeft: "-6%", marginTop: "-2%" }} />
            </div>}
        <div style={{ fontFamily: "'Nunito', 'Quicksand', 'Avenir Next', 'Helvetica Neue', Arial, sans-serif", fontWeight: 800, fontSize: 168, letterSpacing: 4, color: "#ffffff",
          textShadow: "0 8px 30px rgba(30,20,60,0.35)" }}>Feeloy</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------- karaoke captions ----------------
// Pages of 1-3 words (production tools/caption_pages.py, timed to the narration). The spoken word turns Feeloy pink and
// pops; pages pop in. Low in the frame (faces sit above), lower still on the end card. Turn off: inputProps { captions: false }.
type Page = { s: number; e: number; w: [string, number, number][] };
const PAGES = CAPTIONS as Page[];
const CAP_FONT = "ElizaCaps";
const useCaptionFont = () => {
  const [handle] = useState(() => delayRender("caption font"));
  useEffect(() => {
    const f = new FontFace(CAP_FONT, `url(${staticFile("eliza/fonts/montserrat-latin-900-normal.woff2")})`, { weight: "900" });
    f.load().then((ff) => { (document.fonts as unknown as { add: (x: FontFace) => void }).add(ff); continueRender(handle); }).catch(() => continueRender(handle));
  }, [handle]);
};
const Captions: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const i = PAGES.findIndex((p, k) => t >= p.s - 0.06 && t < Math.min(p.e + 0.45, (PAGES[k + 1]?.s ?? 1e9) - 0.06));
  if (i < 0) return null;
  const pg = PAGES[i], since = t - (pg.s - 0.06);
  const popIn = interpolate(since, [0, 0.1], [0.82, 1], { extrapolateRight: "clamp" });
  const onCard = f >= CARD_AT;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: onCard ? 1610 : 1290, pointerEvents: "none" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 1040, transform: `scale(${popIn})`,
        fontFamily: `${CAP_FONT}, 'Arial Black', sans-serif`, fontWeight: 900, fontSize: 80, lineHeight: 1.15, textTransform: "uppercase", letterSpacing: 1 }}>
        {pg.w.map(([w, s, e], k) => {
          const last = k === pg.w.length - 1;
          const on = t >= s - 0.03 && (t < e || (last && t < pg.e + 0.45)) ;
          const pop = on ? interpolate(t - (s - 0.03), [0, 0.07, 0.16], [1, 1.14, 1.08], { extrapolateRight: "clamp" }) : 1;
          return (
            <span key={k} style={{ display: "inline-block", margin: "0 20px", transform: `scale(${pop})`, color: on ? "#ff5fae" : "#ffffff",
              WebkitTextStroke: "14px #1b1420", paintOrder: "stroke fill", textShadow: "0 8px 0 rgba(27,20,32,0.55)" }}>{w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const WhaleShort: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  useCaptionFont();
  const caps = (getInputProps() as { captions?: boolean }).captions !== false;
  if (!kit) return null;
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  const cardOnly = f >= CARD_AT + 8;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {!cardOnly && layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />)}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
      {f >= CARD_AT && <EndCard f={f} />}
      {caps && <Captions f={f} />}
    </AbsoluteFill>
  );
};
