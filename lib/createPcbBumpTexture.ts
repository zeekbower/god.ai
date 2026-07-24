import * as THREE from "three";

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Procedural grayscale bump map resembling a circuit board: traces, chips with
 * pins, and small discrete components. Only luminance matters here (it's a
 * bump map, not a color map), so everything is drawn in shades of gray.
 */
export function createPcbBumpTexture(size = 1024): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(70,70,70)";
  ctx.fillRect(0, 0, size, size);

  // Copper traces: orthogonal random-walk lines with a via/pad at each end.
  const traceCount = 46;
  for (let i = 0; i < traceCount; i++) {
    let x = rand(0, size);
    let y = rand(0, size);
    const steps = Math.floor(rand(4, 10));
    const width = rand(2, 5);
    const shade = Math.floor(rand(170, 225));

    ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
    ctx.lineWidth = width;
    ctx.lineCap = "square";
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < steps; s++) {
      const horizontal = Math.random() < 0.5;
      const len = rand(size * 0.03, size * 0.18) * (Math.random() < 0.5 ? 1 : -1);
      x = THREE.MathUtils.clamp(horizontal ? x + len : x, 0, size);
      y = THREE.MathUtils.clamp(!horizontal ? y + len : y, 0, size);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = `rgb(${Math.min(255, shade + 25)},${Math.min(255, shade + 25)},${Math.min(255, shade + 25)})`;
    ctx.beginPath();
    ctx.arc(x, y, width * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chips: rectangular IC bodies with a row of pins along the top and bottom.
  const chipCount = 5;
  for (let i = 0; i < chipCount; i++) {
    const w = rand(size * 0.08, size * 0.18);
    const h = rand(size * 0.06, size * 0.14);
    const x = rand(size * 0.1, size * 0.9 - w);
    const y = rand(size * 0.1, size * 0.9 - h);
    const bodyShade = Math.floor(rand(40, 60));

    ctx.fillStyle = `rgb(${bodyShade},${bodyShade},${bodyShade})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgb(150,150,150)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const pinCount = Math.floor(rand(4, 8));
    ctx.fillStyle = "rgb(210,210,210)";
    for (let p = 0; p < pinCount; p++) {
      const px = x + (p + 0.5) * (w / pinCount);
      ctx.fillRect(px - 1.5, y - 6, 3, 6);
      ctx.fillRect(px - 1.5, y + h, 3, 6);
    }
  }

  // Small discrete components: resistors (rectangles) and capacitors (rings).
  const compCount = 20;
  for (let i = 0; i < compCount; i++) {
    const cx = rand(size * 0.05, size * 0.95);
    const cy = rand(size * 0.05, size * 0.95);
    if (Math.random() < 0.5) {
      const w = rand(size * 0.02, size * 0.045);
      const h = w * 0.4;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.random() < 0.5 ? 0 : Math.PI / 2);
      ctx.fillStyle = "rgb(195,195,195)";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      const r = rand(size * 0.012, size * 0.025);
      ctx.fillStyle = "rgb(150,150,150)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgb(210,210,210)";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(3, 1); // one full PCB tile per pyramid face
  texture.needsUpdate = true;
  return texture;
}
