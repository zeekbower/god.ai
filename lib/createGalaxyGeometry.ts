import * as THREE from "three";

const PARTICLE_COUNT = 8000;
// Kept modest relative to the camera's 6-10 unit orbit distance so the spiral
// shape reads clearly instead of the camera sitting deep inside a dense field.
const RADIUS = 22;
const BRANCHES = 4;
const SPIN = 1.0;
const RANDOMNESS = 0.35;
const RANDOMNESS_POWER = 3;

const INSIDE_COLOR = new THREE.Color("#ffd79a");
const OUTSIDE_COLOR = new THREE.Color("#5a6fff");

/**
 * Builds the classic procedural spiral-galaxy point cloud: particles spread
 * along a few rotating branches from the center outward, with a random
 * scatter (biased toward small offsets) so the arms read as fuzzy rather
 * than razor-thin, and a color gradient from a warm core to a cool rim.
 */
export function createGalaxyGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const radius = Math.random() * RADIUS;

    const branchAngle = ((i % BRANCHES) / BRANCHES) * Math.PI * 2;
    const spinAngle = radius * SPIN;

    const randomSign = () => (Math.random() < 0.5 ? 1 : -1);
    const randomX = Math.pow(Math.random(), RANDOMNESS_POWER) * randomSign() * RANDOMNESS * radius;
    const randomY = Math.pow(Math.random(), RANDOMNESS_POWER) * randomSign() * RANDOMNESS * radius * 0.6;
    const randomZ = Math.pow(Math.random(), RANDOMNESS_POWER) * randomSign() * RANDOMNESS * radius;

    positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
    positions[i3 + 1] = randomY;
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

    const mixedColor = INSIDE_COLOR.clone().lerp(OUTSIDE_COLOR, radius / RADIUS);
    colors[i3] = mixedColor.r;
    colors[i3 + 1] = mixedColor.g;
    colors[i3 + 2] = mixedColor.b;

    sizes[i] = radius < RADIUS * 0.15 ? 1.6 : 0.7 + Math.random() * 0.6;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}
