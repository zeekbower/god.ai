"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { createGalaxyGeometry } from "@/lib/createGalaxyGeometry";
import { effectModeState } from "@/lib/effectModeState";

const galaxyVertexShader = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * 36.0 / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const galaxyFragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float alpha = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, alpha * uOpacity);
  }
`;

/**
 * The webgpu_tsl_galaxy example is a particle simulation, not a screen-space
 * effect — so unlike the other modes this renders real 3D content (a spiral
 * galaxy of points) rather than a post-processing pass. Always mounted, kept
 * invisible (opacity 0) until EffectModeController selects "galaxy".
 */
export default function GalaxyMode() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => createGalaxyGeometry(), []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((state, delta) => {
    const active = effectModeState.activeMode === "galaxy";
    const opacity = active ? effectModeState.intensity : 0;

    if (materialRef.current) {
      materialRef.current.uniforms.uOpacity.value = opacity;
    }
    if (groupRef.current) {
      groupRef.current.visible = opacity > 0.001;
      groupRef.current.rotation.y += delta * 0.03;
    }
  });

  return (
    <group ref={groupRef} rotation={[0.4, 0, 0.15]} visible={false}>
      <points geometry={geometry}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={galaxyVertexShader}
          fragmentShader={galaxyFragmentShader}
          uniforms={{ uOpacity: { value: 0 } }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </points>
    </group>
  );
}
