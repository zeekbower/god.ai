"use client";

import { useMemo } from "react";
import * as THREE from "three";

const LIGHT_COUNT = 10;
const BASE_INTENSITY = 0.5;
const INTENSITY_MULTIPLIER = 3; // "3 times" the low-power baseline
const ABOVE_PROBABILITY = 0.75;

// Hue bands (0-1) for blue, green, red, purple, pink.
const HUE_RANGES: [number, number][] = [
  [0.58, 0.66],
  [0.28, 0.38],
  [0.97, 1.0],
  [0.74, 0.8],
  [0.86, 0.94],
];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomLightColor(): THREE.Color {
  const [h0, h1] = HUE_RANGES[Math.floor(Math.random() * HUE_RANGES.length)];
  return new THREE.Color().setHSL(rand(h0, h1), rand(0.55, 0.85), rand(0.45, 0.65));
}

function randomLightPosition(): THREE.Vector3 {
  const above = Math.random() < ABOVE_PROBABILITY;
  const y = above ? rand(1.5, 9) : rand(-6, 1.5);
  const horizontalRadius = rand(4, 12);
  const theta = Math.random() * Math.PI * 2;
  return new THREE.Vector3(Math.cos(theta) * horizontalRadius, y, Math.sin(theta) * horizontalRadius);
}

function randomLightIntensity(): number {
  return BASE_INTENSITY * INTENSITY_MULTIPLIER * rand(0.7, 1.3);
}

function randomLightDistance(): number {
  return rand(12, 20);
}

type LightConfig = {
  position: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  distance: number;
};

/**
 * Scattered ambient color washes — point lights only, no visible fixture —
 * mostly floating above the pyramid, at low intensity so they tint the mist
 * and metal without overpowering the pyramid's own glow.
 */
export default function ColoredLights() {
  const lights = useMemo<LightConfig[]>(
    () =>
      Array.from({ length: LIGHT_COUNT }, () => ({
        position: randomLightPosition(),
        color: randomLightColor(),
        intensity: randomLightIntensity(),
        distance: randomLightDistance(),
      })),
    []
  );

  return (
    <>
      {lights.map((light, i) => (
        <pointLight
          key={i}
          position={light.position}
          color={light.color}
          intensity={light.intensity}
          distance={light.distance}
          decay={2}
        />
      ))}
    </>
  );
}
