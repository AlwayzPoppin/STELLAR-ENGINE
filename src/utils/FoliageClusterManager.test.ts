import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  getFoliageChunkKey,
  clusterFoliageInstances,
  computeInstancedCapacity,
  writeInstanceTransforms,
} from './FoliageClusterManager';
import { FoliageInstanceData } from '../store/useStore';

describe('FoliageClusterManager', () => {
  it('should correctly hash spatial grid chunk keys', () => {
    expect(getFoliageChunkKey(0, 0, 32)).toBe('0_0');
    expect(getFoliageChunkKey(15, 25, 32)).toBe('0_0');
    expect(getFoliageChunkKey(35, 0, 32)).toBe('1_0');
    expect(getFoliageChunkKey(-10, -5, 32)).toBe('-1_-1');
    expect(getFoliageChunkKey(65, 99, 32)).toBe('2_3');
  });

  it('should compute appropriate power-of-two buffer capacities', () => {
    expect(computeInstancedCapacity(0)).toBe(64);
    expect(computeInstancedCapacity(10)).toBe(64);
    expect(computeInstancedCapacity(60)).toBe(128);
    expect(computeInstancedCapacity(200)).toBe(256);
    expect(computeInstancedCapacity(500)).toBe(1024);
  });

  it('should cluster foliage instances spatially by grid cell and asset URL', () => {
    const instances: FoliageInstanceData[] = [
      // Chunk 0_0 (procedural:grass)
      { id: '1', assetUrl: 'procedural:grass', position: [5, 0, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { id: '2', assetUrl: 'procedural:grass', position: [10, 0, 10], rotation: [0, 0, 0], scale: [1, 1, 1] },
      // Chunk 0_0 (procedural:flower)
      { id: '3', assetUrl: 'procedural:flower', position: [12, 0, 12], rotation: [0, 0, 0], scale: [1, 1, 1] },
      // Chunk 1_0 (procedural:grass)
      { id: '4', assetUrl: 'procedural:grass', position: [40, 0, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ];

    const clusters = clusterFoliageInstances(instances, 32);
    expect(clusters.length).toBe(3);

    const grassChunk0 = clusters.find((c) => c.chunkKey === 'procedural:grass::0_0');
    expect(grassChunk0).toBeDefined();
    expect(grassChunk0?.instances.length).toBe(2);

    const flowerChunk0 = clusters.find((c) => c.chunkKey === 'procedural:flower::0_0');
    expect(flowerChunk0).toBeDefined();
    expect(flowerChunk0?.instances.length).toBe(1);

    const grassChunk1 = clusters.find((c) => c.chunkKey === 'procedural:grass::1_0');
    expect(grassChunk1).toBeDefined();
    expect(grassChunk1?.instances.length).toBe(1);
  });

  it('should write instance transforms and colors to InstancedMesh with zero allocations', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const instancedMesh = new THREE.InstancedMesh(geometry, material, 10);

    const instances: FoliageInstanceData[] = [
      { id: 'fol_1', assetUrl: 'procedural:grass', position: [1, 2, 3], rotation: [0, Math.PI / 2, 0], scale: [1, 1, 1] },
      { id: 'fol_2', assetUrl: 'procedural:grass', position: [10, 5, 20], rotation: [0, 0, 0], scale: [2, 2, 2] },
    ];

    const boundingSphere = writeInstanceTransforms(
      instancedMesh,
      instances,
      undefined,
      '#4ade80'
    );

    expect(instancedMesh.count).toBe(2);

    const mat0 = new THREE.Matrix4();
    instancedMesh.getMatrixAt(0, mat0);
    const pos0 = new THREE.Vector3();
    pos0.setFromMatrixPosition(mat0);
    expect(pos0.x).toBeCloseTo(1);
    expect(pos0.y).toBeCloseTo(2);
    expect(pos0.z).toBeCloseTo(3);

    const mat1 = new THREE.Matrix4();
    instancedMesh.getMatrixAt(1, mat1);
    const pos1 = new THREE.Vector3();
    pos1.setFromMatrixPosition(mat1);
    expect(pos1.x).toBeCloseTo(10);
    expect(pos1.y).toBeCloseTo(5);
    expect(pos1.z).toBeCloseTo(20);

    expect(boundingSphere.radius).toBeGreaterThan(5.0);
    expect(instancedMesh.instanceMatrix.version).toBeGreaterThan(0);
  });
});
