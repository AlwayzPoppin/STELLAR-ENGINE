import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  getTerrainLocalHeight,
  getTerrainWorldHeightAtFast,
  getSceneTerrainElevation,
  getTerrainSurfaceNormal,
  calculateEntityTerrainTargetY,
  updateEntityTerrainFollowing,
} from './TerrainFollowingController';
import { SceneObject, useStore } from '../store/useStore';
import { executeRobloxLuaScript } from '../utils/robloxLuaEngine';

describe('TerrainFollowingController', () => {
  it('should accurately compute bilinear height data using getTerrainLocalHeight', () => {
    const heightData = new Array(4225).fill(0); // 65 * 65 grid
    // Corner (0, 0)
    heightData[0] = 10.0;
    // Center vertex (32, 32)
    heightData[32 * 65 + 32] = 25.0;

    // Center point in local space is (0, 0)
    expect(getTerrainLocalHeight(0, 0, heightData)).toBeCloseTo(25.0, 2);

    // Top-left corner local space (-0.5, 0.5) corresponds to row 0, col 0
    expect(getTerrainLocalHeight(-0.5, 0.5, heightData)).toBeCloseTo(10.0, 2);

    // Empty or undefined heightData returns 0
    expect(getTerrainLocalHeight(0, 0, undefined)).toBe(0);
  });

  it('should compute world terrain height with fast zero-allocation transformations', () => {
    const heightData = new Array(4225).fill(0);
    heightData[32 * 65 + 32] = 4.0;

    const terrain: SceneObject = {
      id: 'sculpted_ground',
      name: 'Ground Plane',
      type: 'mesh',
      geometry: 'plane',
      position: [10, 2, -10],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [20, 20, 1],
      heightData,
    };

    // Center of terrain in world space is (10, -10). Terrain base elevation is 2 + 4 = 6.
    const heightAtCenter = getTerrainWorldHeightAtFast(10, -10, terrain);
    expect(heightAtCenter).toBeCloseTo(6.0, 2);

    // Out of bounds coordinate returns null
    const heightOutside = getTerrainWorldHeightAtFast(50, 50, terrain);
    expect(heightOutside).toBeNull();
  });

  it('should find the highest elevation across multiple overlapping terrain planes', () => {
    const terrainLow: SceneObject = {
      id: 'ground_base',
      name: 'Ground Plane',
      type: 'mesh',
      geometry: 'plane',
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [100, 100, 1],
    };

    const heightDataHill = new Array(4225).fill(0);
    heightDataHill[32 * 65 + 32] = 8.0;

    const terrainHill: SceneObject = {
      id: 'ground_hill',
      name: 'Hill Area',
      type: 'mesh',
      geometry: 'plane',
      position: [0, 2, 0],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [20, 20, 1],
      heightData: heightDataHill,
    };

    const sceneObjects = [terrainLow, terrainHill];

    // At (0, 0): hill height is 2 + 8 = 10, base is 0 -> should return 10
    const highestElev = getSceneTerrainElevation(0, 0, sceneObjects);
    expect(highestElev).toBeCloseTo(10.0, 2);

    // At (40, 0): outside hill (20x20), inside base (100x100) -> should return 0
    const baseElev = getSceneTerrainElevation(40, 0, sceneObjects);
    expect(baseElev).toBeCloseTo(0.0, 2);

    // Outside all terrain -> fallback to default
    const fallbackElev = getSceneTerrainElevation(200, 200, sceneObjects, -5);
    expect(fallbackElev).toBe(-5);
  });

  it('should calculate terrain surface normal vectors correctly', () => {
    // Flat ground normal should be (0, 1, 0)
    const flatGround: SceneObject = {
      id: 'obj_3',
      name: 'Ground Plane',
      type: 'mesh',
      geometry: 'plane',
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [100, 100, 1],
    };

    const normal = getTerrainSurfaceNormal(0, 0, [flatGround]);
    expect(normal.x).toBeCloseTo(0, 2);
    expect(normal.y).toBeCloseTo(1, 2);
    expect(normal.z).toBeCloseTo(0, 2);
  });

  it('should compute exact bottom-bound terrain contact for diverse entity geometries', () => {
    const flatGround: SceneObject = {
      id: 'obj_3',
      name: 'Ground Plane',
      type: 'mesh',
      geometry: 'plane',
      position: [0, 5, 0],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [100, 100, 1],
    };

    // Box entity with height 4 (scale Y = 4). Center to bottom is 2.
    const boxNpc: SceneObject = {
      id: 'box_npc',
      name: 'Box NPC',
      type: 'mesh',
      geometry: 'box',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [2, 4, 2],
    };

    const boxTargetY = calculateEntityTerrainTargetY(boxNpc, 0, 0, [flatGround], 0);
    // Terrain height = 5. Bottom distance = 2. Target center Y = 5 + 2 = 7.
    expect(boxTargetY).toBeCloseTo(7.0, 2);

    // Sphere entity with radius 1.5 (scale = [3, 3, 3]). Center to bottom is 1.5.
    const sphereNpc: SceneObject = {
      id: 'sphere_npc',
      name: 'Sphere NPC',
      type: 'mesh',
      geometry: 'sphere',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [3, 3, 3],
    };

    const sphereTargetY = calculateEntityTerrainTargetY(sphereNpc, 0, 0, [flatGround], 0.5);
    // Terrain height = 5. Bottom distance = 1.5. Custom offset = 0.5. Total = 7.0.
    expect(sphereTargetY).toBeCloseTo(7.0, 2);
  });

  it('should smoothly update entity position and align slope rotation during pathing', () => {
    const flatGround: SceneObject = {
      id: 'obj_3',
      name: 'Ground Plane',
      type: 'mesh',
      geometry: 'plane',
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [100, 100, 1],
    };

    const npc: SceneObject = {
      id: 'patrol_npc',
      name: 'Patrol NPC',
      type: 'mesh',
      geometry: 'box',
      position: [0, 10, 0],
      rotation: [0, 0, 0],
      scale: [1, 2, 1], // Bottom bound = 1
      terrainFollowing: true,
      terrainAlignNormal: true,
      terrainLerpSpeed: 10.0,
    };

    // Frame 1 with delta = 0.05
    const step1 = updateEntityTerrainFollowing(
      0, 10, 0,
      5, 5,
      npc,
      [flatGround],
      0.05
    );

    // Target Y is terrain (0) + bottom (1) = 1. Current is 10. Lerp moves it downward towards 1.
    expect(step1.position[0]).toBe(5);
    expect(step1.position[2]).toBe(5);
    expect(step1.position[1]).toBeLessThan(10);
    expect(step1.position[1]).toBeGreaterThan(1);
    expect(step1.quaternion).toBeInstanceOf(THREE.Quaternion);
  });

  it('should support Engine.GetTerrainHeight and Engine.SnapToTerrain in Lua scripts', () => {
    useStore.getState().startNewScene();

    const ground: SceneObject = {
      id: 'ground_plane',
      name: 'Ground Plane',
      type: 'mesh',
      geometry: 'plane',
      position: [0, 3, 0],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [100, 100, 1],
    };
    useStore.getState().addObject(ground);

    const npcBox: SceneObject = {
      id: 'npc_mob',
      name: 'Goblin',
      type: 'mesh',
      geometry: 'box',
      position: [0, 20, 0],
      rotation: [0, 0, 0],
      scale: [1, 2, 1], // Bottom bound = 1
    };
    useStore.getState().addObject(npcBox);

    const script = `
      local terrainY = Engine.GetTerrainHeight(0, 0)
      local snappedY = Engine.SnapToTerrain("Goblin", 0.5)
    `;

    const res = executeRobloxLuaScript(script);
    expect(res.success).toBe(true);

    const updatedGoblin = useStore.getState().objects.find((o) => o.id === 'npc_mob');
    // Ground Y=3 + Bottom=1 + Offset=0.5 = 4.5
    expect(updatedGoblin?.position[1]).toBeCloseTo(4.5, 2);
  });
});
