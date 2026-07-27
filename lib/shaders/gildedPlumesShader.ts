import * as THREE from "three";

/**
 * Adapted from Shadertoy "Gilded Plumes New" by fractalpark
 * (https://www.shadertoy.com/view/NfcGDH), a golfed hyperbolic-map fractal
 * (iterating z -> (cosh(zx)cos(zy), sinh(z)sin(zy)) + offset) with hue
 * cycling driven by escape-time and a slow 128s zoom/rotation oscillation.
 * Ported verbatim (only iTime/iResolution renamed) to a screen-space
 * ShaderPass, crossfaded against the underlying scene via uMix.
 */
export const GildedPlumesShader = {
  name: "GildedPlumesShader",
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

    void mainImage(out vec4 o, vec2 z)
    {
        float t = abs(mod(uTime/64.,2.) - 1.), s, i;

        for (z = (z+z-(o.xy=uResolution.xy))/o.y
               * mat2(cos(2.87-1.6*t + vec4(0,11,33,0))) / exp(6.13*t+.16)
               + vec2(.902302, -2.17323);
             ++i<2e2 && dot(z,z)<6e5;
             o = .5 + .5 * cos(6.3*(++s/vec4(2,2,4,1)/i + vec4(.8,.9,.3,0)))
            )
            s += sin(8.*atan(z.y, z.x)),
            z = vec2(cosh(z.x)*cos(z.y) - .043213, sinh(z)*sin(z.y) + .084741);
    }

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001) {
        gl_FragColor = original;
        return;
      }

      vec4 plumes;
      mainImage(plumes, vUv * uResolution);

      gl_FragColor = vec4(mix(original.rgb, plumes.rgb, uMix), original.a);
    }
  `,
};
