import * as THREE from "three";

// Density ramp, dimmest to brightest — same idea as the classic ASCII-art convention.
const CHARSET = " .:-=+*#%@";
const CELL_PX = 32; // atlas cell size (rendered at 2x the on-screen block size for crisp minification)

/** Builds a horizontal strip texture with one glyph per cell, white-on-transparent. */
export function createAsciiCharsetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CELL_PX * CHARSET.length;
  canvas.height = CELL_PX;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.floor(CELL_PX * 0.85)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < CHARSET.length; i++) {
    ctx.fillText(CHARSET[i], i * CELL_PX + CELL_PX / 2, CELL_PX / 2 + 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export const AsciiShader = {
  name: "AsciiShader",
  uniforms: {
    tDiffuse: { value: null },
    tCharset: { value: null },
    uMix: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uBlockSize: { value: 10.0 },
    uCharCount: { value: CHARSET.length },
    uColor: { value: new THREE.Color("#ffb347") },
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
    uniform sampler2D tCharset;
    uniform float uMix;
    uniform vec2 uResolution;
    uniform float uBlockSize;
    uniform float uCharCount;
    uniform vec3 uColor;
    varying vec2 vUv;

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001) {
        gl_FragColor = original;
        return;
      }

      vec2 pixel = vUv * uResolution;
      vec2 blockOrigin = floor(pixel / uBlockSize) * uBlockSize;
      vec2 blockCenterUv = (blockOrigin + uBlockSize * 0.5) / uResolution;
      vec3 blockColor = texture2D(tDiffuse, blockCenterUv).rgb;
      float luminance = dot(blockColor, vec3(0.299, 0.587, 0.114));

      float charIndex = floor(luminance * (uCharCount - 1.0) + 0.5);
      vec2 localUv = fract(pixel / uBlockSize);
      vec2 atlasUv = vec2((charIndex + localUv.x) / uCharCount, localUv.y);
      float glyphAlpha = texture2D(tCharset, atlasUv).a;

      vec3 asciiColor = uColor * glyphAlpha * (0.35 + luminance * 0.9);
      gl_FragColor = vec4(mix(original.rgb, asciiColor, uMix), original.a);
    }
  `,
};
