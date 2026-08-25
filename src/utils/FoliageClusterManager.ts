/**
 * FoliageClusterManager.ts — Spatial Clustering & InstancedMesh Batching for Foliage
 * 
 * Provides spatial grid chunking, zero-allocation matrix buffer writing,
 * per-cluster bounding sphere calculation for frustum culling, and instance pooling.
 */

import * as THREE from 'three';
import { FoliageInstanceData } from '../store/useStore';
import { computeFoliageInstanceColor } from './FoliageGeometryLibrary';

export const FOLIAGE_CHUNK_SIZE = 32;

export interface FoliageClusterChunk {
  chunkKey: string;
  assetUrl: string;
  instances: FoliageInstanceData[];
  boundingSphere?: THREE.Sphere;
}

/**
 * Computes spatial grid key for a given 2D world position (X, Z).
 */
export function getFoliageChunkKey(x: number, z: number, chunkSize = FOLIAGE_CHUNK_SIZE): string {
  const cx = Math.floor(x / chunkSize);
  const cz = Math.floor(z / chunkSize);
  return `${cx}_${cz}`;
}

/**
 * Clusters foliage instances into spatial grid cells grouped by asset type.
 */
export function clusterFoliageInstances(
  instances: FoliageInstanceData[],
  chunkSize = FOLIAGE_CHUNK_SIZE
): FoliageClusterChunk[] {
  const map = new Map<string, FoliageClusterChunk>();

  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const chunkCoord = getFoliageChunkKey(inst.position[0], inst.position[2], chunkSize);
    const groupKey = `${inst.assetUrl}::${chunkCoord}`;

    let cluster = map.get(groupKey);
    if (!cluster) {
      cluster = {
        chunkKey: groupKey,
        assetUrl: inst.assetUrl,
        instances: [],
      };
      map.set(groupKey, cluster);
    }
    cluster.instances.push(inst);
  }

  return Array.from(map.values());
}

// ─── Zero-Allocation Math Objects ────────────────────────────────

const _instPos = new THREE.Vector3();
const _instQuat = new THREE.Quaternion();
const _instEuler = new THREE.Euler();
const _instScale = new THREE.Vector3();
const _instanceMat = new THREE.Matrix4();
const _finalMat = new THREE.Matrix4();
const _box = new THREE.Box3();

/**
 * High-performance zero-allocation batch matrix and color buffer writer for THREE.InstancedMesh.
 */
export function writeInstanceTransforms(
  instancedMesh: THREE.InstancedMesh,
  instances: FoliageInstanceData[],
  localMatrix?: THREE.Matrix4,
  baseColorHex?: string
): THREE.Sphere {
  const count = instances.length;
  instancedMesh.count = count;
  _box.makeEmpty();

  for (let i = 0; i < count; i++) {
    const inst = instances[i];
    _instPos.set(inst.position[0], inst.position[1], inst.position[2]);
    _instEuler.set(inst.rotation[0], inst.rotation[1], inst.rotation[2]);
    _instQuat.setFromEuler(_instEuler);
    _instScale.set(inst.scale[0], inst.scale[1], inst.scale[2]);

    _instanceMat.compose(_instPos, _instQuat, _instScale);

    if (localMatrix) {
      _finalMat.multiplyMatrices(_instanceMat, localMatrix);
      instancedMesh.setMatrixAt(i, _finalMat);
    } else {
      instancedMesh.setMatrixAt(i, _instanceMat);
    }

    if (baseColorHex) {
      const col = computeFoliageInstanceColor(baseColorHex, inst.id);
      instancedMesh.setColorAt(i, col);
    }

    _box.expandByPoint(_instPos);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  if (instancedMesh.instanceColor) {
    instancedMesh.instanceColor.needsUpdate = true;
  }

  const sphere = new THREE.Sphere();
  if (count > 0 && !_box.isEmpty()) {
    _box.getBoundingSphere(sphere);
    sphere.radius += 5.0; // bounding sphere padding for geometry mesh height
  }
  return sphere;
}

/**
 * Calculates optimal instanced mesh buffer capacity (power of two with headroom).
 */
export function computeInstancedCapacity(instanceCount: number): number {
  if (instanceCount <= 0) return 64;
  return Math.max(64, Math.pow(2, Math.ceil(Math.log2(Math.max(1, instanceCount * 1.25)))));
}
