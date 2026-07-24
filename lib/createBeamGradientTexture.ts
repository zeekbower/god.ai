import * as THREE from "three";

/**
 * Vertical alpha gradient (opaque at v=0, transparent at v=1) used as an alphaMap
 * so a plain cylinder/cone reads as a soft light beam instead of a hard-edged shape.
 */
export function createBeamGradientTexture(): THREE.CanvasTexture {
  const width = 8;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, height, 0, 0);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
