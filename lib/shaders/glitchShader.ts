/**
 * Combines the ideas from three.js's RGBShiftShader, FilmShader (scanlines),
 * and a block-displacement "tear" (as seen in the advanced postprocessing /
 * digital-glitch examples) into one pass, all scaled by a single uMix so it
 * can be smoothly crossfaded in and out.
 */
export const GlitchShader = {
  name: "GlitchShader",
  uniforms: {
    tDiffuse: { value: null },
    uMix: { value: 0 },
    uTime: { value: 0 },
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
    varying vec2 vUv;

    float hash(float n) {
      return fract(sin(n) * 43758.5453123);
    }

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001) {
        gl_FragColor = original;
        return;
      }

      // Horizontal slice tearing: a handful of screen-height bands get a
      // random horizontal UV offset that changes a few times a second.
      float band = floor(vUv.y * 24.0);
      float bandSeed = hash(band + floor(uTime * 6.0));
      float tear = (bandSeed > 0.88) ? (hash(band * 7.1 + floor(uTime * 6.0)) - 0.5) * 0.06 : 0.0;
      vec2 uv = vec2(vUv.x + tear * uMix, vUv.y);

      // RGB shift, strength breathing over time.
      float shiftAmount = (0.004 + 0.003 * sin(uTime * 3.0)) * uMix;
      float r = texture2D(tDiffuse, uv + vec2(shiftAmount, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(shiftAmount, 0.0)).b;
      vec3 shifted = vec3(r, g, b);

      // Scanlines + subtle grain, classic CRT/film-pass feel.
      float scanline = sin(vUv.y * 800.0) * 0.04;
      float grain = (hash(vUv.x * 733.0 + vUv.y * 991.0 + uTime * 60.0) - 0.5) * 0.08;
      shifted += (scanline + grain) * uMix;

      gl_FragColor = vec4(mix(original.rgb, shifted, uMix), original.a);
    }
  `,
};
