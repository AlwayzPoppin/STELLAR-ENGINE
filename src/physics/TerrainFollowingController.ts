import * as THREE from 'three';
import { SceneObject, computeObjectBounds, isDescendantOf } from '../store/useStore';

// Pre-allocated scratch objects for zero-allocation per-frame terrain sampling
const _tempMatrix = new THREE.Matrix4();
const _tempInvMatrix = new THREE.Matrix4();
const _tempPos = new THREE.Vector3();
const _tempEuler = new THREE.Euler();
const _tempScale = new THREE.Vector3();
const _tempQuat = new THREE.Quaternion();
const _tempWorldPoint = new THREE.Vector3();
const _tempLocalPoint = new THREE.Vector3();
const _tempSurfaceLocalPoint = new THREE.Vector3();
const _tempSurfaceWorldPoint = new THREE.Vector3();
const _tempUp = new THREE.Vector3(0, 1, 0);
const _tempSlopeQuat = new THREE.Quaternion();

/**
 * Bilinear height interpolation on a 65x65 (64 segment) heightData array.
 */
export const getTerrainLocalHeight = (localX: number, localY: number, heightData?: number[]): number => {
  if (!heightData || heightData.length === 0) return 0;

  // Convert local coordinates ([-0.5, 0.5]) to grid coordinates (0 to 64)
  const colFloat = (localX + 0.5) * 64;
  const rowFloat = (0.5 - localY) * 64;

  // Clamp to grid boundaries
  const col = Math.max(0, Math.min(63, Math.floor(colFloat)));
  const row = Math.max(0, Math.min(63, Math.floor(rowFloat)));

  const colWeight = colFloat - col;
  const rowWeight = rowFloat - row;

  // The grid has 65 vertices per row (64 segments + 1)
  const i00 = row * 65 + col;
  const i10 = row * 65 + (col + 1);
  const i01 = (row + 1) * 65 + col;
  const i11 = (row + 1) * 65 + (col + 1);

  const h00 = heightData[i00] || 0;
  const h10 = heightData[i10] || 0;
  const h01 = heightData[i01] || 0;
  const h11 = heightData[i11] || 0;

  const hTop = h00 * (1 - colWeight) + h10 * colWeight;
  const hBottom = h01 * (1 - colWeight) + h11 * colWeight;
  return hTop * (1 - rowWeight) + hBottom * rowWeight;
};

/**
 * Fast zero-allocation evaluation of world terrain height on a specific terrain SceneObject.
 * Returns null if the (worldX, worldZ) coordinate is outside the terrain object's bounds.
 */
export const getTerrainWorldHeightAtFast = (
  worldX: number,
  worldZ: number,
  terrainObj: SceneObject
): number | null => {
  _tempPos.set(terrainObj.position[0], terrainObj.position[1], terrainObj.position[2]);
  _tempEuler.set(terrainObj.rotation[0], terrainObj.rotation[1], terrainObj.rotation[2]);
  _tempScale.set(terrainObj.scale[0], terrainObj.scale[1], terrainObj.scale[2]);
  _tempQuat.setFromEuler(_tempEuler);

  _tempMatrix.compose(_tempPos, _tempQuat, _tempScale);
  _tempInvMatrix.copy(_tempMatrix).invert();

  _tempWorldPoint.set(worldX, 0, worldZ);
  _tempLocalPoint.copy(_tempWorldPoint).applyMatrix4(_tempInvMatrix);

  // Check if inside plane boundary (width 1, height 1)
  if (_tempLocalPoint.x >= -0.5 && _tempLocalPoint.x <= 0.5 && _tempLocalPoint.y >= -0.5 && _tempLocalPoint.y <= 0.5) {
    const localH = getTerrainLocalHeight(_tempLocalPoint.x, _tempLocalPoint.y, terrainObj.heightData);
    _tempSurfaceLocalPoint.set(_tempLocalPoint.x, _tempLocalPoint.y, localH);
    _tempSurfaceWorldPoint.copy(_tempSurfaceLocalPoint).applyMatrix4(_tempMatrix);
    return _tempSurfaceWorldPoint.y;
  }

  return null;
};

/**
 * Calculates the highest terrain/ground world height at coordinates (worldX, worldZ) across all terrain objects in the scene.
 */
export const getSceneTerrainElevation = (
  worldX: number,
  worldZ: number,
  objects: SceneObject[],
  fallbackY: number = 0
): number => {
  const terrainObjects = objects.filter(
    (o) =>
      o.geometry === 'plane' &&
      (o.id === 'obj_3' || o.name === 'Ground Plane' || o.heightData) &&
      !isDescendantOf(o.id, 'asset_vault', objects)
  );

  let highestTerrain: number | null = null;
  for (const terrain of terrainObjects) {
    const h = getTerrainWorldHeightAtFast(worldX, worldZ, terrain);
    if (h !== null) {
      if (highestTerrain === null || h > highestTerrain) {
        highestTerrain = h;
      }
    }
  }

  return highestTerrain !== null ? highestTerrain : fallbackY;
};

