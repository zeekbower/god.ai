/** Deterministic pseudo-random value in [0, 1), seeded by an arbitrary number. */
export function hashFrac(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth, bounded drift in roughly [-1, 1] — a convex sum of two sines, so it can never exceed its inputs. */
export function wander(t: number, seed: number): number {
  const f1 = 0.11 + hashFrac(seed) * 0.05;
  const f2 = 0.045 + hashFrac(seed + 1) * 0.03;
  const p1 = hashFrac(seed + 2) * Math.PI * 2;
  const p2 = hashFrac(seed + 3) * Math.PI * 2;
  return Math.sin(t * f1 + p1) * 0.6 + Math.sin(t * f2 + p2) * 0.4;
}
