import * as THREE from "three";

/**
 * Adapted from a Shadertoy fractal referencing patrickjaillet's "Sandefjord"
 * software (https://patrickjaillet.github.io/sandefjord-software): a
 * raymarched Mandelbox-style inversion fractal (dot/div/fold per inner
 * iteration) with HSV-derived glow coloring, viewed through a slowly
 * rotating camera. Ported verbatim (only iTime/iResolution renamed) to a
 * screen-space ShaderPass, crossfaded against the underlying scene via
 * uMix.
 */
export const SandefjordShader = {
  name: "SandefjordShader",
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

    void mainImage(out vec4 O, vec2 C) {
        vec2 r = uResolution.xy;
        vec2 u = (C - .5 * r) / r.y;
        O = vec4(0);
        float g = 0., i = 0., e, v, q;

        for (; i++ < 123. && g < 20.;) {
            vec3 p = vec3(u * g, g - 11.);
            float a = uTime * .1, s = sin(a), c = cos(a);
            p.xz *= mat2(c, -s, s, c);

            e = 2.;
            v = 5.1;

            for (int j = 0; j < 20; j++) {
                q = dot(p, p) + .001;
                v /= q;
                p /= q;
                p.y = 1.7 - p.y;
                if (j > 3) {
                    e = min(e, length(p.xz + length(p) / q * .55) / v - .006);
                    p.xz = abs(p.xz) - .6;
                } else {
                    p = abs(p) - .88;
                }
            }

            g += max(e, .001);

            vec3 h = vec3(.7 - log(v) * .06, .6, .6),
                 K = vec3(1, .588, .072),
                 rgb = h.z * mix(K.xxx, clamp(abs(fract(h.xxx + K) * 20. - 3.) - K.xxx, .2, 1.), h.y);

            O.rgb += rgb * .04 * exp(-e * 100.) + vec3(.5, .2, 0) * .005 / exp(p.y / v * 2.);
        }
        O = vec4(sqrt(O.rgb / (1. + O.rgb)), 1);
    }

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001) {
        gl_FragColor = original;
        return;
      }

      vec4 sandefjord;
      mainImage(sandefjord, vUv * uResolution);

      gl_FragColor = vec4(mix(original.rgb, sandefjord.rgb, uMix), original.a);
    }
  `,
};
