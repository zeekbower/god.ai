"use client";

import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import Pyramid from "./Pyramid";
import Mist from "./Mist";
import StudioLight from "./StudioLight";
import Starfield from "./Starfield";
import NearbyStars from "./NearbyStars";
import ColoredLights from "./ColoredLights";
import PostProcessing from "./PostProcessing";
import CameraDirector from "./CameraDirector";
import MemoryMonitor from "./MemoryMonitor";
import EffectModeController from "./EffectModeController";
import GalaxyMode from "./GalaxyMode";

export default function Scene() {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <Canvas
      className="absolute inset-0"
      camera={{ position: [0, 1.3, 6.5], fov: 45, far: 600 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#020103"]} />
      <fog attach="fog" args={["#0a0513", 5, 17]} />

      <ambientLight intensity={0.18} color="#4a3a6b" />
      <hemisphereLight args={["#4b3b6b", "#050208", 0.3]} />
      <directionalLight position={[4, 6, 3]} intensity={0.25} color="#8a6bff" />
      <StudioLight />
      <ColoredLights />

      <Suspense fallback={null}>
        <Environment preset="studio" background={false} />
        <Starfield />
        <NearbyStars />
        <Pyramid />
        <Mist />
        <GalaxyMode />
      </Suspense>

      <PostProcessing />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom
        minDistance={6}
        maxDistance={10}
        minPolarAngle={Math.PI * 0.25}
        maxPolarAngle={Math.PI * 0.58}
        enableDamping
        dampingFactor={0.08}
        autoRotate={false}
      />
      <CameraDirector controlsRef={controlsRef} />
      <MemoryMonitor />
      <EffectModeController />
    </Canvas>
  );
}
