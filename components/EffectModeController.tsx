"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EFFECT_MODES, effectModeState, type EffectModeId } from "@/lib/effectModeState";

type DebugWindow = Window & {
  __forceEffectMode?: { mode: EffectModeId; intensity: number } | null;
};

const IDLE_MIN_S = 2;
const IDLE_MAX_S = 2;
const FADE_MIN_S = 10;
const FADE_MAX_S = 40;

type Phase = "idle" | "fade-in" | "fade-out";

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickMode(): EffectModeId {
  return EFFECT_MODES[Math.floor(Math.random() * EFFECT_MODES.length)];
}

/** Ease in/out rather than a linear ramp, so the transitions feel less mechanical. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Cycles the scene between its normal look and a randomly chosen stylized
 * post-processing mode: idle at normal for 2s, fade into a random mode
 * over 10-40s, then fade back out to normal over another 10-40s, and repeat.
 * Writes only to the shared effectModeState — no React re-renders.
 */
export default function EffectModeController() {
  const phase = useRef<Phase>("idle");
  const phaseElapsed = useRef(0);
  const phaseDuration = useRef(rand(IDLE_MIN_S, IDLE_MAX_S));

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      (window as DebugWindow).__forceEffectMode = null;
    }
  }, []);

  useFrame((_, delta) => {
    // Dev-only escape hatch: `window.__forceEffectMode = { mode: 'ascii', intensity: 1 }`
    // in the console to preview a mode instantly instead of waiting out the real cycle.
    if (process.env.NODE_ENV === "development") {
      const forced = (window as DebugWindow).__forceEffectMode;
      if (forced) {
        effectModeState.activeMode = forced.mode;
        effectModeState.intensity = forced.intensity;
        return;
      }
    }

    phaseElapsed.current += delta;
    const t = Math.min(phaseElapsed.current / phaseDuration.current, 1);

    if (phase.current === "idle") {
      effectModeState.intensity = 0;
      if (t >= 1) {
        effectModeState.activeMode = pickMode();
        phase.current = "fade-in";
        phaseElapsed.current = 0;
        phaseDuration.current = rand(FADE_MIN_S, FADE_MAX_S);
      }
      return;
    }

    if (phase.current === "fade-in") {
      effectModeState.intensity = smoothstep(t);
      if (t >= 1) {
        phase.current = "fade-out";
        phaseElapsed.current = 0;
        phaseDuration.current = rand(FADE_MIN_S, FADE_MAX_S);
      }
      return;
    }

    // fade-out
    effectModeState.intensity = 1 - smoothstep(t);
    if (t >= 1) {
      effectModeState.activeMode = null;
      effectModeState.intensity = 0;
      phase.current = "idle";
      phaseElapsed.current = 0;
      phaseDuration.current = rand(IDLE_MIN_S, IDLE_MAX_S);
    }
  });

  return null;
}
