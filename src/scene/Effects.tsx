// Effects.tsx — post-processing chain for the noir office scene.
//
// Renders a single <EffectComposer> whose passes, in draw order, are:
//   Bloom  ->  DepthOfField (high tier only)  ->  Vignette  ->  Noise
//
// Design intent: this is a DARK scene. The only surfaces that should bloom
// are the handful of genuinely self-lit ones — the laptop's green terminal
// (MeshBasicMaterial, toneMapped=false), the radio's amber dial (Lambert
// emissive), the desk-lamp bulb/glow, the sun disc outside the window
// (MeshBasicMaterial), and the amber marker rings (MeshBasicMaterial
// #E8B54A). Those are, by construction, the brightest pixels in the frame,
// so Bloom is gated purely by luminance rather than by a selection mask —
// dim flat-Lambert walls/paper sit below the threshold and stay crisp.
//
// Mount: render as a SIBLING placed AFTER the room/exhibit content inside
// the r3f scene graph (e.g. in Scene.tsx, after <Room /> and the exhibits).
// It reads the active camera from r3f context, so it needs nothing passed in.

import { useAppStore } from '../state/store';
import { EffectComposer, Bloom, DepthOfField, Vignette, Noise } from '@react-three/postprocessing';
// BlendFunction / VignetteTechnique are enums re-used from the underlying
// `postprocessing` lib (the @react-three wrapper is a thin, loosely-typed
// pass-through, so we import the source enums directly).
import { BlendFunction, VignetteTechnique } from 'postprocessing';

// --- Composer --------------------------------------------------------------
// MSAA sample count for the composer's shared framebuffer. 0 = no edge AA
// (would leave low-poly silhouettes jagged in a dark, high-contrast scene);
// the wrapper's own default is 8. We use 4: enough MSAA to clean low-poly
// edges without paying for a separate SMAA/FXAA pass, and it keeps the
// desktop frame budget comfortably under the fps >= 55 target since the
// geometry count here is tiny. Raise toward 8 only if edges still crawl.
const MULTISAMPLING = 4;

// --- Bloom -----------------------------------------------------------------
// Luminance gate. Pixels dimmer than this contribute NO bloom (the shader
// is smoothstep(threshold, threshold+smoothing, lum) — a hard floor at the
// threshold, ramping upward). 0.85 keeps lamp-lit paper (previously >1.0
// under the intensity-7 lamp; ~0.5-0.7 after the lamp cut) out of the glow.
// LOWER = lit-but-not-emissive surfaces start to halo (the paper defect);
// RAISE = restrict bloom to ever-hotter pixels. NOTE: the emissive set's
// LDR linear luminances sit ~0.5-0.7 (rings #E8B54A ~0.51, terminal green
// ~0.5-0.7) — if any of them stop glowing at this gate, brighten THAT
// material into HDR (color multiplier > 1 / higher emissiveIntensity)
// rather than lowering this back into lit-paper territory.
const BLOOM_LUMINANCE_THRESHOLD = 0.85;
// Width of the upward ramp ABOVE the threshold (sub-threshold smear is
// impossible with this shader). Smaller = pixels just past the gate reach
// full bloom sooner; larger = partial bloom until well past the gate.
const BLOOM_LUMINANCE_SMOOTHING = 0.1;
// Overall bloom strength. This is the "warm halo, not glow-stick" dial.
// RAISE for a stronger flare around the lit surfaces; LOWER to tighten it.
const BLOOM_INTENSITY = 0.85;
// Blur spread of the halo (mipmap blur only). Higher = wider, softer glow
// bleeding further from the source; lower = tighter halo hugging the edge.
const BLOOM_RADIUS = 0.72;
// mipmapBlur gives a smooth, wide, cheap glow (vs. the deprecated
// kernel-size blur). Keep true — it's the modern, performant path.
const BLOOM_MIPMAP_BLUR = true;

