// WebAudio "field office" blips — ported 1:1 from legacy/Agent Office
// Ship.dc.html's `beep(f1, f2)` method (~lines 511-526): a short sine
// tone that glides from f1 to f2 over 150ms, under a gain envelope that
// decays from 0.07 to ~0 over 180ms, and is stopped at 200ms.
//
// Legacy only ever calls beep() from three places, each with a fixed
// frequency pair:
//   beep(620, 880)  <- open(id)            i.e. every exhibit-panel open
//                                              (found or brand new alike)
//   beep(500, 340)  <- close()             i.e. exhibit-panel close
//   beep(700, 900)  <- dismissBriefing()   i.e. the FIELD BRIEFING
//                                              "UNDERSTOOD" click
//
// Note: legacy has NO separate "you just found something new" chime —
// opening an already-found exhibit sounds identical to opening one for
// the first time. playConfirm() below is legacy's dismissBriefing()
// blip, exposed under the generic name this module's callers want
// ("a positive/confirm register") rather than inventing a new sound
// legacy never had. See src/audio/wireAudio.ts for exactly which store
// transition fires each of these.
//
// AudioContext is created lazily, on the first call to any play*
// function below — never at module import time — mirroring legacy's
// `this._ctx || (this._ctx = new Ctx())`. Browsers require a user
// gesture before audio can start; every call site here is already
// reached from a click or a store change caused by one, so this holds.

import { useAppStore } from '../state/store';

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctx: AudioContextCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    return ctx;
  } catch {
    return null;
  }
}

// Legacy `beep(f1, f2)`, verbatim envelope/timing:
//   oscillator: sine, frequency f1 -> f2 (exponential ramp, 150ms)
//   gain: 0.07 -> 0.0001 (exponential ramp, 180ms)
//   stop at 200ms
function beep(f1: number, f2: number): void {
  if (useAppStore.getState().muted) return;
  try {
    const audioCtx = getContext();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f1, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f2, audioCtx.currentTime + 0.15);
    g.gain.setValueAtTime(0.07, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.2);
  } catch {
    // WebAudio unavailable/blocked (e.g. autoplay policy, private mode) —
    // the sound simply doesn't play. Legacy swallows the same errors.
  }
}

/** Exhibit panel opened. Legacy: `beep(620, 880)` inside `open(id)`. */
export function playOpen(): void {
  beep(620, 880);
}

/** Exhibit panel closed. Legacy: `beep(500, 340)` inside `close()`. */
export function playClose(): void {
  beep(500, 340);
}

/**
 * Positive/confirm register. Legacy: `beep(700, 900)`, fired only from
 * `dismissBriefing()` (the FIELD BRIEFING card's "UNDERSTOOD" button).
 */
export function playConfirm(): void {
  beep(700, 900);
}
