import * as THREE from "three";

/**
 * Adapted from Shadertoy "fractal pyramid" (https://www.shadertoy.com/view/tsXBzS):
 * a Menger-sponge-style folding-fractal raymarch (rotate -> abs -> fold,
 * repeated) viewed from an orbiting camera. Ported from mainImage's
 * fragCoord/iTime/iResolution convention to a screen-space ShaderPass:
 * the raymarched result replaces the scene underneath it as uMix fades in.
 */
export const FractalPyramidShader = {
  name: "FractalPyramidShader",
  uniforms: {
    tDiffuse: { value: null },
    uMix: { value: 0 },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uMix;
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;

    vec3 palette(float d) {
      return mix(vec3(0.2, 0.7, 0.9), vec3(1.0, 0.0, 1.0), d);
    }

    vec2 rotate(vec2 p, float a) {
      float c = cos(a);
      float s = sin(a);
      return p * mat2(c, s, -s, c);
    }

    float map(vec3 p) {
      for (int i = 0; i < 8; i++) {
        float t = uTime * 0.2;
        p.xz = rotate(p.xz, t);
        p.xy = rotate(p.xy, t * 1.89);
        p.xz = abs(p.xz);
        p.xz -= 0.5;
      }
      return dot(sign(p), p) / 5.0;
    }

    vec4 raymarch(vec3 ro, vec3 rd) {
      float t = 0.0;
      vec3 col = vec3(0.0);
      float d = 0.0;
      for (float i = 0.0; i < 64.0; i++) {
        vec3 p = ro + rd * t;
        d = map(p) * 0.5;
        if (d < 0.02) break;
        if (d > 100.0) break;
        col += palette(length(p) * 0.1) / (400.0 * d);
        t += d;
      }
      return vec4(col, 1.0 / (d * 100.0));
    }

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001) {
        gl_FragColor = original;
        return;
      }

      vec2 fragCoord = vUv * uResolution;
      vec2 uv = (fragCoord - (uResolution * 0.5)) / uResolution.x;

      vec3 ro = vec3(0.0, 0.0, -50.0);
      ro.xz = rotate(ro.xz, uTime);
      vec3 cf = normalize(-ro);
      vec3 cs = normalize(cross(cf, vec3(0.0, 1.0, 0.0)));
      vec3 cu = normalize(cross(cf, cs));

      vec3 uuv = ro + cf * 3.0 + uv.x * cs + uv.y * cu;
      vec3 rd = normalize(uuv - ro);

      vec4 fractal = raymarch(ro, rd);

      gl_FragColor = vec4(mix(original.rgb, fractal.rgb, uMix), original.a);
    }
  `,
};
