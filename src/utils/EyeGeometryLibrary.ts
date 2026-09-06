import * as THREE from 'three';

export interface EyeTextureOptions {
  irisColor?: string;
  pupilSize?: number; // 0.1 to 0.8
  scleraColor?: string;
  limbalRingColor?: string;
  limbalRingThickness?: number;
  veinIntensity?: number; // 0.0 to 1.0
  resolution?: number; // default 512
}

export const IRIS_COLOR_PRESETS: Array<{ name: string; color: string; hex: string }> = [
  { name: 'Ocean Blue', color: '#2563eb', hex: '#2563eb' },
  { name: 'Deep Azure', color: '#0284c7', hex: '#0284c7' },
  { name: 'Warm Hazel', color: '#854d0e', hex: '#854d0e' },
  { name: 'Dark Brown', color: '#451a03', hex: '#451a03' },
  { name: 'Emerald Green', color: '#16a34a', hex: '#16a34a' },
  { name: 'Golden Amber', color: '#d97706', hex: '#d97706' },
  { name: 'Amethyst Violet', color: '#7c3aed', hex: '#7c3aed' },
  { name: 'Cyber Glow', color: '#06b6d4', hex: '#06b6d4' },
  { name: 'Crimson', color: '#dc2626', hex: '#dc2626' },
  { name: 'Steel Gray', color: '#64748b', hex: '#64748b' },
];

/**
 * Procedurally generates a high-detail PBR eye diffuse/albedo texture on a dynamic HTML5 canvas.
 */
