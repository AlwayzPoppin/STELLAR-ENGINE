import * as THREE from 'three';

export interface ProceduralFoliagePart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  localMatrix: THREE.Matrix4;
  baseColorHex: string;
  enableWindSway: boolean;
}

export interface FoliagePresetMeta {
  id: string;
  name: string;
  category: 'vegetation' | 'nature';
  thumbnailColor: string;
  defaultScale: [number, number, number];
  windSway: boolean;
}

export const PROCEDURAL_FOLIAGE_PRESETS: FoliagePresetMeta[] = [
  {
    id: 'procedural:grass',
    name: 'Tufted Grass',
    category: 'vegetation',
    thumbnailColor: '#4ade80',
    defaultScale: [0.8, 1.0, 0.8],
    windSway: true,
  },
  {
    id: 'procedural:pine_tree',
    name: 'Pine Tree',
    category: 'vegetation',
    thumbnailColor: '#22c55e',
    defaultScale: [1.2, 1.2, 1.2],
    windSway: true,
  },
  {
    id: 'procedural:bush',
    name: 'Shrub Bush',
    category: 'vegetation',
    thumbnailColor: '#16a34a',
    defaultScale: [1.0, 1.0, 1.0],
    windSway: true,
  },
  {
    id: 'procedural:rock',
    name: 'Mossy Boulder',
    category: 'nature',
    thumbnailColor: '#94a3b8',
    defaultScale: [1.0, 1.0, 1.0],
    windSway: false,
  },
  {
    id: 'procedural:flower',
    name: 'Wildflowers',
    category: 'vegetation',
    thumbnailColor: '#facc15',
    defaultScale: [0.7, 0.9, 0.7],
    windSway: true,
  },
];

/**
 * Injects height-based wind sway into standard vertex shaders
 */