/**
 * Calculates surface normal of terrain at (worldX, worldZ) using central finite differences.
 * @param target Optional output Vector3 for zero-allocation pooling.
 */
export const getTerrainSurfaceNormal = (
  worldX: number,
  worldZ: number,
  objects: SceneObject[],
  sampleDist: number = 0.5,
  target: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 => {
  const hL = getSceneTerrainElevation(worldX - sampleDist, worldZ, objects);
  const hR = getSceneTerrainElevation(worldX + sampleDist, worldZ, objects);
  const hD = getSceneTerrainElevation(worldX, worldZ - sampleDist, objects);
  const hU = getSceneTerrainElevation(worldX, worldZ + sampleDist, objects);

  const dz_dx = (hR - hL) / (2 * sampleDist);
  const dz_dy = (hU - hD) / (2 * sampleDist);

  return target.set(-dz_dx, 1.0, -dz_dy).normalize();
};

/**
 * Downward raycast against Rapier physics world to sample physical collider terrain height.
 */
export const samplePhysicsTerrainRaycast = (
  world: any,
  rapier: any,
  worldX: number,
  currentY: number,
  worldZ: number,
  filterHandle?: number,
  rayOriginOffset: number = 10.0,
  maxRayDist: number = 60.0
): number | null => {
  if (!world || !rapier || typeof world.castRay !== 'function') return null;

  try {
    const origin = { x: worldX, y: currentY + rayOriginOffset, z: worldZ };
    const dir = { x: 0, y: -1, z: 0 };
    const ray = new rapier.Ray(origin, dir);

    const hit = world.castRay(
      ray,
      maxRayDist,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (collider: any) => {
        if (!filterHandle) return true;
        const parent = collider.parent ? collider.parent() : null;
        return !parent || parent.handle !== filterHandle;
      }
    );

    if (hit !== null && typeof hit.timeOfImpact === 'number') {
      return origin.y - hit.timeOfImpact;
    }
  } catch {
    // Fallback if physics world is transitioning
  }

  return null;
};

/**
 * Calculates the exact target Y elevation for an entity so that its bottom bound touches the terrain surface.
 */
export const calculateEntityTerrainTargetY = (
  entity: SceneObject,
  worldX: number,
  worldZ: number,
  objects: SceneObject[],
  customOffset: number = 0,
  physicsWorld?: any,
  rapier?: any,
  filterHandle?: number
): number => {
  // 1. Check physics raycast if available
  let surfaceY: number | null = null;
  if (physicsWorld && rapier) {
    surfaceY = samplePhysicsTerrainRaycast(
      physicsWorld,
      rapier,
      worldX,
      entity.position[1],
      worldZ,
      filterHandle
    );
  }

  // 2. Fall back to mathematical heightmap elevation
  if (surfaceY === null) {
    surfaceY = getSceneTerrainElevation(worldX, worldZ, objects, 0);
  }

  // 3. Compute bottom bound offset
  const bounds = computeObjectBounds(entity);
  const bottomBound = bounds.minY; // Distance from center position to bottom of mesh

  return surfaceY + bottomBound + customOffset;
};

export interface TerrainFollowingOptions {
  lerpSpeed?: number;
  customOffset?: number;
  alignToSlopeNormal?: boolean;
  physicsWorld?: any;
  rapier?: any;
  filterHandle?: number;
}

/**
 * High-level per-frame updater for an entity moving across sculpted terrain.
 * Smoothly interpolates Y elevation and optionally aligns pitch/roll with hill slopes.
 */
export const updateEntityTerrainFollowing = (
  currentX: number,
  currentY: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  entity: SceneObject,
  objects: SceneObject[],
  delta: number,
  options: TerrainFollowingOptions = {}
): {
  position: [number, number, number];
  quaternion?: THREE.Quaternion;
} => {
  const lerpSpeed = options.lerpSpeed ?? entity.terrainLerpSpeed ?? 10.0;
  const customOffset = options.customOffset ?? entity.terrainOffset ?? 0.0;

  const targetSurfaceY = calculateEntityTerrainTargetY(
    entity,
    targetX,
    targetZ,
    objects,
    customOffset,
    options.physicsWorld,
    options.rapier,
    options.filterHandle
  );

  // Smooth lerp towards terrain target Y
  const t = Math.min(1.0, delta * lerpSpeed);
  const newY = THREE.MathUtils.lerp(currentY, targetSurfaceY, t);

  const result: { position: [number, number, number]; quaternion?: THREE.Quaternion } = {
    position: [targetX, newY, targetZ],
  };

  // Optional slope normal alignment
  if (options.alignToSlopeNormal ?? entity.terrainAlignNormal) {
    const normal = getTerrainSurfaceNormal(targetX, targetZ, objects, 0.5, _tempUp);
    _tempSlopeQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    result.quaternion = _tempSlopeQuat.clone();
  }

  return result;
};
