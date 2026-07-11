// CameraRig — owns the perspective camera every frame (position + look) via a
// single useFrame. Mounted inside <Canvas>. Replaces the old one-shot CameraAim.
//
// ─────────────────────────────────────────────────────────────────────────
// STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────
// Modes:  idle · flyTo · focused · returnToSeat
//
//   idle          camera rests at the seat; slow Lissajous look-drift +
//                 breathing bob + full-range damped mouse-look.
//   flyTo         dollying from the current pose to an exhibit's camera pose.
//   focused       parked at an exhibit (panel open); reduced mouse-look, no
//                 drift/bob.
//   returnToSeat  dollying from the current pose back to the seat; mouse-look
//                 and drift ramp back up so it's full idle by the time it lands.
//
// The only external drivers are the store's `focusId` and `panelId`. Because
// `panelId===null && focusId!=null` is ambiguous (it's true both BEFORE arrival
// during flyTo and AFTER the UI closes the panel), the rig keeps its own `mode`
// plus `committed` (the exhibit id the current flight/rest is bound to) to
// disambiguate. Every (mode, event) pair is defined:
//
//   idle:
//     focusId set                       -> flyTo(focusId)
//   flyTo:
//     focusId cleared (ESC/cancel)       -> returnToSeat
//     focusId changed to other exhibit   -> flyTo(new)      (retarget from cur)
//     flight arrived                      -> arriveAtExhibit(committed); focused
//   focused:
//     focusId cleared                     -> returnToSeat
//     focusId changed to other exhibit    -> flyTo(new)
//     panelId cleared (UI closed panel)   -> returnToSeat
//   returnToSeat:
//     focusId set to a *different* id     -> flyTo(new)      (click during return)
//     flight arrived                      -> clearFocus(); idle
//
// Every flight is rebuilt from the CURRENT camera pose, so retargets (ESC spam,
// rapid marker clicks, click-during-return) redirect smoothly and can never
// snap, flip, queue, or NaN.
//
// ESC (window keydown): panel open -> closePanel(); else focus set (mid-flight,
// no panel yet) -> clearFocus(). Both resolve to a return-to-seat via the frame
// logic above.
//
// Reduced motion (qualityTier==='reduced' OR prefers-reduced-motion): flights
// become instant cuts (pose snaps, arrival callback fires the next frame); no
// drift, no bob; mouse-look still works but with lower range and heavier damping.

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { damp } from 'maath/easing';
import { EXHIBITS_BY_ID } from '../content/exhibits';
import type { ExhibitId } from '../content/types';
import { useAppStore } from '../state/store';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  advance,
  flightArrived,
  flightDuration,
  flightProgress,
  makeFlight,
  sampleFov,
  sampleLook,
  samplePos,
  type Flight,
  type V3,
} from './flight';

// ── Fixed scene geometry ──────────────────────────────────────────────────
const SEAT: V3 = [0, 1.45, 2.3];
const BASE_LOOK: V3 = [0, 1.3, -1.5];
const SCENE_FOV = 55;

// ── Motion tuning ─────────────────────────────────────────────────────────
const DRIFT_YAW_AMP = 0.015;
const DRIFT_YAW_FREQ = 0.11; // rad/s-class phase speed
const DRIFT_PITCH_AMP = 0.009;
const DRIFT_PITCH_FREQ = 0.083; // incommensurate with yaw freq
const BOB_AMP = 0.008;
const BOB_FREQ = 0.62;

const MOUSE_YAW_RANGE = 0.22;
const MOUSE_PITCH_RANGE = 0.12;
const MOUSE_YAW_RANGE_REDUCED = 0.1;
const MOUSE_PITCH_RANGE_REDUCED = 0.06;
const MOUSE_SMOOTH = 0.28; // maath damp smoothTime (feels like turning your head)
const MOUSE_SMOOTH_REDUCED = 0.6; // heavier
const INFLUENCE_SMOOTH = 0.5; // how fast mouse/drift influence ramps between modes

// Per-mode influence targets for [mouse, drift].
const MOUSE_INF = { idle: 1, flyTo: 0.15, focused: 0.4, returnToSeat: 1 } as const;
const DRIFT_INF = { idle: 1, flyTo: 0, focused: 0, returnToSeat: 1 } as const;