export function generateProceduralEyeCanvas(options: EyeTextureOptions = {}): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  const {
    irisColor = '#2563eb',
    pupilSize = 0.35,
    scleraColor = '#f5f5f7',
    limbalRingColor = '#0f172a',
    limbalRingThickness = 0.05,
    veinIntensity = 0.3,
    resolution = 512,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = resolution / 2;
  const cy = resolution / 2;
  const outerRadius = resolution / 2;

  // 1. Sclera background (Off-white with subtle spherical shading and red tint at edges)
  const scleraGrad = ctx.createRadialGradient(cx, cy, outerRadius * 0.3, cx, cy, outerRadius);
  scleraGrad.addColorStop(0, scleraColor);
  scleraGrad.addColorStop(0.85, '#e8e8ed');
  scleraGrad.addColorStop(1.0, '#ddb8b8'); // soft peripheral capillary tint
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(0, 0, resolution, resolution);

  // 2. Micro-veins on sclera
  if (veinIntensity > 0.01) {
    ctx.save();
    ctx.strokeStyle = `rgba(180, 50, 50, ${0.15 * veinIntensity})`;
    ctx.lineWidth = 1.0;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.sin(i * 123) * 0.1;
      const startR = outerRadius * 0.65;
      const endR = outerRadius * 0.98;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * startR, cy + Math.sin(angle) * startR);
      const midAngle = angle + (Math.sin(i * 37) * 0.1);
      ctx.quadraticCurveTo(
        cx + Math.cos(midAngle) * (startR + endR) * 0.5,
        cy + Math.sin(midAngle) * (startR + endR) * 0.5,
        cx + Math.cos(angle + 0.05) * endR,
        cy + Math.sin(angle + 0.05) * endR
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Iris Outer Ring (Limbal Ring)
  const irisRadius = outerRadius * 0.52;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, irisRadius, 0, Math.PI * 2);
  ctx.fillStyle = limbalRingColor;
  ctx.fill();

  // 4. Iris Base & Stroma Radial Fibers
  const irisInnerRadius = irisRadius * (1.0 - limbalRingThickness);
  const irisGrad = ctx.createRadialGradient(cx, cy, irisRadius * pupilSize, cx, cy, irisInnerRadius);
  
  // Parse iris color to lighten/darken for multi-tone fibers
  const parsedColor = new THREE.Color(irisColor);
  const brightColor = parsedColor.clone().offsetHSL(0.02, 0.1, 0.15).getStyle();
  const darkColor = parsedColor.clone().offsetHSL(-0.02, -0.05, -0.2).getStyle();
  const highlightColor = parsedColor.clone().offsetHSL(0.05, 0.2, 0.3).getStyle();

  irisGrad.addColorStop(0, darkColor);
  irisGrad.addColorStop(0.35, brightColor);
  irisGrad.addColorStop(0.7, irisColor);
  irisGrad.addColorStop(1.0, darkColor);

  ctx.beginPath();
  ctx.arc(cx, cy, irisInnerRadius, 0, Math.PI * 2);
  ctx.fillStyle = irisGrad;
  ctx.fill();

  // Draw radial iris fibers (collagen strands)
  const fiberCount = 120;
  for (let i = 0; i < fiberCount; i++) {
    const angle = (i / fiberCount) * Math.PI * 2;
    const fiberR1 = irisRadius * pupilSize * 0.95;
    const fiberR2 = irisInnerRadius * (0.85 + Math.sin(i * 17) * 0.15);
    
    ctx.strokeStyle = (i % 3 === 0) ? highlightColor : (i % 2 === 0) ? brightColor : darkColor;
    ctx.globalAlpha = 0.25 + Math.abs(Math.sin(i * 7.5)) * 0.45;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * fiberR1, cy + Math.sin(angle) * fiberR1);
    ctx.lineTo(cx + Math.cos(angle) * fiberR2, cy + Math.sin(angle) * fiberR2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // 5. Collarette Ring (Inner contraction furrows)
  ctx.beginPath();
  ctx.arc(cx, cy, irisRadius * (pupilSize + 0.18), 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 255, 255, 0.25)`;
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // 6. Pupil (Deep black with soft edge)
  const pupilRadius = irisRadius * Math.max(0.15, Math.min(0.85, pupilSize));
  const pupilGrad = ctx.createRadialGradient(cx, cy, pupilRadius * 0.7, cx, cy, pupilRadius);
  pupilGrad.addColorStop(0, '#000000');
  pupilGrad.addColorStop(0.92, '#050505');
  pupilGrad.addColorStop(1.0, 'rgba(10, 10, 10, 0.4)');

  ctx.beginPath();
  ctx.arc(cx, cy, pupilRadius, 0, Math.PI * 2);
  ctx.fillStyle = pupilGrad;
  ctx.fill();

  ctx.restore();
  return canvas;
}

/**
 * Creates a Three.js CanvasTexture for the 3D Eyeball.
 */
export function createEyeCanvasTexture(options: EyeTextureOptions = {}): THREE.CanvasTexture | THREE.DataTexture {
  const canvas = generateProceduralEyeCanvas(options);
  if (!canvas) {
    const data = new Uint8Array([37, 99, 235, 255]);
    const dt = new THREE.DataTexture(data, 1, 1);
    dt.needsUpdate = true;
    return dt;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a 3D Eyeball geometry with front-facing (+Z) UV mapping for procedural eye textures.
 * Radius is normalized to 0.5 (1.0 diameter), with the iris perfectly centered on the +Z pole.
 */
export function createEyeballGeometry(radius: number = 0.5, segments: number = 32): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(radius, segments, segments);
  const posAttr = geom.attributes.position;
  const uvAttr = geom.attributes.uv;
  const count = posAttr.count;

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    if (z >= -0.01) {
      // Front hemisphere facing forward (+Z in Three.js coordinate system):
      // Center of iris (0.5, 0.5) is at (0, 0, +radius)
      // Positive X is Right (u > 0.5), Negative X is Left (u < 0.5)
      // Positive Y is Up (v > 0.5), Negative Y is Down (v < 0.5)
      const u = 0.5 + (x / (2.0 * radius));
      const v = 0.5 + (y / (2.0 * radius));
      uvAttr.setXY(i, Math.min(0.98, Math.max(0.02, u)), Math.min(0.98, Math.max(0.02, v)));
    } else {
      // Back hemisphere: mapped smoothly into outer sclera margin ring
      const angle = Math.atan2(y, x);
      const outerR = 0.48;
      const u = 0.5 + Math.cos(angle) * outerR;
      const v = 0.5 + Math.sin(angle) * outerR;
      uvAttr.setXY(i, Math.min(0.99, Math.max(0.01, u)), Math.min(0.99, Math.max(0.01, v)));
    }
  }

  uvAttr.needsUpdate = true;
  return geom;
}
