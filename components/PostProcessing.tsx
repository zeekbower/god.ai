"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * Native three.js EffectComposer + UnrealBloomPass pipeline (in place of the
 * @react-three/postprocessing library) so the pyramid's glow, eye, and light
 * beams bloom using the classic Unreal-style mipmap bloom. The vignette is a
 * plain CSS overlay (see page.tsx) rather than a shader pass — three.js's
 * VignetteShader produced an inverted (bright-edged) result in this pipeline.
 */
export default function PostProcessing() {
  const { gl, scene, camera, size } = useThree();

  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.35, 0.45);
    c.addPass(bloom);

    c.addPass(new OutputPass());

    return c;
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(gl.getPixelRatio());
  }, [composer, size, gl]);

  useFrame(
    (_, delta) => {
      composer.render(delta);
    },
    1
  );

  return null;
}