// --- Depth of Field (high tier only) --------------------------------------
// Fixed world-space focus point: the desk surface as seen from the seat
// (camera ~(0,1.45,2.3), desk ~(0.3,0.79,-1.2), ~3.6m away). Passing a
// static `target` makes the effect auto-derive focus distance from this
// point every frame, so the desk stays sharp even as the camera rig drifts.
const DOF_TARGET: [number, number, number] = [0.3, 0.79, -1.2];
// World-space depth band (in metres) kept in acceptable focus around the
// target. Wider = more of the room reads sharp (subtler DoF); narrower =
// the blur closes in faster on the desk. Kept generous so the room is not
// "out of focus at rest".
const DOF_WORLD_FOCUS_RANGE = 2.6;
// Normalized-depth focus band, used as the fallback focus width. Small but
// non-zero; larger = softer transition into blur.
const DOF_FOCUS_RANGE = 0.035;
// Bokeh (blur-circle) scale. This is the "how blurry do far/near things get"
// dial. RAISE for stronger, dreamier background blur; LOWER for a barely-
// there focus cue. Kept modest so the effect stays subtle.
const DOF_BOKEH_SCALE = 0.9;

// --- Vignette --------------------------------------------------------------
// Where the corner darkening begins (0 = from center, 1 = only extreme
// corners). RAISE to push the dark ring outward and free the screen edges
// where exhibit markers can sit; LOWER to pull shadow further toward center.
const VIGNETTE_OFFSET = 0.32;
// Strength of the corner darkening. RAISE for heavier noir falloff; LOWER
// so corner content (edge markers) is not crushed to black.
const VIGNETTE_DARKNESS = 0.55;

// --- Noise (film grain) ----------------------------------------------------
// Grain opacity. Deliberately tiny so it reads as film texture, not TV
// static. RAISE for a grittier, grainier image; LOWER toward 0 to clean up.
const NOISE_OPACITY = 0.045;
// premultiply multiplies the grain by the underlying color, so shadows stay
// cleaner and grain lives mostly in the lit/mid areas — the filmic look.
const NOISE_PREMULTIPLY = true;
// OVERLAY reads as texture laid into the image rather than SCREEN, which
// would just lift/wash everything lighter.
const NOISE_BLEND = BlendFunction.OVERLAY;

/**
 * Post-processing chain, quality-tier aware:
 *   high    — full chain (Bloom + DepthOfField + Vignette + Noise)
 *   mobile  — drop DepthOfField (expensive depth-based blur)
 *   reduced — drop DepthOfField AND Noise (grain flicker is continuous
 *             per-frame animation, which the reduced tier avoids); keep the
 *             static-friendly Bloom + Vignette.
 */
export default function Effects() {
  const qualityTier = useAppStore((s) => s.qualityTier);

  const enableDepthOfField = qualityTier === 'high';
  const enableNoise = qualityTier !== 'reduced';

  return (
    // key on the tier so the composer rebuilds cleanly if the tier ever
    // flips at runtime (device-tier detection can update after mount).
    <EffectComposer key={qualityTier} multisampling={MULTISAMPLING}>
      <Bloom
        luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
        luminanceSmoothing={BLOOM_LUMINANCE_SMOOTHING}
        intensity={BLOOM_INTENSITY}
        radius={BLOOM_RADIUS}
        mipmapBlur={BLOOM_MIPMAP_BLUR}
      />
      {enableDepthOfField ? (
        <DepthOfField
          target={DOF_TARGET}
          worldFocusRange={DOF_WORLD_FOCUS_RANGE}
          focusRange={DOF_FOCUS_RANGE}
          bokehScale={DOF_BOKEH_SCALE}
        />
      ) : (
        <></>
      )}
      <Vignette
        technique={VignetteTechnique.DEFAULT}
        offset={VIGNETTE_OFFSET}
        darkness={VIGNETTE_DARKNESS}
      />
      {enableNoise ? (
        <Noise blendFunction={NOISE_BLEND} premultiply={NOISE_PREMULTIPLY} opacity={NOISE_OPACITY} />
      ) : (
        <></>
      )}
    </EffectComposer>
  );
}