const FOV_SMOOTH = 0.4;
const LOOK_DEGENERATE_EPS = 1e-4;

type Mode = 'idle' | 'flyTo' | 'focused' | 'returnToSeat';

// ── Module-scope scratch (NO allocations in the useFrame hot path) ─────────
const _basePos: V3 = [0, 0, 0];
const _baseLook: V3 = [0, 0, 0];
const _dir = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _tmpFrom: V3 = [0, 0, 0];
const _committedPos: V3 = [0, 0, 0];
const _committedLook: V3 = [0, 0, 0];

// Rotate direction `d` (in-place) by yaw (about world +Y) then pitch (about the
// camera's right axis ≈ world +X while facing -Z). Positive pitch looks up.
function rotateDir(d: THREE.Vector3, yaw: number, pitch: number): void {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = d.x * cy + d.z * sy;
  const z1 = -d.x * sy + d.z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y2 = d.y * cp - z1 * sp;
  const z2 = d.y * sp + z1 * cp;
  d.set(x1, y2, z2);
}

interface DevRig {
  goto(id: ExhibitId | string | null): void;
  state(): { mode: Mode; t: number; pos: [number, number, number] };
}
interface PerfInfo {
  fps: number;
  drawCalls: number;
  tris: number;
}

export default function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const prefersReduced = useReducedMotion();

  // ── Persistent rig state (all in refs; never in the store) ──────────────
  const modeRef = useRef<Mode>('idle');
  const committedRef = useRef<ExhibitId | null>(null);
  const flightRef = useRef<Flight | null>(null);
  const justBeganRef = useRef(false); // defer arrival one frame after (re)begin
  const currentLookRef = useRef<V3>([BASE_LOOK[0], BASE_LOOK[1], BASE_LOOK[2]]);

  const pointerRef = useRef({ x: 0, y: 0 }); // NDC, updated by listener
  const mouseAnglesRef = useRef({ yaw: 0, pitch: 0 }); // damped mouse-look
  const mouseInfRef = useRef({ v: 1 });
  const driftInfRef = useRef({ v: 1 });

  const perfAccum = useRef({ frames: 0, time: 0 });

  // ── Pointer + ESC listeners ─────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const st = useAppStore.getState();
      if (st.introPhase !== 'done') return;
      if (st.panelId !== null) {
        st.closePanel(); // focused: UI closes panel -> rig returns to seat
      } else if (st.focusId !== null) {
        st.clearFocus(); // mid-flight, no panel yet: cancel -> return to seat
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // ── DEV debug + perf globals ────────────────────────────────────────────
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __rig?: DevRig; __perf?: PerfInfo };
    w.__rig = {
      goto(id) {
        const st = useAppStore.getState();
        // DEV convenience: M6 (the real intro) isn't wired yet, so the rig
        // would otherwise sit frozen pre-intro and this hook would be inert.
        // Force the intro done so screenshots / chaos tests actually drive it.
        if (st.introPhase !== 'done') st.skipIntro();
        if (id === null) {
          if (st.panelId !== null) st.closePanel();
          else st.clearFocus();
          return;
        }
        st.openExhibit(id as ExhibitId);
      },
      state() {
        const f = flightRef.current;
        return {
          mode: modeRef.current,
          t: f ? flightProgress(f) : modeRef.current === 'focused' ? 1 : 0,
          pos: [camera.position.x, camera.position.y, camera.position.z],
        };
      },
    };
    return () => {
      const ww = window as unknown as { __rig?: DevRig; __perf?: PerfInfo };
      delete ww.__rig;
      delete ww.__perf;
    };
  }, [camera]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1); // clamp huge deltas (tab refocus)
    const st = useAppStore.getState();
    const reduced = prefersReduced || st.qualityTier === 'reduced';

    // ── Intro not done: park at seat, no input (M6 owns the real intro) ────
    if (st.introPhase !== 'done') {
      camera.position.set(SEAT[0], SEAT[1], SEAT[2]);
      currentLookRef.current[0] = BASE_LOOK[0];
      currentLookRef.current[1] = BASE_LOOK[1];
      currentLookRef.current[2] = BASE_LOOK[2];
      _lookTarget.set(BASE_LOOK[0], BASE_LOOK[1], BASE_LOOK[2]);
      camera.up.set(0, 1, 0);
      camera.lookAt(_lookTarget);
      updatePerf(dt);
      return;
    }

    const focusId = st.focusId;
    const panelId = st.panelId;

    // Capture the live pose as a flight's start (for retarget continuity).
    const beginFlight = (to: V3, toLook: V3, toFov: number) => {
      _tmpFrom[0] = camera.position.x;
      _tmpFrom[1] = camera.position.y;
      _tmpFrom[2] = camera.position.z;
      const dur = flightDuration(_tmpFrom, to);
      flightRef.current = makeFlight(
        _tmpFrom,
        currentLookRef.current,
        camera.fov,
        to,
        toLook,
        toFov,
        dur,
        reduced,
      );
      justBeganRef.current = true;
    };

    const beginFlyTo = (id: ExhibitId) => {
      const ex = EXHIBITS_BY_ID[id];
      committedRef.current = id;
      _committedPos[0] = ex.camera.pos[0];
      _committedPos[1] = ex.camera.pos[1];
      _committedPos[2] = ex.camera.pos[2];
      _committedLook[0] = ex.camera.lookAt[0];
      _committedLook[1] = ex.camera.lookAt[1];
      _committedLook[2] = ex.camera.lookAt[2];
      modeRef.current = 'flyTo';
      beginFlight(_committedPos, _committedLook, ex.camera.fov ?? SCENE_FOV);
    };

    const beginReturn = () => {
      modeRef.current = 'returnToSeat';
      beginFlight(SEAT, BASE_LOOK, SCENE_FOV);
    };

    // ── Transition table ────────────────────────────────────────────────
    switch (modeRef.current) {
      case 'idle':
        if (focusId !== null) beginFlyTo(focusId);
        break;
      case 'flyTo':
        if (focusId === null) beginReturn();
        else if (focusId !== committedRef.current) beginFlyTo(focusId);
        break;
      case 'focused':
        if (focusId === null) beginReturn();
        else if (focusId !== committedRef.current) beginFlyTo(focusId);
        else if (panelId === null) beginReturn();
        break;
      case 'returnToSeat':
        // During a return, focusId may still equal `committed` (panel-close
        // case, focus not cleared until we land) — that is NOT a retarget.
        if (focusId !== null && focusId !== committedRef.current) beginFlyTo(focusId);
        break;
    }

    // ── Advance the active flight + arrival handling ─────────────────────
    const mode = modeRef.current;
    if ((mode === 'flyTo' || mode === 'returnToSeat') && flightRef.current) {
      const f = flightRef.current;
      if (justBeganRef.current) {
        // Begin frame: snap-sample pose but don't count arrival yet, so a
        // reduced-motion instant cut still fires its callback the NEXT frame.
        justBeganRef.current = false;
      } else {
        advance(f, dt);
        if (flightArrived(f)) {
          if (mode === 'flyTo') {
            const id = committedRef.current;
            if (id !== null) useAppStore.getState().arriveAtExhibit(id);
            modeRef.current = 'focused';
          } else {
            committedRef.current = null;
            flightRef.current = null;
            useAppStore.getState().clearFocus();
            modeRef.current = 'idle';
          }
        }
      }
    }

    // ── Resolve base pose for the (possibly updated) mode ────────────────
    const finalMode = modeRef.current;
    const t = st.introPhase === 'done' ? performance.now() / 1000 : 0;

    if (finalMode === 'idle') {
      _basePos[0] = SEAT[0];
      _basePos[1] = SEAT[1] + (reduced ? 0 : Math.sin(t * BOB_FREQ) * BOB_AMP);
      _basePos[2] = SEAT[2];
      _baseLook[0] = BASE_LOOK[0];
      _baseLook[1] = BASE_LOOK[1];
      _baseLook[2] = BASE_LOOK[2];
    } else if (finalMode === 'focused') {
      _basePos[0] = _committedPos[0];
      _basePos[1] = _committedPos[1];
      _basePos[2] = _committedPos[2];
      _baseLook[0] = _committedLook[0];
      _baseLook[1] = _committedLook[1];
      _baseLook[2] = _committedLook[2];
    } else if (flightRef.current) {
      samplePos(flightRef.current, _basePos);
      sampleLook(flightRef.current, _baseLook);
    }

    // ── Influences (damped scalars) ──────────────────────────────────────
    damp(mouseInfRef.current, 'v', MOUSE_INF[finalMode], INFLUENCE_SMOOTH, dt);
    damp(driftInfRef.current, 'v', reduced ? 0 : DRIFT_INF[finalMode], INFLUENCE_SMOOTH, dt);
    const mouseInf = mouseInfRef.current.v;
    const driftInf = driftInfRef.current.v;

    // ── Mouse-look (damped toward pointer-derived target) ────────────────
    const yawRange = reduced ? MOUSE_YAW_RANGE_REDUCED : MOUSE_YAW_RANGE;
    const pitchRange = reduced ? MOUSE_PITCH_RANGE_REDUCED : MOUSE_PITCH_RANGE;
    const smooth = reduced ? MOUSE_SMOOTH_REDUCED : MOUSE_SMOOTH;
    damp(mouseAnglesRef.current, 'yaw', -pointerRef.current.x * yawRange, smooth, dt);
    damp(mouseAnglesRef.current, 'pitch', pointerRef.current.y * pitchRange, smooth, dt);

    // ── Idle drift (Lissajous), scaled by drift influence ────────────────
    const driftYaw = reduced ? 0 : Math.sin(t * DRIFT_YAW_FREQ) * DRIFT_YAW_AMP;
    const driftPitch = reduced
      ? 0
      : Math.sin(t * DRIFT_PITCH_FREQ + 1.7) * DRIFT_PITCH_AMP;

    const yaw = driftYaw * driftInf + mouseAnglesRef.current.yaw * mouseInf;
    const pitch = driftPitch * driftInf + mouseAnglesRef.current.pitch * mouseInf;

    // ── Commit position ──────────────────────────────────────────────────
    camera.position.set(_basePos[0], _basePos[1], _basePos[2]);

    // ── Compute look target: rotate (baseLook - pos) by yaw/pitch ────────
    _dir.set(
      _baseLook[0] - _basePos[0],
      _baseLook[1] - _basePos[1],
      _baseLook[2] - _basePos[2],
    );
    rotateDir(_dir, yaw, pitch);
    _lookTarget.set(_basePos[0] + _dir.x, _basePos[1] + _dir.y, _basePos[2] + _dir.z);

    currentLookRef.current[0] = _lookTarget.x;
    currentLookRef.current[1] = _lookTarget.y;
    currentLookRef.current[2] = _lookTarget.z;

    // ── FOV ease ─────────────────────────────────────────────────────────
    const targetFov =
      (finalMode === 'flyTo' || finalMode === 'returnToSeat') && flightRef.current
        ? sampleFov(flightRef.current)
        : finalMode === 'focused'
          ? EXHIBITS_BY_ID[committedRef.current ?? 'window'].camera.fov ?? SCENE_FOV
          : SCENE_FOV;
    if (reduced) {
      camera.fov = targetFov;
    } else {
      damp(camera, 'fov', targetFov, FOV_SMOOTH, dt);
    }
    camera.updateProjectionMatrix();

    // ── Look-at discipline (guard degenerate, keep +Y up, no roll) ───────
    if (_dir.lengthSq() > LOOK_DEGENERATE_EPS) {
      camera.up.set(0, 1, 0);
      camera.lookAt(_lookTarget);
    }

    updatePerf(dt);
  });

  function updatePerf(dt: number) {
    if (!import.meta.env.DEV) return;
    const acc = perfAccum.current;
    acc.frames += 1;
    acc.time += dt;
    if (acc.time >= 1) {
      const w = window as unknown as { __perf?: PerfInfo };
      w.__perf = {
        fps: acc.frames / acc.time,
        drawCalls: gl.info.render.calls,
        tris: gl.info.render.triangles,
      };
      acc.frames = 0;
      acc.time = 0;
    }
  }

  return null;
}
