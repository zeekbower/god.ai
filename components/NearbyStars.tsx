"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const STAR_COUNT = 33;
// Comfortably outside the pyramid + its light beams (beams reach ~16 units),
// and well inside the starfield backdrop sphere (radius 500) so these read as
// "nearby" points of light against a much more distant backdrop.
const MIN_RADIUS = 26;
const MAX_RADIUS = 75;

const COLORS = ["#ffffff", "#cfe3ff", "#ffe6b8", "#ffd2d2"];

function hashFrac(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

type StarConfig = {
  position: THREE.Vector3;
  radius: number;
  color: string;
  seed: number;
};

function randomShellPoint(min: number, max: number): THREE.Vector3 {
  const r = min + Math.random() * (max - min);
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

// Max size capped at 75% of the old max (1.4 -> 1.05), with a much lower floor
// so sizes vary far more across the field instead of clustering near one size.
function randomStarRadius(): number {
  return 0.12 + Math.random() * 0.93;
}

function randomStarColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function Star({ config }: { config: StarConfig }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (!matRef.current) return;
    const t = state.clock.elapsedTime;
    const twinkle = Math.sin(t * (0.6 + hashFrac(config.seed) * 0.5) + config.seed) * 0.5 + 0.5;
    matRef.current.emissiveIntensity = 2.2 + twinkle * 1.8;
  });

  return (
    <mesh position={config.position}>
      <sphereGeometry args={[config.radius, 16, 16]} />
      <meshStandardMaterial
        ref={matRef}
        color="#000000"
        emissive={config.color}
        emissiveIntensity={3}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/** Real 3D glowing spheres scattered around the pyramid, reading as nearby stars. */
export default function NearbyStars() {
  const stars = useMemo<StarConfig[]>(() => {
    const configs: StarConfig[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      configs.push({
        position: randomShellPoint(MIN_RADIUS, MAX_RADIUS),
        radius: randomStarRadius(),
        color: randomStarColor(),
        seed: i * 13.7 + 1,
      });
    }
    return configs;
  }, []);

  return (
    <group>
      {stars.map((config, i) => (
        <Star key={i} config={config} />
      ))}
    </group>
  );
}
