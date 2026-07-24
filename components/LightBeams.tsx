"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { createBeamGradientTexture } from "@/lib/createBeamGradientTexture";
import { getPyramidFaces, getTangentBasis } from "@/lib/pyramidFaces";
import { hoverState } from "@/lib/hoverState";

const UP = new THREE.Vector3(0, 1, 0);

const RAYS_PER_FACE = 9;
const FAN_RADIUS = 0.22; // radians, max spread of the ray fan around each face's normal
const MAX_WANDER = 0.05; // radians, how far a ray's direction may drift from its home angle

const BEAM_LENGTH = 16;
const NEAR_RADIUS = 0.055;
const FAR_RADIUS = 0.22;
const OPACITY_MIN = 0.04;
const OPACITY_MAX = 0.1;

/** Deterministic pseudo-random value in [0, 1), seeded by an arbitrary number. */
function hashFrac(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth, bounded drift in roughly [-1, 1] — a convex sum of two sines, so it can never exceed its inputs. */
function wander(t: number, seed: number): number {
  const f1 = 0.11 + hashFrac(seed) * 0.05;
  const f2 = 0.045 + hashFrac(seed + 1) * 0.03;
  const p1 = hashFrac(seed + 2) * Math.PI * 2;
  const p2 = hashFrac(seed + 3) * Math.PI * 2;
  return Math.sin(t * f1 + p1) * 0.6 + Math.sin(t * f2 + p2) * 0.4;
}

type RayConfig = {
  normal: THREE.Vector3;
  xAxis: THREE.Vector3;
  yAxis: THREE.Vector3;
  homeAngleX: number;
  homeAngleY: number;
  baseOpacity: number;
  seed: number;
};

function Beam({ config, texture }: { config: RayConfig; texture: THREE.Texture }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const { normal, xAxis, yAxis, homeAngleX, homeAngleY, baseOpacity, seed } = config;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const angleX = homeAngleX + wander(t, seed) * MAX_WANDER;
    const angleY = homeAngleY + wander(t, seed + 50) * MAX_WANDER;

    const q = new THREE.Quaternion()
      .setFromAxisAngle(xAxis, angleX)
      .multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, angleY));
    const direction = normal.clone().applyQuaternion(q).normalize();

    if (meshRef.current) {
      meshRef.current.position.copy(direction).multiplyScalar(BEAM_LENGTH / 2);
      meshRef.current.quaternion.setFromUnitVectors(UP, direction);
    }
    if (matRef.current) {
      const pulse = Math.sin(t * 1.6 + seed) * 0.015;
      matRef.current.opacity = baseOpacity + hoverState.current * 0.175 + pulse;
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* radiusTop (local +Y, the far end) is wider than radiusBottom (local -Y, at the origin) */}
      <cylinderGeometry args={[FAR_RADIUS, NEAR_RADIUS, BEAM_LENGTH, 20, 1, true]} />
      <meshBasicMaterial
        ref={matRef}
        color="#ffcf8a"
        alphaMap={texture}
        transparent
        opacity={baseOpacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function LightBeams({ origin }: { origin: THREE.Vector3 }) {
  const texture = useMemo(() => createBeamGradientTexture(), []);

  const configs = useMemo(() => {
    const rays: RayConfig[] = [];
    getPyramidFaces(3).forEach(({ normal }, faceIndex) => {
      const { xAxis, yAxis } = getTangentBasis(normal);
      for (let k = 0; k < RAYS_PER_FACE; k++) {
        const globalSeed = faceIndex * 1000 + k * 17;
        let homeAngleX = 0;
        let homeAngleY = 0;
        if (k > 0) {
          const angle = ((k - 1) / (RAYS_PER_FACE - 1)) * Math.PI * 2;
          const radius = FAN_RADIUS * (0.65 + 0.35 * hashFrac(globalSeed + 3));
          homeAngleX = Math.cos(angle) * radius;
          homeAngleY = Math.sin(angle) * radius;
        }
        const baseOpacity = OPACITY_MIN + (OPACITY_MAX - OPACITY_MIN) * hashFrac(globalSeed + 9);

        rays.push({ normal, xAxis, yAxis, homeAngleX, homeAngleY, baseOpacity, seed: globalSeed });
      }
    });
    return rays;
  }, []);

  return (
    <group position={origin}>
      {configs.map((config, i) => (
        <Beam key={i} config={config} texture={texture} />
      ))}
    </group>
  );
}
