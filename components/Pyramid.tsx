"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { createPyramidGeometry } from "@/lib/createPyramidGeometry";
import { createPcbBumpTexture } from "@/lib/createPcbBumpTexture";
import { loadQuantizedPcbTexture } from "@/lib/loadQuantizedPcbTexture";
import { getPyramidEyeCenter } from "@/lib/pyramidFaces";
import { hoverState } from "@/lib/hoverState";
import LightBeams from "./LightBeams";

const EYEBALL_RADIUS = 0.46;

export default function Pyramid() {
  const groupRef = useRef<THREE.Group>(null);
  const eyeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);

  const geometry = useMemo(() => createPyramidGeometry(3), []);
  const eyeCenter = useMemo(() => getPyramidEyeCenter(3), []);
  // Procedural texture shows instantly; swapped for the posterized photo once it loads.
  const proceduralBumpMap = useMemo(() => createPcbBumpTexture(), []);
  const [pcbBumpMap, setPcbBumpMap] = useState<THREE.Texture>(proceduralBumpMap);

  useEffect(() => {
    let cancelled = false;
    loadQuantizedPcbTexture("/pcb-source.jpg").then((texture) => {
      if (!cancelled) setPcbBumpMap(texture);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFrame((state, delta) => {
    hoverState.current = THREE.MathUtils.damp(hoverState.current, hoverState.target, 4, delta);
    const t = state.clock.elapsedTime;
    const pulse = Math.sin(t * 1.6) * 0.06;
    const glow = 1.32 + hoverState.current * 3.4 + pulse;

    if (eyeMatRef.current) {
      eyeMatRef.current.emissiveIntensity = glow;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
    if (pointLightRef.current) {
      pointLightRef.current.intensity = 2.86 + hoverState.current * 13 + pulse * 2;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[0, -0.2, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        hoverState.target = 1;
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        hoverState.target = 0;
        document.body.style.cursor = "auto";
      }}
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#3f3628"
          metalness={1}
          metalnessMap={pcbBumpMap}
          roughness={0.15}
          envMapIntensity={0.25}
          bumpMap={pcbBumpMap}
          bumpScale={0.038}
          flatShading
        />
      </mesh>

      {/* The single all-seeing eyeball, centered on the pyramid's axis, glowing out through every socket. */}
      <mesh position={eyeCenter}>
        <sphereGeometry args={[EYEBALL_RADIUS, 48, 48]} />
        <meshStandardMaterial
          ref={eyeMatRef}
          color="#2a1a08"
          metalness={0.1}
          roughness={0.3}
          emissive="#ffb347"
          emissiveIntensity={1.32}
        />
      </mesh>

      <pointLight ref={pointLightRef} position={eyeCenter} color="#ffb347" intensity={2.86} distance={7.5} decay={2} />

      <LightBeams origin={eyeCenter} />
    </group>
  );
}
