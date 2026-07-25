export const EFFECT_MODES = ["ascii", "glitch", "godrays", "radial-blur", "galaxy"] as const;
export type EffectModeId = (typeof EFFECT_MODES)[number];

/**
 * Shared, mutable (non-React) state describing which stylized mode is
 * currently blending in/out and by how much. Most modes are post-processing
 * passes (PostProcessing.tsx reads this every frame to drive each pass's mix
 * uniform); "galaxy" instead renders real 3D content (GalaxyMode.tsx) whose
 * opacity is driven the same way. EffectModeController writes this every
 * frame. Kept outside React state so neither side re-renders.
 */
export const effectModeState: { activeMode: EffectModeId | null; intensity: number } = {
  activeMode: null,
  intensity: 0,
};
