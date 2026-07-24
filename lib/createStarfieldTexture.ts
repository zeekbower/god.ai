import * as THREE from "three";

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Small tileable noise pattern, drawn once and repeated — far cheaper than a per-pixel pass over the full canvas. */
function createGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  const size = 256;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const tileCtx = tile.getContext("2d")!;
  const imageData = tileCtx.createImageData(size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = rand(0, 14);
    data[i] = n * 1.1;
    data[i + 1] = n * 0.95;
    data[i + 2] = n * 1.3;
    data[i + 3] = 255;
  }
  tileCtx.putImageData(imageData, 0, 0);
  return ctx.createPattern(tile, "repeat")!;
}

/**
 * An equirectangular-ish starfield: a grainy, near-black deep-space base with
 * scattered stars of varying size/brightness, plus a couple of very faint
 * nebula-like color blooms for atmosphere. Meant to be mapped onto the inside
 * of a large sphere, not used as a flat screen-space background.
 */
export function createStarfieldTexture(width = 4096, height = 2048): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#040309";
  ctx.fillRect(0, 0, width, height);

  // Fine background grain so the void doesn't read as a flat gradient (cheap: one tiled pattern fill).
  ctx.fillStyle = createGrainPattern(ctx);
  ctx.fillRect(0, 0, width, height);

  // Faint nebula blooms.
  const nebulaCount = 4;
  for (let i = 0; i < nebulaCount; i++) {
    const cx = rand(0, width);
    const cy = rand(0, height);
    const r = rand(width * 0.08, width * 0.18);
    const hue = Math.random() < 0.5 ? "88,60,160" : "50,70,140";
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${hue},0.10)`);
    grad.addColorStop(1, `rgba(${hue},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scattered stars: mostly dim pinpoints, a few brighter ones with a soft glow.
  const starCount = Math.min(2200, Math.floor(width * height * 0.00016));
  for (let i = 0; i < starCount; i++) {
    const x = rand(0, width);
    const y = rand(0, height);
    const bright = Math.random();
    const isBrightStar = bright > 0.965;
    const radius = isBrightStar ? rand(1.0, 2.0) : rand(0.3, 0.8);
    const alpha = isBrightStar ? rand(0.8, 1) : rand(0.25, 0.75);
    const tint = Math.random() < 0.5 ? "255,255,255" : "210,225,255";

    if (isBrightStar) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      glow.addColorStop(0, `rgba(${tint},${alpha * 0.5})`);
      glow.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(${tint},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
