/**
 * Shared 0..1 hover-glow value for the pyramid. Mutated directly (no React state)
 * so pointer events don't trigger re-renders; consumers damp toward `target`
 * inside their own useFrame loops.
 */
export const hoverState = {
  current: 0,
  target: 0,
};
