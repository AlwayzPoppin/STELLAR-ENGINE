import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { SceneSpatialIndex, SpatialDebugWireframe } from '../utils/SpatialPartitioning';

// Color gradient mapping for tree depth visualization
const DEPTH_COLORS = [
  '#3b82f6', // Depth 0 (Root): Blue
  '#10b981', // Depth 1: Emerald
  '#06b6d4', // Depth 2: Cyan
  '#f59e0b', // Depth 3: Amber
  '#ec4899', // Depth 4: Pink
  '#a855f7', // Depth 5+: Purple
];

function getDepthColor(depth: number): string {
  return DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
}

export function SpatialPartitioningController(): React.JSX.Element | null {
  const { scene, camera } = useThree();
  const objects = useStore((s) => s.objects);
  const selectedIds = useStore((s) => s.selectedIds);
  const spatialPartitioningEnabled = useStore((s) => s.spatialPartitioningEnabled);
  const spatialStructureType = useStore((s) => s.spatialStructureType);
  const frustumCullingEnabled = useStore((s) => s.frustumCullingEnabled);
  const showSpatialDebug = useStore((s) => s.showSpatialDebug);
  const setSpatialStats = useStore((s) => s.setSpatialStats);

  const lastStatsUpdateRef = useRef(0);
  const [wireframes, setWireframes] = React.useState<SpatialDebugWireframe[]>([]);
  const spatialIndex = useMemo(() => SceneSpatialIndex.getInstance(), []);

  // Update spatial structure type whenever toggled
  useEffect(() => {
    spatialIndex.setStructureType(spatialStructureType);
  }, [spatialIndex, spatialStructureType]);

  // Main per-frame spatial synchronization and frustum culling loop
  useFrame(() => {
    if (!spatialPartitioningEnabled) return;

    // 1. Synchronize scene graph bounds with spatial index
    spatialIndex.syncScene(scene, objects);

    // 2. Perform frustum culling if enabled
    if (frustumCullingEnabled) {
      const result = spatialIndex.performFrustumCulling(camera);

      // Guarantee that currently selected objects always remain visible
      if (selectedIds.length > 0) {
        const exportScene = scene.getObjectByName('export_scene') || scene;
        exportScene.traverse((child) => {
          if (child.userData?.id && selectedIds.includes(child.userData.id)) {
            child.visible = true;
          }
        });
      }

      // Update store stats throttled every 150ms to prevent React render spikes
      const now = performance.now();
      if (now - lastStatsUpdateRef.current > 150) {
        lastStatsUpdateRef.current = now;
        setSpatialStats({
          total: result.totalCount,
          visible: result.visibleCount,
          culled: result.culledCount,
          queryTimeMs: Math.round(result.durationMs * 100) / 100,
        });

        if (showSpatialDebug) {
          setWireframes(spatialIndex.getDebugWireframes());
        }
      }
    } else {
      // Frustum culling is disabled: ensure all scene nodes are set visible
      const exportScene = scene.getObjectByName('export_scene') || scene;
      exportScene.traverse((child) => {
        if (child.userData?.id) {
          child.visible = true;
        }
      });

      const now = performance.now();
      if (now - lastStatsUpdateRef.current > 150) {
        lastStatsUpdateRef.current = now;
        setSpatialStats({
          total: objects.length,
          visible: objects.length,
          culled: 0,
          queryTimeMs: 0,
        });

        if (showSpatialDebug) {
          setWireframes(spatialIndex.getDebugWireframes());
        }
      }
    }
  });

  if (!showSpatialDebug || wireframes.length === 0) {
    return null;
  }

  return (
    <group name="spatial_debug_overlay">
      {wireframes.map((wf, idx) => {
        const sizeX = Math.max(0.1, wf.max[0] - wf.min[0]);
        const sizeY = Math.max(0.1, wf.max[1] - wf.min[1]);
        const sizeZ = Math.max(0.1, wf.max[2] - wf.min[2]);

        const posX = wf.min[0] + sizeX * 0.5;
        const posY = wf.min[1] + sizeY * 0.5;
        const posZ = wf.min[2] + sizeZ * 0.5;

        const color = getDepthColor(wf.depth);

        return (
          <group key={`spatial_node_${idx}`} position={[posX, posY, posZ]}>
            <mesh>
              <boxGeometry args={[sizeX, sizeY, sizeZ]} />
              <meshBasicMaterial
                color={color}
                wireframe
                transparent
                opacity={wf.itemCount > 0 ? 0.45 : 0.12}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export default SpatialPartitioningController;
