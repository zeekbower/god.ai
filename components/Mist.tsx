"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { createMistTexture } from "@/lib/createMistTexture";

function makeLayerPositions(count: number, spread: number, yBase: number, yJitter: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * spread;
    positions[i * 3 + 0] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = yBase + (Math.random() - 0.5) * yJitter;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  return positions;
}

function MistLayer({
  count,
  spread,
  yBase,
  yJitter,
  size,
  opacity,
  speed,
  texture,
}: {
  count: number;
  spread: number;
  yBase: number;
  yJitter: number;
  size: number;
  opacity: number;
  speed: number;
  texture: THREE.Texture;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => makeLayerPositions(count, spread, yBase, yJitter), [count, spread, yBase, yJitter]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * speed;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = opacity + Math.sin(state.clock.elapsedTime * 0.3) * 0.04;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={size}
        color="#7a7690"
        transparent
        opacity={opacity}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export default function Mist() {
  const texture = useMemo(() => createMistTexture(), []);

  // Shared across all layers via `map`; disposing a pointsMaterial on unmount
  // doesn't dispose the texture it references, so it's done explicitly here.
  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  return (
    <group>
      <MistLayer count={45} spread={9} yBase={-1.1} yJitter={0.6} size={4.2} opacity={0.28} speed={0.02} texture={texture} />
      <MistLayer count={35} spread={7} yBase={-0.7} yJitter={0.8} size={3.2} opacity={0.2} speed={-0.035} texture={texture} />
      <MistLayer count={25} spread={12} yBase={-1.4} yJitter={0.4} size={6} opacity={0.16} speed={0.012} texture={texture} />
    </group>
  );
}
