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
import { FractalPyramidShader } from "@/lib/shaders/fractalPyramidShader";
import { MandalaShader } from "@/lib/shaders/mandalaShader";
import { AurorasShader } from "@/lib/shaders/aurorasShader";
import { MandelbulbShader } from "@/lib/shaders/mandelbulbShader";
import { GildedPlumesShader } from "@/lib/shaders/gildedPlumesShader";
import { SunsetShader } from "@/lib/shaders/sunsetShader";
import { FoldTunnelShader } from "@/lib/shaders/foldTunnelShader";
import { SandefjordShader } from "@/lib/shaders/sandefjordShader";
import { MirrorCageShader } from "@/lib/shaders/mirrorCageShader";
import { MandelbrotShader } from "@/lib/shaders/mandelbrotShader";
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
  fractalPyramidPass: InstanceType<typeof ShaderPass>;
  mandalaPass: InstanceType<typeof ShaderPass>;
  aurorasPass: InstanceType<typeof ShaderPass>;
  mandelbulbPass: InstanceType<typeof ShaderPass>;
  gildedPlumesPass: InstanceType<typeof ShaderPass>;
  sunsetPass: InstanceType<typeof ShaderPass>;
  foldTunnelPass: InstanceType<typeof ShaderPass>;
  sandefjordPass: InstanceType<typeof ShaderPass>;
  mirrorCagePass: InstanceType<typeof ShaderPass>;
  mandelbrotPass: InstanceType<typeof ShaderPass>;
};

/**
 * Native three.js EffectComposer + UnrealBloomPass pipeline (in place of the
 * @react-three/postprocessing library) so the pyramid's glow, eye, and light
 * beams bloom using the classic Unreal-style mipmap bloom. The vignette is a
 * plain CSS overlay (see page.tsx) rather than a shader pass — three.js's
 * VignetteShader produced an inverted (bright-edged) result in this pipeline.
 *
 * On top of that, several stylized modes (ascii / glitch / godrays /
 * radial-blur / fractal-pyramid / mandala / auroras / mandelbulb /
 * gilded-plumes / sunset / fold-tunnel / sandefjord / mirror-cage /
 * mandelbrot — see EffectModeController; "galaxy" is 3D content handled by
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

    const fractalPyramid = new ShaderPass(FractalPyramidShader);
    c.addPass(fractalPyramid);

    const mandala = new ShaderPass(MandalaShader);
    c.addPass(mandala);

    const auroras = new ShaderPass(AurorasShader);
    c.addPass(auroras);

    const mandelbulb = new ShaderPass(MandelbulbShader);
    c.addPass(mandelbulb);

    const gildedPlumes = new ShaderPass(GildedPlumesShader);
    c.addPass(gildedPlumes);

    const sunset = new ShaderPass(SunsetShader);
    c.addPass(sunset);

    const foldTunnel = new ShaderPass(FoldTunnelShader);
    c.addPass(foldTunnel);

    const sandefjord = new ShaderPass(SandefjordShader);
    c.addPass(sandefjord);

    const mirrorCage = new ShaderPass(MirrorCageShader);
    c.addPass(mirrorCage);

    const mandelbrot = new ShaderPass(MandelbrotShader);
    c.addPass(mandelbrot);

    c.addPass(new OutputPass());

    return {
      composer: c,
      godraysPass: godrays,
      radialBlurPass: radialBlur,
      glitchPass: glitch,
      asciiPass: ascii,
      fractalPyramidPass: fractalPyramid,
      mandalaPass: mandala,
      aurorasPass: auroras,
      mandelbulbPass: mandelbulb,
      gildedPlumesPass: gildedPlumes,
      sunsetPass: sunset,
      foldTunnelPass: foldTunnel,
      sandefjordPass: sandefjord,
      mirrorCagePass: mirrorCage,
      mandelbrotPass: mandelbrot,
    };
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
    built.fractalPyramidPass.uniforms.uResolution.value.set(size.width, size.height);
    built.mandalaPass.uniforms.uResolution.value.set(size.width, size.height);
    built.aurorasPass.uniforms.uResolution.value.set(size.width, size.height);
    built.mandelbulbPass.uniforms.uResolution.value.set(size.width, size.height);
    built.gildedPlumesPass.uniforms.uResolution.value.set(size.width, size.height);
    built.sunsetPass.uniforms.uResolution.value.set(size.width, size.height);
    built.foldTunnelPass.uniforms.uResolution.value.set(size.width, size.height);
    built.sandefjordPass.uniforms.uResolution.value.set(size.width, size.height);
    built.mirrorCagePass.uniforms.uResolution.value.set(size.width, size.height);
    built.mandelbrotPass.uniforms.uResolution.value.set(size.width, size.height);
  }, [built, size, gl]);

  useFrame(
    (state, delta) => {
      const current = rig.current;
      if (!current) return;
      const {
        composer,
        godraysPass,
        radialBlurPass,
        glitchPass,
        asciiPass,
        fractalPyramidPass,
        mandalaPass,
        aurorasPass,
        mandelbulbPass,
        gildedPlumesPass,
        sunsetPass,
        foldTunnelPass,
        sandefjordPass,
        mirrorCagePass,
        mandelbrotPass,
      } = current;
      const { activeMode, intensity } = effectModeState;

      asciiPass.uniforms.uMix.value = activeMode === "ascii" ? intensity : 0;

      fractalPyramidPass.uniforms.uMix.value = activeMode === "fractal-pyramid" ? intensity : 0;
      fractalPyramidPass.uniforms.uTime.value = state.clock.elapsedTime;

      mandalaPass.uniforms.uMix.value = activeMode === "mandala" ? intensity : 0;
      mandalaPass.uniforms.uTime.value = state.clock.elapsedTime;

      aurorasPass.uniforms.uMix.value = activeMode === "auroras" ? intensity : 0;
      aurorasPass.uniforms.uTime.value = state.clock.elapsedTime;

      mandelbulbPass.uniforms.uMix.value = activeMode === "mandelbulb" ? intensity : 0;
      mandelbulbPass.uniforms.uTime.value = state.clock.elapsedTime;

      gildedPlumesPass.uniforms.uMix.value = activeMode === "gilded-plumes" ? intensity : 0;
      gildedPlumesPass.uniforms.uTime.value = state.clock.elapsedTime;

      sunsetPass.uniforms.uMix.value = activeMode === "sunset" ? intensity : 0;
      sunsetPass.uniforms.uTime.value = state.clock.elapsedTime;

      foldTunnelPass.uniforms.uMix.value = activeMode === "fold-tunnel" ? intensity : 0;
      foldTunnelPass.uniforms.uTime.value = state.clock.elapsedTime;

      sandefjordPass.uniforms.uMix.value = activeMode === "sandefjord" ? intensity : 0;
      sandefjordPass.uniforms.uTime.value = state.clock.elapsedTime;

      mirrorCagePass.uniforms.uMix.value = activeMode === "mirror-cage" ? intensity : 0;
      mirrorCagePass.uniforms.uTime.value = state.clock.elapsedTime;

      mandelbrotPass.uniforms.uMix.value = activeMode === "mandelbrot" ? intensity : 0;
      mandelbrotPass.uniforms.uTime.value = state.clock.elapsedTime;

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
