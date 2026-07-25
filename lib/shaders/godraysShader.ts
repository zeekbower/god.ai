import * as THREE from "three";

/**
 * Single-pass screen-space crepuscular rays (the same core radial-sampling
 * idea as three.js's godrays example — repeated samples marching from each
 * pixel toward the light source with decaying weight — simplified to one
 * pass instead of the full occlusion-prepass + blur-pass chain).
 */
export const GodraysShader = {
  name: "GodraysShader",
  uniforms: {
    tDiffuse: { value: null },
    uMix: { value: 0 },
    uLightUv: { value: new THREE.Vector2(0.5, 0.5) },
    uLightVisible: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    #define NUM_SAMPLES 48

    uniform sampler2D tDiffuse;
    uniform float uMix;
    uniform vec2 uLightUv;
    uniform float uLightVisible;
    varying vec2 vUv;

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001 || uLightVisible < 0.5) {
        gl_FragColor = original;
        return;
      }

      float decay = 0.965;
      float density = 0.85;
      float weight = 0.35;

      vec2 deltaUv = (vUv - uLightUv) * (density / float(NUM_SAMPLES));
      vec2 uv = vUv;
      float illumination = 1.0;
      vec3 rays = vec3(0.0);

      for (int i = 0; i < NUM_SAMPLES; i++) {
        uv -= deltaUv;
        vec3 s = texture2D(tDiffuse, uv).rgb;
        float sLum = dot(s, vec3(0.299, 0.587, 0.114));
        rays += s * sLum * illumination * weight;
        illumination *= decay;
      }
      rays /= float(NUM_SAMPLES) * 1.3;

      vec3 result = original.rgb + rays * uMix;
      gl_FragColor = vec4(result, original.a);
    }
  `,
};
