import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';

describe('Spatial Partitioning & Frustum Culling Store Integration', () => {
  beforeEach(() => {
    // Reset store values
    const state = useStore.getState();
    if (!state.spatialPartitioningEnabled) state.toggleSpatialPartitioning();
    if (!state.frustumCullingEnabled) state.toggleFrustumCulling();
    if (state.showSpatialDebug) state.toggleSpatialDebug();
    state.setSpatialStructureType('octree');
    state.setSpatialStats({ total: 0, visible: 0, culled: 0, queryTimeMs: 0 });
  });

  it('should initialize with spatial partitioning and frustum culling enabled by default', () => {
    const state = useStore.getState();
    expect(state.spatialPartitioningEnabled).toBe(true);
    expect(state.frustumCullingEnabled).toBe(true);
    expect(state.spatialStructureType).toBe('octree');
    expect(state.showSpatialDebug).toBe(false);
  });

  it('should toggle spatial partitioning and frustum culling flags', () => {
    const state = useStore.getState();

    state.toggleFrustumCulling();
    expect(useStore.getState().frustumCullingEnabled).toBe(false);

    state.toggleFrustumCulling();
    expect(useStore.getState().frustumCullingEnabled).toBe(true);

    state.toggleSpatialPartitioning();
    expect(useStore.getState().spatialPartitioningEnabled).toBe(false);

    state.toggleSpatialPartitioning();
    expect(useStore.getState().spatialPartitioningEnabled).toBe(true);
  });

  it('should switch between octree and bvh spatial structure types', () => {
    const state = useStore.getState();

    state.setSpatialStructureType('bvh');
    expect(useStore.getState().spatialStructureType).toBe('bvh');

    state.setSpatialStructureType('octree');
    expect(useStore.getState().spatialStructureType).toBe('octree');
  });

  it('should toggle 3D spatial debug wireframes', () => {
    const state = useStore.getState();

    state.toggleSpatialDebug();
    expect(useStore.getState().showSpatialDebug).toBe(true);

    state.toggleSpatialDebug();
    expect(useStore.getState().showSpatialDebug).toBe(false);
  });

  it('should update spatial performance metrics and statistics', () => {
    const state = useStore.getState();

    state.setSpatialStats({
      total: 150,
      visible: 45,
      culled: 105,
      queryTimeMs: 0.32,
    });

    const updated = useStore.getState().spatialStats;
    expect(updated.total).toBe(150);
    expect(updated.visible).toBe(45);
    expect(updated.culled).toBe(105);
    expect(updated.queryTimeMs).toBe(0.32);
  });
});
