import * as THREE from "three";

/**
 * Screen-space radial (zoom) blur centered on a point — the same idea as
 * three.js's radial-blur postprocessing example: pixels are smeared along
 * the line toward the center, with blur strength growing with distance from
 * it, giving a "zoom burst" look radiating from the eye.
 */
export const RadialBlurShader = {
  name: "RadialBlurShader",
  uniforms: {
    tDiffuse: { value: null },
    uMix: { value: 0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    #define SAMPLES 24

    uniform sampler2D tDiffuse;
    uniform float uMix;
    uniform vec2 uCenter;
    varying vec2 vUv;

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001) {
        gl_FragColor = original;
        return;
      }

      float strength = 0.35 * uMix;
      vec2 dir = vUv - uCenter;

      vec3 color = vec3(0.0);
      float total = 0.0;
      for (int i = 0; i < SAMPLES; i++) {
        float t = (float(i) / float(SAMPLES - 1)) - 0.5;
        float weight = 1.0 - abs(t) * 2.0;
        vec2 sampleUv = vUv - dir * strength * t;
        color += texture2D(tDiffuse, sampleUv).rgb * weight;
        total += weight;
      }
      color /= total;

      gl_FragColor = vec4(mix(original.rgb, color, uMix), original.a);
    }
  `,
};
