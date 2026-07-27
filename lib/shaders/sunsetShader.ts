import * as THREE from "three";

/**
 * Adapted from Shadertoy "Sunset" by @XorDev (https://www.shadertoy.com/view/wXjSRt):
 * a raymarched turbulent cloud-band volume with sine-wave coloring and tanh
 * tonemapping. The original golfs O and its raymarch iterator/depth as
 * uninitialized floats, relying on drivers zero-initializing locals (a
 * common but technically undefined Shadertoy convention) — made explicit
 * here (`i = 0.0`, `z = 0.0`, `O = vec4(0.0)`) for portable, deterministic
 * behavior instead. Crossfaded against the underlying scene via uMix.
 */
export const SunsetShader = {
  name: "SunsetShader",
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

    void mainImage(out vec4 O, vec2 I)
    {
        float t = uTime,
        i = 0.0,
        z = 0.0,
        d,
        s;

        O = vec4(0.0);
        for(; i++<1e2; )
        {
            vec3 p = z * normalize( vec3(I+I,0) - uResolution.xyy );

            for(d=5.; d<2e2; d+=d)

                p += .6*sin(p.yzx*d - .2*t) / d;

            z += d = .005 + max(s=.3-abs(p.y), -s*.2)/4.;
            O += (cos(s/.07+p.x+.5*t-vec4(3,4,5,0)) + 1.5) * exp(s/.1) / d;
        }
        O = tanh(O*O / 4e8);
    }

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001) {
        gl_FragColor = original;
        return;
      }

      vec4 sunset;
      mainImage(sunset, vUv * uResolution);

      gl_FragColor = vec4(mix(original.rgb, sunset.rgb, uMix), original.a);
    }
  `,
};
