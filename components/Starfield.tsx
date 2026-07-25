"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { createStarfieldTexture } from "@/lib/createStarfieldTexture";

const SKY_RADIUS = 500;

/**
 * A real 3D skybox: a large sphere with the starfield texture on its inside
 * face. Because it's an actual object fixed in world space (not a flat
 * screen-space background), orbiting the camera reveals different parts of
 * it, exactly like turning your head under a real night sky.
 */
export default function Starfield() {
  const texture = useMemo(() => createStarfieldTexture(), []);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  return (
    <mesh>
      <sphereGeometry args={[SKY_RADIUS, 64, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}
