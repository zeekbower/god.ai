import * as THREE from "three";

const BLACK = 0;
const GREY = 128;
const WHITE = 255;

/** Maps 0-255 luminance to exactly one of black/grey/white — a hard 3-level posterize. */
function quantize(luminance: number): number {
  if (luminance < 85) return BLACK;
  if (luminance < 170) return GREY;
  return WHITE;
}

/**
 * Loads the user-supplied PCB photo, center-crops it to a square (so it maps
 * onto a pyramid face the same way the procedural PCB texture does), and
 * posterizes it to pure black/grey/white for use as a bump map.
 */
export function loadQuantizedPcbTexture(src: string): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - size) / 2;
      const sy = (img.naturalHeight - size) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const level = quantize(luminance);
        data[i] = level;
        data[i + 1] = level;
        data[i + 2] = level;
      }
      ctx.putImageData(imageData, 0, 0);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(3, 1); // one full tile per pyramid face
      texture.needsUpdate = true;
      resolve(texture);
    };
    img.onerror = reject;
    img.src = src;
  });
}
