"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

const BASE_VERTICAL_FOV = 45; // the original fixed fov, tuned at a 16:9 aspect
const BASE_ASPECT = 16 / 9;
const MIN_FOV = 35; // floor for ultra-wide screens, keeps the pyramid from feeling tiny/flat
const MAX_FOV = 100; // ceiling for narrow portrait phones, keeps it from fisheye-ing

function horizontalFovDeg(verticalFovDeg: number, aspect: number): number {
  const vFov = THREE.MathUtils.degToRad(verticalFovDeg);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  return THREE.MathUtils.radToDeg(hFov);
}

function verticalFovDeg(horizontalFovDeg: number, aspect: number): number {
  const hFov = THREE.MathUtils.degToRad(horizontalFovDeg);
  const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect);
  return THREE.MathUtils.radToDeg(vFov);
}

const TARGET_HORIZONTAL_FOV = horizontalFovDeg(BASE_VERTICAL_FOV, BASE_ASPECT);

/**
 * three.js's PerspectiveCamera.fov is a *vertical* fov, so holding it fixed
 * crops the pyramid horizontally on narrow/portrait viewports. This instead
 * holds the horizontal fov constant (derived once from the original 45deg
 * @ 16:9 framing) and re-derives the vertical fov from the live canvas
 * aspect ratio every frame, so the pyramid keeps the same on-screen width
 * regardless of window size or shape, including on live resize.
 */
export default function ResponsiveCamera() {
  const { camera, size } = useThree();
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const lastFov = useRef<number | null>(null);

  useEffect(() => {
    cameraRef.current = camera as THREE.PerspectiveCamera;
  }, [camera]);

  useFrame(() => {
    const cam = cameraRef.current;
    if (!cam) return;

    const aspect = size.width / size.height;
    const fov = THREE.MathUtils.clamp(
      verticalFovDeg(TARGET_HORIZONTAL_FOV, aspect),
      MIN_FOV,
      MAX_FOV
    );

    if (lastFov.current === fov) return;
    lastFov.current = fov;

    cam.fov = fov;
    cam.updateProjectionMatrix();
  });

  return null;
}