export function applyWindSwayShader(material: THREE.Material, intensity = 1.0): void {
  material.customProgramCacheKey = () => `foliage_wind_sway_${intensity.toFixed(2)}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = { value: 0 };
    shader.uniforms.uWindStrength = { value: 0.12 * intensity };
    (material as any).windUniforms = shader.uniforms;

    shader.vertexShader =
      `
      uniform float uWindTime;
      uniform float uWindStrength;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
        #include <begin_vertex>
        // Height-based sway: ground base (y <= 0.05) stays anchored, top vertices sway
        float heightFactor = max(0.0, transformed.y);
        float swayFactor = heightFactor * heightFactor;
        
        float swayX = sin(uWindTime * 2.2 + position.x * 2.0 + position.z * 1.5) * uWindStrength * swayFactor;
        float swayZ = cos(uWindTime * 1.8 + position.z * 2.0) * uWindStrength * 0.7 * swayFactor;
        
        transformed.x += swayX;
        transformed.z += swayZ;
      `
    );
  };
}

/**
 * Computes deterministic natural color variation per instance
 */
export function computeFoliageInstanceColor(
  baseColorHex: string,
  instanceId: string,
  hueVariance = 0.04,
  lightnessVariance = 0.08
): THREE.Color {
  const color = new THREE.Color(baseColorHex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);

  // Hash string into deterministic scalar [0, 1]
  let hash = 0;
  for (let i = 0; i < instanceId.length; i++) {
    hash = (hash << 5) - hash + instanceId.charCodeAt(i);
    hash |= 0;
  }
  const norm = ((hash & 0x7fffffff) % 1000) / 1000;
  const norm2 = (((hash >> 8) & 0x7fffffff) % 1000) / 1000;

  hsl.h += (norm - 0.5) * hueVariance;
  hsl.l += (norm2 - 0.5) * lightnessVariance;
  hsl.h = (hsl.h + 1.0) % 1.0;
  hsl.l = Math.max(0.15, Math.min(0.85, hsl.l));

  color.setHSL(hsl.h, hsl.s, hsl.l);
  return color;
}

/**
 * Cache for generated procedural foliage parts to avoid geometry/material recreation
 */
const proceduralPartsCache = new Map<string, ProceduralFoliagePart[]>();

/**
 * Creates multi-blade tufted grass geometry
 */
function createGrassParts(): ProceduralFoliagePart[] {
  const geom = new THREE.BufferGeometry();
  
  // 3 crossed quads with tapered top vertices for a lush tuft
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const bladeCount = 3;
  for (let b = 0; b < bladeCount; b++) {
    const angle = (b * Math.PI) / bladeCount;
    const cos = Math.cos(angle) * 0.4;
    const sin = Math.sin(angle) * 0.4;

    const baseIdx = (b * 4);

    // Quad: Bottom-left, Bottom-right, Top-right (pinched), Top-left (pinched)
    vertices.push(
      -cos, 0, -sin,
      cos, 0, sin,
      cos * 0.7, 1.2, sin * 0.7,
      -cos * 0.7, 1.2, -sin * 0.7
    );

    normals.push(
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0
    );

    uvs.push(
      0, 0,
      1, 0,
      1, 1,
      0, 1
    );

    indices.push(
      baseIdx, baseIdx + 1, baseIdx + 2,
      baseIdx, baseIdx + 2, baseIdx + 3
    );
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: '#34d399',
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  applyWindSwayShader(mat, 1.2);

  return [
    {
      geometry: geom,
      material: mat,
      localMatrix: new THREE.Matrix4(),
      baseColorHex: '#34d399',
      enableWindSway: true,
    },
  ];
}

/**
 * Creates multi-part procedural pine tree (trunk + tiered needle canopy)
 */
function createPineTreeParts(): ProceduralFoliagePart[] {
  const parts: ProceduralFoliagePart[] = [];

  // Trunk
  const trunkGeom = new THREE.CylinderGeometry(0.12, 0.18, 1.0, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: '#5c3d2e',
    roughness: 0.9,
    metalness: 0.0,
  });
  const trunkMatrix = new THREE.Matrix4().makeTranslation(0, 0.5, 0);
  parts.push({
    geometry: trunkGeom,
    material: trunkMat,
    localMatrix: trunkMatrix,
    baseColorHex: '#5c3d2e',
    enableWindSway: false,
  });

  // 3 Tiered Cones for Needle Foliage
  const tiers = [
    { bottom: 0.6, height: 1.1, radius: 0.9, color: '#1b4332' },
    { bottom: 1.2, height: 1.0, radius: 0.7, color: '#2d6a4f' },
    { bottom: 1.8, height: 0.9, radius: 0.5, color: '#40916c' },
  ];

  tiers.forEach((tier) => {
    const coneGeom = new THREE.ConeGeometry(tier.radius, tier.height, 8);
    const coneMat = new THREE.MeshStandardMaterial({
      color: tier.color,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    });
    applyWindSwayShader(coneMat, 0.7);

    const matrix = new THREE.Matrix4().makeTranslation(0, tier.bottom + tier.height / 2, 0);
    parts.push({
      geometry: coneGeom,
      material: coneMat,
      localMatrix: matrix,
      baseColorHex: tier.color,
      enableWindSway: true,
    });
  });

  return parts;
}

/**
 * Creates multi-faceted low poly rock geometry
 */
function createRockParts(): ProceduralFoliagePart[] {
  const geom = new THREE.DodecahedronGeometry(0.6, 1);

  // Deform vertices for natural rock shape
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const factor = 1.0 + (Math.sin(x * 6.0) + Math.cos(y * 7.0) + Math.sin(z * 8.0)) * 0.12;
    pos.setXYZ(i, x * factor, Math.max(0, y * factor * 0.75), z * factor);
  }
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: '#64748b',
    roughness: 0.95,
    metalness: 0.1,
    flatShading: true,
  });

  return [
    {
      geometry: geom,
      material: mat,
      localMatrix: new THREE.Matrix4(),
      baseColorHex: '#64748b',
      enableWindSway: false,
    },
  ];
}

/**
 * Creates organic shrub bush
 */
function createBushParts(): ProceduralFoliagePart[] {
  const parts: ProceduralFoliagePart[] = [];
  const clusterCount = 4;
  const positions = [
    [0, 0.45, 0, 0.55],
    [0.3, 0.35, 0.2, 0.4],
    [-0.25, 0.38, -0.15, 0.42],
    [0.1, 0.55, -0.2, 0.38],
  ];

  positions.forEach(([x, y, z, r], idx) => {
    const geom = new THREE.IcosahedronGeometry(r, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: '#15803d',
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    });
    applyWindSwayShader(mat, 0.6);

    const matrix = new THREE.Matrix4().makeTranslation(x, y, z);
    parts.push({
      geometry: geom,
      material: mat,
      localMatrix: matrix,
      baseColorHex: '#15803d',
      enableWindSway: true,
    });
  });

  return parts;
}

/**
 * Creates colorful wildflower (stem + blossom petals)
 */
function createFlowerParts(): ProceduralFoliagePart[] {
  const parts: ProceduralFoliagePart[] = [];

  // Stem
  const stemGeom = new THREE.CylinderGeometry(0.03, 0.04, 0.8, 6);
  const stemMat = new THREE.MeshStandardMaterial({
    color: '#22c55e',
    roughness: 0.7,
  });
  applyWindSwayShader(stemMat, 1.5);
  const stemMatrix = new THREE.Matrix4().makeTranslation(0, 0.4, 0);
  parts.push({
    geometry: stemGeom,
    material: stemMat,
    localMatrix: stemMatrix,
    baseColorHex: '#22c55e',
    enableWindSway: true,
  });

  // Blossom Crown
  const petalGeom = new THREE.SphereGeometry(0.18, 6, 6);
  const petalMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    roughness: 0.5,
    flatShading: true,
  });
  applyWindSwayShader(petalMat, 1.8);
  const petalMatrix = new THREE.Matrix4().makeTranslation(0, 0.85, 0);
  parts.push({
    geometry: petalGeom,
    material: petalMat,
    localMatrix: petalMatrix,
    baseColorHex: '#facc15',
    enableWindSway: true,
  });

  return parts;
}

/**
 * Retrieves or builds procedural foliage parts for a given preset ID
 */
export function getProceduralFoliageParts(presetId: string): ProceduralFoliagePart[] | null {
  if (!presetId.startsWith('procedural:')) return null;

  if (proceduralPartsCache.has(presetId)) {
    return proceduralPartsCache.get(presetId)!;
  }

  let parts: ProceduralFoliagePart[] = [];
  switch (presetId) {
    case 'procedural:grass':
      parts = createGrassParts();
      break;
    case 'procedural:pine_tree':
      parts = createPineTreeParts();
      break;
    case 'procedural:rock':
      parts = createRockParts();
      break;
    case 'procedural:bush':
      parts = createBushParts();
      break;
    case 'procedural:flower':
      parts = createFlowerParts();
      break;
    default:
      return null;
  }

  proceduralPartsCache.set(presetId, parts);
  return parts;
}
