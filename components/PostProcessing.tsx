"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { AsciiShader, createAsciiCharsetTexture } from "@/lib/shaders/asciiShader";
import { GlitchShader } from "@/lib/shaders/glitchShader";
import { GodraysShader } from "@/lib/shaders/godraysShader";
import { RadialBlurShader } from "@/lib/shaders/radialBlurShader";
import { effectModeState } from "@/lib/effectModeState";
import { getPyramidEyeCenter, PYRAMID_GROUP_OFFSET_Y } from "@/lib/pyramidFaces";

const eyeCenterLocal = getPyramidEyeCenter(3);
const eyeWorldPos = new THREE.Vector3(eyeCenterLocal.x, eyeCenterLocal.y + PYRAMID_GROUP_OFFSET_Y, eyeCenterLocal.z);

type Rig = {
  composer: InstanceType<typeof EffectComposer>;
  godraysPass: InstanceType<typeof ShaderPass>;
  radialBlurPass: InstanceType<typeof ShaderPass>;
  glitchPass: InstanceType<typeof ShaderPass>;
  asciiPass: InstanceType<typeof ShaderPass>;
};

/**
 * Native three.js EffectComposer + UnrealBloomPass pipeline (in place of the
 * @react-three/postprocessing library) so the pyramid's glow, eye, and light
 * beams bloom using the classic Unreal-style mipmap bloom. The vignette is a
 * plain CSS overlay (see page.tsx) rather than a shader pass — three.js's
 * VignetteShader produced an inverted (bright-edged) result in this pipeline.
 *
 * On top of that, several stylized modes (ascii / glitch / godrays /
 * radial-blur — see EffectModeController; "galaxy" is 3D content handled by
 * GalaxyMode instead) sit in the chain as always-present passes whose uMix
 * uniform is driven from 0 by default, so they're an invisible no-op until
 * the controller fades one in.
 */
export default function PostProcessing() {
  const { gl, scene, camera, size } = useThree();

  const built = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.35, 0.45);
    c.addPass(bloom);

    const godrays = new ShaderPass(GodraysShader);
    c.addPass(godrays);

    const radialBlur = new ShaderPass(RadialBlurShader);
    c.addPass(radialBlur);

    const glitch = new ShaderPass(GlitchShader);
    c.addPass(glitch);

    const ascii = new ShaderPass(AsciiShader);
    ascii.uniforms.tCharset.value = createAsciiCharsetTexture();
    c.addPass(ascii);

    c.addPass(new OutputPass());

    return { composer: c, godraysPass: godrays, radialBlurPass: radialBlur, glitchPass: glitch, asciiPass: ascii };
  }, [gl, scene, camera]);

  // Refs are the escape hatch for mutating things outside React's render
  // cycle — assigned here (in an effect, not during render) and read/written
  // freely inside useFrame below.
  const rig = useRef<Rig | null>(null);
  useEffect(() => {
    rig.current = built;
  }, [built]);

  useEffect(() => {
    built.composer.setSize(size.width, size.height);
    built.composer.setPixelRatio(gl.getPixelRatio());
    built.asciiPass.uniforms.uResolution.value.set(size.width, size.height);
  }, [built, size, gl]);

  useFrame(
    (state, delta) => {
      const current = rig.current;
      if (!current) return;
      const { composer, godraysPass, radialBlurPass, glitchPass, asciiPass } = current;
      const { activeMode, intensity } = effectModeState;

      asciiPass.uniforms.uMix.value = activeMode === "ascii" ? intensity : 0;

      glitchPass.uniforms.uMix.value = activeMode === "glitch" ? intensity : 0;
      glitchPass.uniforms.uTime.value = state.clock.elapsedTime;

      const godraysMix = activeMode === "godrays" ? intensity : 0;
      godraysPass.uniforms.uMix.value = godraysMix;

      const radialBlurMix = activeMode === "radial-blur" ? intensity : 0;
      radialBlurPass.uniforms.uMix.value = radialBlurMix;

      if (godraysMix > 0 || radialBlurMix > 0) {
        const ndc = eyeWorldPos.clone().project(camera);
        const uv = new THREE.Vector2(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
        godraysPass.uniforms.uLightUv.value.copy(uv);
        godraysPass.uniforms.uLightVisible.value = ndc.z < 1 ? 1 : 0;
        radialBlurPass.uniforms.uCenter.value.copy(uv);
      }

      composer.render(delta);
    },
    1
  );

  return null;
}
