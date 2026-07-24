"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A studio key light that stays glued just behind the camera (as the camera
 * orbits) so the pyramid is always front-lit like a product shot, regardless
 * of viewing angle. The light's default target (0,0,0) sits right at the
 * pyramid, so no per-frame target updates are needed.
 */
export default function StudioLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!lightRef.current) return;
    lightRef.current.position.copy(camera.position);
  });

  return <directionalLight ref={lightRef} intensity={1.3} color="#fff5e6" />;
}
