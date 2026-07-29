/**
 * Shared, continuously-accumulating rotation angle driven by the same spin
 * mechanic that spins the pyramid's own camera (see CameraDirector.tsx) — idle
 * auto-spin plus post-drag flick momentum, all in one number. Mutated directly
 * (no React state) so per-frame updates don't trigger re-renders; the 3D-raymarched
 * shader modes (auroras, fold-tunnel, fractal-pyramid, mandelbulb, mirror-cage,
 * sandefjord, sunset — the ones with a real virtual camera in their GLSL, as opposed
 * to a 2D/complex-plane effect like mandelbrot) read `angle` each frame as a `uSpin`
 * uniform and fold it into whatever rotation their shader already does on its own,
 * so a mouse drag/flick spins those scenes the same way it spins the pyramid.
 */
export const spinState = {
  angle: 0,
};
