import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { useStore, getTerrainWorldHeightAt, computeObjectBounds, getWorldPositionOfObject, loadedAnimationsRegistry } from './useStore';

describe('useStore', () => {
  it('should have initial state', () => {
    const state = useStore.getState();
    expect(state.objects.length).toBeGreaterThan(0);
    expect(state.transformMode).toBe('translate');
  });

  it('should add an object', () => {
    const state = useStore.getState();
    const newObj = {
      id: 'test_obj',
      name: 'Test Object',
      type: 'mesh' as const,
      geometry: 'box' as const,
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    };
    state.addObject(newObj);
    
    const updatedState = useStore.getState();
    expect(updatedState.objects.find(o => o.id === 'test_obj')).toBeTruthy();
  });

  it('should delete an object', () => {
    const state = useStore.getState();
    state.deleteObject('test_obj');
    
    const updatedState = useStore.getState();
    expect(updatedState.objects.find(o => o.id === 'test_obj')).toBeUndefined();
  });

  it('should regenerate sceneId on clearScene, startNewScene, and loadProject', () => {
    const state = useStore.getState();
    const initialSceneId = state.sceneId;
    expect(initialSceneId).toBeDefined();

    // 1. clearScene
    state.clearScene();
    const stateAfterClear = useStore.getState();
    expect(stateAfterClear.sceneId).not.toBe(initialSceneId);
    expect(stateAfterClear.objects.length).toBe(0);

    // 2. startNewScene
    stateAfterClear.startNewScene();
    const stateAfterNew = useStore.getState();
    expect(stateAfterNew.sceneId).not.toBe(stateAfterClear.sceneId);
    expect(stateAfterNew.objects.length).toBeGreaterThan(0);

    // 3. loadProject
    const projectData = JSON.stringify({
      objects: [{ id: 'loaded_cube', name: 'Loaded Cube', type: 'mesh', geometry: 'box', position: [0,0,0], rotation: [0,0,0], scale: [1,1,1] }],
      environment: stateAfterNew.environment
    });
    stateAfterNew.loadProject(projectData);
    const stateAfterLoad = useStore.getState();
    expect(stateAfterLoad.sceneId).not.toBe(stateAfterNew.sceneId);
    expect(stateAfterLoad.objects.length).toBe(1);
    expect(stateAfterLoad.objects[0].id).toBe('loaded_cube');
  });

  it('should deeply clone objects and increment sceneVersion on undo and redo', () => {
    const state = useStore.getState();
    const initialVersion = state.sceneVersion;
    
    // Add an object to create a history entry
    const testObj = {
      id: 'history_test_obj',
      name: 'History Object',
      type: 'mesh' as const,
      geometry: 'box' as const,
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    };
    state.addObject(testObj);
    
    const stateAfterAdd = useStore.getState();
    expect(stateAfterAdd.objects.find(o => o.id === 'history_test_obj')).toBeTruthy();
    
    // Undo
    stateAfterAdd.undo();
    
    const stateAfterUndo = useStore.getState();
    expect(stateAfterUndo.sceneVersion).toBe(initialVersion + 1);
    expect(stateAfterUndo.objects.find(o => o.id === 'history_test_obj')).toBeUndefined();
    
    // Redo
    stateAfterUndo.redo();
    
    const stateAfterRedo = useStore.getState();
    expect(stateAfterRedo.sceneVersion).toBe(initialVersion + 2);
    expect(stateAfterRedo.objects.find(o => o.id === 'history_test_obj')).toBeTruthy();
  });

  it('should clear temporal history on clearScene and startNewScene', () => {
    const state = useStore.getState();
    
    // Add an object to populate pastStates
    const testObj = {
      id: 'history_clear_obj',
      name: 'History Clear Object',
      type: 'mesh' as const,
      geometry: 'box' as const,
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    };
    state.addObject(testObj);
    
    expect((useStore as any).temporal.getState().pastStates.length).toBeGreaterThan(0);
    
    // Clear scene
    state.clearScene();
    expect((useStore as any).temporal.getState().pastStates.length).toBe(0);
    expect((useStore as any).temporal.getState().futureStates.length).toBe(0);
        // Add again and start new scene
    const state2 = useStore.getState();
    state2.addObject(testObj);
    expect((useStore as any).temporal.getState().pastStates.length).toBeGreaterThan(0);
    
    state2.startNewScene();
    expect((useStore as any).temporal.getState().pastStates.length).toBe(0);
    expect((useStore as any).temporal.getState().futureStates.length).toBe(0);
  });

  it('should recursively delete all child objects when parent folder/model is deleted', () => {
    const state = useStore.getState();
    const parentId = 'test_group_model';
    state.addObject({
      id: parentId,
      name: 'TestModel',
      type: 'group',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    state.addObject({
      id: 'child_part_1',
      name: 'Part_1',
      type: 'mesh',
      geometry: 'box',
      position: [0, 1, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      parentId: parentId,
    });

    state.addObject({
      id: 'child_part_2',
      name: 'Part_2',
      type: 'mesh',
      geometry: 'box',
      position: [0, 2, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      parentId: parentId,
    });

    expect(useStore.getState().objects.some((o) => o.id === parentId)).toBe(true);
    expect(useStore.getState().objects.some((o) => o.id === 'child_part_1')).toBe(true);
    expect(useStore.getState().objects.some((o) => o.id === 'child_part_2')).toBe(true);

    // Delete parent model folder
    useStore.getState().deleteObject(parentId);

    // Verify parent and ALL children are completely deleted!
    expect(useStore.getState().objects.some((o) => o.id === parentId)).toBe(false);
    expect(useStore.getState().objects.some((o) => o.id === 'child_part_1')).toBe(false);
    expect(useStore.getState().objects.some((o) => o.id === 'child_part_2')).toBe(false);
  });

  // ===== Multi-scene tests =====

  it('should have an initial scene in the scenes map', () => {
    // Reset to a known state
    useStore.getState().startNewScene();
    const state = useStore.getState();
    const sceneIds = Object.keys(state.scenes);
    expect(sceneIds.length).toBeGreaterThanOrEqual(1);
    expect(state.scenes[state.activeSceneId]).toBeDefined();
    expect(state.scenes[state.activeSceneId].objects).toEqual(state.objects);
  });

  it('should create a new scene and switch to it', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();
    const oldActiveId = state.activeSceneId;
    const oldSceneCount = Object.keys(state.scenes).length;

    state.createNewScene('Level 2');

    const updated = useStore.getState();
    expect(Object.keys(updated.scenes).length).toBe(oldSceneCount + 1);
    expect(updated.activeSceneId).not.toBe(oldActiveId);
    expect(updated.scenes[updated.activeSceneId].name).toBe('Level 2');
    expect(updated.objects).toEqual(updated.scenes[updated.activeSceneId].objects);
  });

  it('should switch between scenes and isolate objects', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();
    const sceneAId = state.activeSceneId;

    // Add a unique object to Scene A
    state.addObject({
      id: 'scene_a_obj',
      name: 'Scene A Object',
      type: 'mesh',
      geometry: 'box',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    // Create Scene B
    useStore.getState().createNewScene('Scene B');
    const sceneBState = useStore.getState();
    const sceneBId = sceneBState.activeSceneId;

    // Scene B should NOT have scene_a_obj
    expect(sceneBState.objects.find(o => o.id === 'scene_a_obj')).toBeUndefined();

    // Switch back to Scene A
    useStore.getState().switchScene(sceneAId);
    const backToA = useStore.getState();
    expect(backToA.activeSceneId).toBe(sceneAId);
    expect(backToA.objects.find(o => o.id === 'scene_a_obj')).toBeTruthy();
  });

  it('should delete a scene and switch to another', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();
    state.createNewScene('Temp Scene');

    const stateWithTwo = useStore.getState();
    const tempSceneId = stateWithTwo.activeSceneId;
    const otherSceneId = Object.keys(stateWithTwo.scenes).find(id => id !== tempSceneId)!;

    stateWithTwo.deleteScene(tempSceneId);

    const afterDelete = useStore.getState();
    expect(afterDelete.scenes[tempSceneId]).toBeUndefined();
    expect(afterDelete.activeSceneId).toBe(otherSceneId);
  });

  it('should not delete the last remaining scene', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();
    const onlySceneId = state.activeSceneId;
    expect(Object.keys(state.scenes).length).toBe(1);

    state.deleteScene(onlySceneId);

    const after = useStore.getState();
    expect(Object.keys(after.scenes).length).toBe(1);
    expect(after.activeSceneId).toBe(onlySceneId);
  });

  it('should rename a scene', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();
    const sceneId = state.activeSceneId;

    state.renameScene(sceneId, 'Main Level');
    const updated = useStore.getState();
    expect(updated.scenes[sceneId].name).toBe('Main Level');
  });

  it('should keep objects synced between flat property and scenes map on mutations', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();

    state.addObject({
      id: 'sync_test',
      name: 'Sync Test',
      type: 'mesh',
      geometry: 'sphere',
      position: [1, 2, 3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    const after = useStore.getState();
    // Both flat objects and scenes map should have it
    expect(after.objects.find(o => o.id === 'sync_test')).toBeTruthy();
    expect(after.scenes[after.activeSceneId].objects.find(o => o.id === 'sync_test')).toBeTruthy();
    // They should be the same reference
    expect(after.objects).toEqual(after.scenes[after.activeSceneId].objects);
  });

  it('should load legacy project format (objects + environment)', () => {
    const state = useStore.getState();
    const legacyProject = JSON.stringify({
      objects: [{ id: 'legacy_obj', name: 'Legacy', type: 'mesh', geometry: 'box', position: [0,0,0], rotation: [0,0,0], scale: [1,1,1] }],
      environment: state.environment,
    });
    state.loadProject(legacyProject);

    const loaded = useStore.getState();
    expect(loaded.objects.length).toBe(1);
    expect(loaded.objects[0].id).toBe('legacy_obj');
    expect(Object.keys(loaded.scenes).length).toBe(1);
    expect(loaded.scenes[loaded.activeSceneId].objects[0].id).toBe('legacy_obj');
  });

  it('should save and load new project format (scenes)', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();
    state.createNewScene('Second');

    // Manually build expected save data
    const saveState = useStore.getState();
    const saveData = JSON.stringify({
      scenes: saveState.scenes,
      activeSceneId: saveState.activeSceneId,
      environment: saveState.environment,
    });    // Load it back
    useStore.getState().startNewScene();
    useStore.getState().loadProject(saveData);

    const loaded = useStore.getState();
    expect(Object.keys(loaded.scenes).length).toBe(2);
  });

  it('should NOT push to history when selecting an object', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();
    
    // Add an object
    state.addObject({
      id: 'test_select_id',
      name: 'Select Test',
      type: 'mesh',
      geometry: 'box',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    const temporal = (useStore as any).temporal.getState();
    const historyLenBeforeSelect = temporal.pastStates.length;

    // Select the object
    useStore.getState().selectObject('test_select_id');

    const historyLenAfterSelect = temporal.pastStates.length;
    expect(historyLenAfterSelect).toBe(historyLenBeforeSelect);
  });

  it('should snap selected objects to ground using absolute Box3 bounds and push to history', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();

    // Add a test object high in the air
    const testId = 'test_snap_obj';
    state.addObject({
      id: testId,
      name: 'Snap Test Box',
      type: 'mesh',
      geometry: 'box',
      position: [1, 5, 2],
      rotation: [0, 0, 0],
      scale: [2, 4, 2],
    });

    const historyBefore = (useStore as any).temporal.getState().pastStates.length;

    // 1. Standard (unrotated) box snapping
    useStore.getState().selectObject(testId);
    useStore.getState().snapSelectedToGround();

    // Verify Y position is 2 (bottom of scaled box of height 4 starts at 5 - 2 = 3. Snaps to Y=2).
    let updatedObj = useStore.getState().objects.find((o) => o.id === testId);
    expect(updatedObj?.position[1]).toBeCloseTo(2, 5);

    // Verify history grew by exactly 1 step
    const historyAfter1 = (useStore as any).temporal.getState().pastStates.length;
    expect(historyAfter1).toBe(historyBefore + 1);

    // 2. Rotated box snapping (rotated 90 degrees on X axis)
    // Scale on Z is 2, so when rotated 90 deg on X, the vertical thickness is 2 (from scale[2]) instead of 4.
    useStore.getState().updateObject(testId, { position: [1, 10, 2], rotation: [Math.PI / 2, 0, 0] });
    const historyBeforeRotated = (useStore as any).temporal.getState().pastStates.length;

    useStore.getState().snapSelectedToGround();

    // Vertical thickness is 2, so center Y should snap to 1 (bottom boundary at 1 - 2/2 = 0)
    updatedObj = useStore.getState().objects.find((o) => o.id === testId);
    expect(updatedObj?.position[1]).toBeCloseTo(1, 4);

    // Verify history grew by exactly 1 step
    const historyAfter2 = (useStore as any).temporal.getState().pastStates.length;
    expect(historyAfter2).toBe(historyBeforeRotated + 1);

    // Undo should restore position
    useStore.getState().undo();
    updatedObj = useStore.getState().objects.find((o) => o.id === testId);
    expect(updatedObj?.position[1]).toBe(10);
    expect(updatedObj?.rotation[0]).toBe(Math.PI / 2);
  });

  it('should snap selected objects to terrain heights when terrain is present', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();

    // Create a terrain plane object with height map
    const terrainId = 'test_terrain_plane';
    const heightData = new Array(4225).fill(0);
    // Add a peak at the center (row=32, col=32) -> index 2112
    heightData[2112] = 3.0;

    state.addObject({
      id: terrainId,
      name: 'Sculpted Terrain',
      type: 'mesh',
      geometry: 'plane',
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [10, 10, 1],
      heightData,
    });

    // Add a test box above the center of the terrain
    const boxId = 'terrain_snap_box';
    state.addObject({
      id: boxId,
      name: 'Test Box',
      type: 'mesh',
      geometry: 'box',
      position: [0, 10, 0], // exactly centered at X=0, Z=0
      rotation: [0, 0, 0],
      scale: [2, 4, 2],
    });

    useStore.getState().selectObject(boxId);
    useStore.getState().snapSelectedToGround();

    const snappedObj = useStore.getState().objects.find((o) => o.id === boxId);
    // Terrain height at center is 3.0. Box height is 4.0 (half is 2.0).
    // Snapped center position should be 3.0 + 2.0 = 5.0.
    expect(snappedObj?.position[1]).toBeCloseTo(5, 2);
  });

  it('should export and compute getTerrainWorldHeightAt correctly', () => {
    const heightData = new Array(4225).fill(0);
    // 64 segments = 65 vertices. Center is at (32, 32) -> index 32 * 65 + 32 = 2112.
    heightData[2112] = 5.0;

    const terrainObj = {
      id: 'test_terrain',
      name: 'Terrain',
      type: 'mesh' as const,
      geometry: 'plane' as const,
      position: [0, 0, 0] as [number, number, number],
      rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
      scale: [10, 10, 1] as [number, number, number],
      heightData,
    };

    // Center point (X=0, Z=0) should evaluate to heightData center vertex = 5.0
    const centerHeight = getTerrainWorldHeightAt(0, 0, terrainObj);
    expect(centerHeight).toBeCloseTo(5.0, 2);

    // Outside bounds should return null
    const outsideHeight = getTerrainWorldHeightAt(10, 10, terrainObj);
    expect(outsideHeight).toBeNull();
  });

  it('should compute getWorldPositionOfObject and snap nested objects correctly', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();

    // Create a parent group at Y=5
    state.addObject({
      id: 'parent_group',
      name: 'Parent Group',
      type: 'group',
      position: [10, 5, 10],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    // Create a child box nested under parent_group (local position: [0, 2, 0] -> world position: [10, 7, 10])
    state.addObject({
      id: 'child_box',
      name: 'Child Box',
      type: 'mesh',
      geometry: 'box',
      position: [0, 2, 0],
      rotation: [0, 0, 0],
      scale: [1, 2, 1],
      parentId: 'parent_group',
    });

    // Verify absolute world position calculation
    const worldPos = getWorldPositionOfObject(
      useStore.getState().objects.find(o => o.id === 'child_box')!,
      useStore.getState().objects
    );
    expect(worldPos).toEqual([10, 7, 10]);

    // Perform snapping
    useStore.getState().selectObject('child_box');
    useStore.getState().snapSelectedToGround();

    const snappedObj = useStore.getState().objects.find((o) => o.id === 'child_box');
    // The ground is at Y=0.
    // The parent is at world Y=5.
    // For a box of height 2, the center local Y should snap to -4 (meaning bottom is at local -5, world bottom is 0).
    expect(snappedObj?.position[1]).toBeCloseTo(-4, 2);
  });

  it('should support updating and undoing pivotOffset', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();

    const testId = 'pivot_test_obj';
    state.addObject({
      id: testId,
      name: 'Pivot Test Box',
      type: 'mesh',
      geometry: 'box',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    // Verify initial pivotOffset is undefined
    let obj = useStore.getState().objects.find((o) => o.id === testId);
    expect(obj?.pivotOffset).toBeUndefined();

    const historyBefore = (useStore as any).temporal.getState().pastStates.length;

    // Update pivotOffset
    useStore.getState().updateObject(testId, { pivotOffset: [0, 1, 0] });

    // Verify update
    obj = useStore.getState().objects.find((o) => o.id === testId);
    expect(obj?.pivotOffset).toEqual([0, 1, 0]);

    // Verify zundo tracked the change
    const historyAfter = (useStore as any).temporal.getState().pastStates.length;
    expect(historyAfter).toBe(historyBefore + 1);

    // Undo change
    useStore.getState().undo();
    obj = useStore.getState().objects.find((o) => o.id === testId);
    expect(obj?.pivotOffset).toBeUndefined();
  });

  it('should compute bounds and support pivot preset quick alignment calculations', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();

    const testId = 'preset_pivot_test';
    state.addObject({
      id: testId,
      name: 'Preset Pivot Box',
      type: 'mesh',
      geometry: 'box',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [2, 4, 6],
    });

    // 1. Verify computeObjectBounds on a standard box geometry
    let obj = useStore.getState().objects.find((o) => o.id === testId)!;
    const computed = computeObjectBounds(obj);
    expect(computed.minX).toBeCloseTo(1, 4);
    expect(computed.maxX).toBeCloseTo(1, 4);
    expect(computed.minY).toBeCloseTo(2, 4);
    expect(computed.maxY).toBeCloseTo(2, 4);
    expect(computed.minZ).toBeCloseTo(3, 4);
    expect(computed.maxZ).toBeCloseTo(3, 4);

    // 2. Set customBounds and test alignment math simulating UI presets
    const customBounds = {
      minX: 0,
      maxX: 4,
      minY: 2,
      maxY: 4,
      minZ: 0,
      maxZ: 6,
    };
    useStore.getState().updateObject(testId, { customBounds });

    obj = useStore.getState().objects.find((o) => o.id === testId)!;
    expect(obj.customBounds).toEqual(customBounds);

    // Base Preset Align:
    // ox = 0, oy = 0, oz = 0
    // newX = ox - (maxX - minX) / 2 = 0 - 2 = -2
    // newY = oy + minY = 2
    // newZ = oz - (maxZ - minZ) / 2 = 0 - 3 = -3
    let bounds = computeObjectBounds(obj);
    let ox = 0, oy = 0, oz = 0;
    let newX = ox - (bounds.maxX - bounds.minX) / 2;
    let newY = oy + bounds.minY;
    let newZ = oz - (bounds.maxZ - bounds.minZ) / 2;
    useStore.getState().updateObject(testId, { pivotOffset: [newX, newY, newZ] });

    obj = useStore.getState().objects.find((o) => o.id === testId)!;
    expect(obj.pivotOffset).toEqual([-2, 2, -3]);

    // Center Preset Align:
    // newY = oy - (maxY - minY) / 2 = 0 - 1 = -1
    newY = oy - (bounds.maxY - bounds.minY) / 2;
    useStore.getState().updateObject(testId, { pivotOffset: [newX, newY, newZ] });

    obj = useStore.getState().objects.find((o) => o.id === testId)!;
    expect(obj.pivotOffset).toEqual([-2, -1, -3]);

    // Top Preset Align:
    // newY = oy - maxY = -4
    newY = oy - bounds.maxY;
    useStore.getState().updateObject(testId, { pivotOffset: [newX, newY, newZ] });

    obj = useStore.getState().objects.find((o) => o.id === testId)!;
    expect(obj.pivotOffset).toEqual([-2, -4, -3]);
  });

  it('should support keepWorldPos math with rotation and scale', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();

    const testId = 'keep_world_pos_test';
    state.addObject({
      id: testId,
      name: 'Keep World Pos Box',
      type: 'mesh',
      geometry: 'box',
      position: [10, 10, 10],
      rotation: [0, 0, Math.PI / 2],
      scale: [2, 2, 2],
    });

    let obj = useStore.getState().objects.find((o) => o.id === testId)!;
    
    // Simulate UI: Keep World Position checked, pivotOffset changes from [0, 0, 0] to [0, 1, 0]
    const vec = obj.pivotOffset || [0, 0, 0];
    const newVec: [number, number, number] = [0, 1, 0];

    const diff = [
      vec[0] - newVec[0],
      vec[1] - newVec[1],
      vec[2] - newVec[2],
    ];

    // Compute new position manually using the same math as in InspectorPanel
    const THREE = require('three');
    const vec3 = new THREE.Vector3(diff[0], diff[1], diff[2]);
    vec3.multiply(new THREE.Vector3(obj.scale[0], obj.scale[1], obj.scale[2]));
    const euler = new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
    vec3.applyEuler(euler);

    const newPos: [number, number, number] = [
      obj.position[0] + vec3.x,
      obj.position[1] + vec3.y,
      obj.position[2] + vec3.z,
    ];

    // Update object
    useStore.getState().updateObject(testId, {
      pivotOffset: newVec,
      position: newPos,
    });

    const updated = useStore.getState().objects.find((o) => o.id === testId)!;
    expect(updated.pivotOffset).toEqual([0, 1, 0]);
    // With scale [2,2,2] and 90 deg rotation on Z, the local y offset of 1 translates to world x offset of -2 (since y goes to x).
    // Shift is local -1 on Y. Rotated by 90deg on Z: x' = 2, y' = 0.
    // So position changes from [10,10,10] to [12,10,10].
    expect(updated.position[0]).toBeCloseTo(12, 4);
    expect(updated.position[1]).toBeCloseTo(10, 4);
    expect(updated.position[2]).toBeCloseTo(10, 4);
  });

  it('should support animation state and actions', () => {
    const testId = 'test-anim-obj';
    useStore.getState().addObject({
      id: testId,
      name: 'Animated GLTF',
      type: 'gltf',
      url: '/models/test.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    // Verify initial values
    let obj = useStore.getState().objects.find((o) => o.id === testId)!;
    expect(obj.activeAnimation).toBeUndefined();
    expect(obj.animationSpeed).toBeUndefined();

    // Register animations
    useStore.getState().setObjectAnimations(testId, ['idle', 'run']);
    expect(useStore.getState().modelAnimations[testId]).toEqual(['idle', 'run']);

    // Update animation properties
    useStore.getState().updateObject(testId, {
      activeAnimation: 'run',
      animationSpeed: 1.5,
    });

    obj = useStore.getState().objects.find((o) => o.id === testId)!;
    expect(obj.activeAnimation).toBe('run');
    expect(obj.animationSpeed).toBe(1.5);
  });

  it('should automatically inject and strip character properties for gltf/fbx moved/initialized in Starter Player', () => {
    const testId = 'starter-player-gltf';
    
    // 1. Initialized in Starter Player folder
    useStore.getState().addObject({
      id: testId,
      name: 'Starter Player Rigged',
      type: 'gltf',
      url: '/models/test.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      parentId: 'starter_player'
    });

    let obj = useStore.getState().objects.find((o) => o.id === testId)!;
    expect(obj.physics).toBe('dynamic');
    expect(obj.physicsMass).toBe(80);
    expect(obj.physicsCollisions).toBe(true);
    expect(obj.characterActions).toBeDefined();
    expect(obj.characterActions?.sprintEnabled).toBe(true);
    expect(obj.walkSpeed).toBe(5);
    expect(obj.runSpeed).toBe(10);
    expect(obj.jumpHeight).toBe(15);

    // 2. Moved out of Starter Player folder
    useStore.getState().setParent(testId, null);
    obj = useStore.getState().objects.find((o) => o.id === testId)!;
    expect(obj.physics).toBeUndefined();
    expect(obj.physicsMass).toBeUndefined();
    expect(obj.physicsCollisions).toBeUndefined();
    expect(obj.characterActions).toBeUndefined();
    expect(obj.walkSpeed).toBeUndefined();
    expect(obj.runSpeed).toBeUndefined();
    expect(obj.jumpHeight).toBeUndefined();

    // 3. Moved back into Starter Player folder
    useStore.getState().setParent(testId, 'starter_player');
    obj = useStore.getState().objects.find((o) => o.id === testId)!;
    expect(obj.physics).toBe('dynamic');
    expect(obj.physicsMass).toBe(80);
    expect(obj.physicsCollisions).toBe(true);
    expect(obj.characterActions).toBeDefined();
    expect(obj.characterActions?.sprintEnabled).toBe(true);
    expect(obj.walkSpeed).toBe(5);
    expect(obj.runSpeed).toBe(10);
    expect(obj.jumpHeight).toBe(15);
  });

  it('should support automatic single-character role assignment and explicit override', () => {
    // Start fresh
    useStore.getState().startNewScene();
    
    // Add obj_player back explicitly for the test context
    useStore.getState().addObject({
      id: 'obj_player',
      name: 'Test Player',
      type: 'gltf',
      url: '/humanoid+robot+3d+model.glb',
      position: [-2, 1, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      parentId: 'starter_player',
    });
    
    // Default scene (with obj_player added) has exactly one player character: obj_player
    expect(useStore.getState().activePlayerId).toBe('obj_player');

    // Add a second character under starter_player
    useStore.getState().addObject({
      id: 'player_two',
      name: 'Player Two',
      type: 'gltf',
      url: '/models/two.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      parentId: 'starter_player',
    });

    // Since there are two players now, it should keep the current active player (obj_player)
    expect(useStore.getState().activePlayerId).toBe('obj_player');

    // Explicitly set the active player to player_two
    useStore.getState().setActivePlayerId('player_two');
    expect(useStore.getState().activePlayerId).toBe('player_two');

    // If we trigger a hierarchy change, e.g. add a non-player model, activePlayerId should stay player_two
    useStore.getState().addObject({
      id: 'other_gltf',
      name: 'Static GLTF',
      type: 'gltf',
      url: '/models/static.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      parentId: null,
    });
    expect(useStore.getState().activePlayerId).toBe('player_two');

    // Delete obj_player
    useStore.getState().deleteObject('obj_player');
    // Now starter_player has exactly one gltf/fbx child (player_two), so activePlayerId should be player_two
    expect(useStore.getState().activePlayerId).toBe('player_two');

    // Add another child to starter_player
    useStore.getState().addObject({
      id: 'player_three',
      name: 'Player Three',
      type: 'gltf',
      url: '/models/three.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      parentId: 'starter_player',
    });
    // With multiple children (player_two, player_three), keeping current active player (player_two)
    expect(useStore.getState().activePlayerId).toBe('player_two');

    // Delete player_two
    useStore.getState().deleteObject('player_two');
    // Now starter_player has exactly one gltf/fbx child (player_three), so activePlayerId should automatically set to player_three
    expect(useStore.getState().activePlayerId).toBe('player_three');

    // Move player_three out of starter_player
    useStore.getState().setParent('player_three', null);
    // Since starter_player is empty, activePlayerId should be null
    expect(useStore.getState().activePlayerId).toBeNull();
  });

  it('should support addScript action and history tracking', () => {
    useStore.getState().startNewScene();
    const state = useStore.getState();

    // 1. Add script with default Workspace parent
    const historyBefore = (useStore as any).temporal.getState().pastStates.length;
    state.addScript();

    const stateAfter = useStore.getState();
    const createdScript = stateAfter.objects.find(o => o.type === 'script');
    expect(createdScript).toBeDefined();
    expect(createdScript?.name).toBe('Script.js');
    expect(createdScript?.scriptCode).toContain('console.log("Hello!");');
    expect(createdScript?.parentId).toBeNull();

    // Verify history tracking
    const historyAfter = (useStore as any).temporal.getState().pastStates.length;
    expect(historyAfter).toBe(historyBefore + 1);

    // Verify tab focus
    expect(stateAfter.activeScriptId).toBe(createdScript?.id);
    expect(stateAfter.openScripts).toContain(createdScript?.id);

    // 2. Add script with a specific group parent
    // Create a group
    stateAfter.addPrimitive('group');
    const stateWithGroup = useStore.getState();
    const groupObj = stateWithGroup.objects.find(o => o.type === 'group')!;
    
    stateWithGroup.addScript(groupObj.id);
    const stateWithChildScript = useStore.getState();
    const childScript = stateWithChildScript.objects.find(o => o.parentId === groupObj.id);
    expect(childScript).toBeDefined();
    expect(childScript?.type).toBe('script');
  });

  it('should support symmetrical rigging mode and mirror keyframe updates', () => {
    // Enable symmetry
    useStore.getState().setRiggingSymmetry(true);
    expect(useStore.getState().riggingSymmetry).toBe(true);

    // Prepare tracks
    useStore.getState().setTracks([]);

    // Update keyframe on a left-sided bone
    useStore.getState().updateKeyframe('mixamorigLeftArm', 'position', 10, [1, 2, 3]);

    // Verify both left arm and right arm tracks are updated
    const updatedState = useStore.getState();
    const leftArmTrack = updatedState.tracks.find(t => t.boneName === 'mixamorigLeftArm' && t.property === 'position');
    const rightArmTrack = updatedState.tracks.find(t => t.boneName === 'mixamorigRightArm' && t.property === 'position');

    expect(leftArmTrack).toBeDefined();
    expect(leftArmTrack?.keyframes[10]).toEqual([1, 2, 3]);

    expect(rightArmTrack).toBeDefined();
    // Position negates X coordinate
    expect(rightArmTrack?.keyframes[10]).toEqual([-1, 2, 3]);

    // Update rotation keyframe
    useStore.getState().updateKeyframe('mixamorigLeftArm', 'rotation', 10, [0.1, 0.2, 0.3, 0.9]);
    const finalState = useStore.getState();
    const leftArmRot = finalState.tracks.find(t => t.boneName === 'mixamorigLeftArm' && t.property === 'rotation');
    const rightArmRot = finalState.tracks.find(t => t.boneName === 'mixamorigRightArm' && t.property === 'rotation');

    expect(leftArmRot).toBeDefined();
    expect(leftArmRot?.keyframes[10]).toEqual([0.1, 0.2, 0.3, 0.9]);

    expect(rightArmRot).toBeDefined();
    // Rotation negates Y and Z coordinates
    expect(rightArmRot?.keyframes[10]).toEqual([0.1, -0.2, -0.3, 0.9]);

    // Disable symmetry and verify no mirroring occurs
    useStore.getState().setRiggingSymmetry(false);
    useStore.getState().updateKeyframe('mixamorigLeftArm', 'position', 20, [4, 5, 6]);

    const stateNoSymmetry = useStore.getState();
    const rightArmTrack2 = stateNoSymmetry.tracks.find(t => t.boneName === 'mixamorigRightArm' && t.property === 'position');
    expect(rightArmTrack2?.keyframes[20]).toBeUndefined();
  });

  it('should support rigModelAsset action and create rigging tasks', async () => {
    // Add a model object to the scene
    useStore.getState().addObject({
      id: 'test_model_for_rigging',
      name: 'Unrigged Man',
      type: 'gltf',
      url: '/models/unrigged.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    });

    const stateBefore = useStore.getState();
    const taskCountBefore = stateBefore.aiGenerationTasks.length;

    // Trigger rigging (will run mock rigging since key is empty or dummy)
    await useStore.getState().rigModelAsset('test_model_for_rigging');

    const stateAfter = useStore.getState();
    expect(stateAfter.aiGenerationTasks.length).toBe(taskCountBefore + 1);

    const riggingTask = stateAfter.aiGenerationTasks.find(t => t.stage === 'rigging' && t.targetObjectId === 'test_model_for_rigging');
    expect(riggingTask).toBeDefined();
    expect(riggingTask?.prompt).toBe('Rigging: Unrigged Man');
    expect(riggingTask?.status).toBe('PENDING');
  });

  it('should support triggerSettings configuration and clonePrefab deep copy', () => {
    const state = useStore.getState();
    const testObjId = 'test_model_with_triggers';
    
    state.addObject({
      id: testObjId,
      name: 'Trigger Model',
      type: 'gltf',
      url: '/models/trigger_model.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      health: 100,
      animationConfigs: {
        'Dead': {
          triggerSettings: {
            triggerMode: 'condition',
            conditionSettings: {
              propertySource: 'health',
              operator: 'equal_to',
              value: 0
            }
          }
        }
      }
    });

    const added = useStore.getState().objects.find(o => o.id === testObjId);
    expect(added).toBeDefined();
    expect(added?.health).toBe(100);
    expect(added?.animationConfigs?.['Dead'].triggerSettings?.triggerMode).toBe('condition');

    // Clone prefab and verify trigger settings deep-copied and unique
    state.clonePrefab(testObjId, null);
    
    const allObjects = useStore.getState().objects;
    const clone = allObjects.find(o => o.name === 'Trigger Model' && o.id !== testObjId);
    expect(clone).toBeDefined();
    expect(clone?.health).toBe(100);
    expect(clone?.animationConfigs?.['Dead'].triggerSettings?.triggerMode).toBe('condition');

    // Mutate the original config and verify the clone is unaffected
    state.updateObject(testObjId, {
      animationConfigs: {
        'Dead': {
          triggerSettings: {
            triggerMode: 'none'
          }
        }
      }
    });

    const updatedOrig = useStore.getState().objects.find(o => o.id === testObjId);
    const updatedClone = useStore.getState().objects.find(o => o.id === clone?.id);
    expect(updatedOrig?.animationConfigs?.['Dead'].triggerSettings?.triggerMode).toBe('none');
    expect(updatedClone?.animationConfigs?.['Dead'].triggerSettings?.triggerMode).toBe('condition');
  });

  it('should support lastHitType in animation trigger settings', () => {
    const state = useStore.getState();
    const testObjId = 'test_moba_combat_character';
    
    state.addObject({
      id: testObjId,
      name: 'MOBA Character',
      type: 'gltf',
      url: '/models/moba.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      health: 100,
      lastHitType: 'knockup',
      animationConfigs: {
        'HitReaction': {
          triggerSettings: {
            triggerMode: 'condition',
            conditionSettings: {
              propertySource: 'lastHitType',
              operator: 'equal_to',
              value: 'knockup'
            }
          }
        }
      }
    });

    const added = useStore.getState().objects.find(o => o.id === testObjId);
    expect(added).toBeDefined();
    expect(added?.lastHitType).toBe('knockup');
    
    const condition = added?.animationConfigs?.['HitReaction']?.triggerSettings?.conditionSettings;
    expect(condition?.propertySource).toBe('lastHitType');
    expect(condition?.value).toBe('knockup');

    // Clean up
    state.deleteObject(testObjId);
  });

  it('should support copyAnimationToTarget action and transfer custom animations', () => {
    const sourceObjId = 'source_char';
    const targetObjId = 'target_char';

    // 1. Setup source and target objects
    useStore.getState().addObject({
      id: sourceObjId,
      name: 'Source Character',
      type: 'gltf',
      url: '/models/source.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      availableAnimations: ['run'],
      customAnimations: {
        'run': [
          {
            boneName: 'mixamorigLeftLeg',
            property: 'rotation',
            keyframes: { 0: [0, 0, 0, 1], 10: [0.1, 0, 0, 0.9] }
          }
        ]
      }
    });

    useStore.getState().addObject({
      id: targetObjId,
      name: 'Target Character',
      type: 'gltf',
      url: '/models/target.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      availableAnimations: []
    });

    // 2. Perform copy
    useStore.getState().copyAnimationToTarget(sourceObjId, targetObjId, 'run');

    // 3. Verify copy results
    const targetObj = useStore.getState().objects.find(o => o.id === targetObjId);
    expect(targetObj).toBeDefined();
    expect(targetObj?.availableAnimations).toContain('run');
    expect(targetObj?.customAnimations?.['run']).toBeDefined();
    expect(targetObj?.customAnimations?.['run'][0].boneName).toBe('mixamorigLeftLeg');
    expect(targetObj?.customAnimations?.['run'][0].keyframes[10]).toEqual([0.1, 0, 0, 0.9]);

    // Clean up
    useStore.getState().deleteObject(sourceObjId);
    useStore.getState().deleteObject(targetObjId);
  });

  it('should flip pose symmetrically for all bones at the current frame', () => {
    // 1. Set active target object
    const state = useStore.getState();
    const objId = 'test_symmetry_char';

    state.addObject({
      id: objId,
      name: 'Symmetry Character',
      type: 'gltf',
      url: '/models/sym.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      activeAnimation: 'Dance',
    });

    state.setAnimationTargetId(objId);
    state.setCurrentFrame(12);

    // 2. Mock a THREE.Group to serve as the activeClonedScene containing left, right and center bones
    const mockScene = new THREE.Group();
    const leftBone = new THREE.Bone();
    leftBone.name = 'mixamorigLeftArm';
    leftBone.position.set(1.5, 2.0, 3.5);
    leftBone.quaternion.set(0.1, 0.2, 0.3, 0.9);

    const rightBone = new THREE.Bone();
    rightBone.name = 'mixamorigRightArm';
    rightBone.position.set(-1.0, 4.0, 6.0);
    rightBone.quaternion.set(0.4, 0.5, 0.6, 0.7);

    const hipsBone = new THREE.Bone();
    hipsBone.name = 'mixamorigHips';
    hipsBone.position.set(0.0, 1.0, 0.0);
    hipsBone.quaternion.set(0.0, 0.0, 0.0, 1.0);

    mockScene.add(leftBone);
    mockScene.add(rightBone);
    mockScene.add(hipsBone);

    state.setActiveClonedScene(mockScene);

    // 3. Trigger flipPoseSymmetrically
    state.flipPoseSymmetrically();

    // 4. Verify THREE.Bone objects were flipped and swapped
    expect(leftBone.position.x).toBeCloseTo(1);
    expect(leftBone.position.y).toBeCloseTo(4);
    expect(leftBone.position.z).toBeCloseTo(6);
    expect(leftBone.quaternion.y).toBeCloseTo(-0.5);
    expect(leftBone.quaternion.z).toBeCloseTo(-0.6);

    expect(rightBone.position.x).toBeCloseTo(-1.5);
    expect(rightBone.position.y).toBeCloseTo(2);
    expect(rightBone.position.z).toBeCloseTo(3.5);
    expect(rightBone.quaternion.y).toBeCloseTo(-0.2);
    expect(rightBone.quaternion.z).toBeCloseTo(-0.3);

    expect(hipsBone.position.x).toBeCloseTo(0);

    // 5. Verify tracks/keyframes in Zustand store match
    const finalState = useStore.getState();
    const leftTrackPos = finalState.tracks.find(t => t.boneName === 'mixamorigLeftArm' && t.property === 'position');
    const leftTrackRot = finalState.tracks.find(t => t.boneName === 'mixamorigLeftArm' && t.property === 'rotation');
    
    expect(leftTrackPos?.keyframes[12]).toEqual([1, 4, 6]);
    expect(leftTrackRot?.keyframes[12][1]).toBeCloseTo(-0.5);

    // Clean up
    state.deleteObject(objId);
    state.setActiveClonedScene(null);
    state.setAnimationTargetId(null);
  });

  it('should support animation timeScale configurations', () => {
    const state = useStore.getState();
    const objId = 'test_timescale_char';

    state.addObject({
      id: objId,
      name: 'Timescale Character',
      type: 'gltf',
      url: '/models/timescale.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      activeAnimation: 'Walk',
      animationConfigs: {
        'Walk': {
          timeScale: -1.5,
          triggerSettings: { triggerMode: 'none' }
        }
      }
    });

    const obj = useStore.getState().objects.find(o => o.id === objId);
    expect(obj).toBeDefined();
    expect(obj?.animationConfigs?.['Walk']?.timeScale).toBe(-1.5);

    // Update timescale config
    state.updateObject(objId, {
      animationConfigs: {
        ...obj?.animationConfigs,
        'Walk': {
          ...obj?.animationConfigs?.['Walk'],
          timeScale: 0.5
        }
      }
    });

    const updatedObj = useStore.getState().objects.find(o => o.id === objId);
    expect(updatedObj?.animationConfigs?.['Walk']?.timeScale).toBe(0.5);

    // Clean up
    state.deleteObject(objId);
  });

  it('should preserve world position when setParent is called', () => {
    const state = useStore.getState();
    const parentId = 'test_parent_group';
    const childId = 'test_child_mesh';

    // 1. Add a parent group at [10, 5, -2]
    state.addObject({
      id: parentId,
      name: 'Parent Group',
      type: 'group',
      position: [10, 5, -2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    // 2. Add a child mesh at [0, 0, 0] under the parent (world pos is [10, 5, -2])
    state.addObject({
      id: childId,
      name: 'Child Mesh',
      type: 'mesh',
      geometry: 'box',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      parentId: parentId,
    });

    // Verify initial world pos is [10, 5, -2]
    let child = useStore.getState().objects.find(o => o.id === childId);
    expect(child?.position).toEqual([0, 0, 0]);
    expect(getWorldPositionOfObject(child!, useStore.getState().objects)).toEqual([10, 5, -2]);

    // 3. Move child to the root (parentId: null)
    state.setParent(childId, null);

    // Verify world position is preserved (local position becomes [10, 5, -2])
    child = useStore.getState().objects.find(o => o.id === childId);
    expect(child?.parentId).toBeNull();
    expect(child?.position).toEqual([10, 5, -2]);
    expect(getWorldPositionOfObject(child!, useStore.getState().objects)).toEqual([10, 5, -2]);

    // 4. Move child back to a different parent at [5, -1, 3]
    const otherParentId = 'test_other_parent';
    state.addObject({
      id: otherParentId,
      name: 'Other Parent',
      type: 'group',
      position: [5, -1, 3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    state.setParent(childId, otherParentId);

    // Verify world position is preserved (local position becomes [5, 6, -5])
    child = useStore.getState().objects.find(o => o.id === childId);
    expect(child?.parentId).toBe(otherParentId);
    expect(child?.position).toEqual([5, 6, -5]);
    expect(getWorldPositionOfObject(child!, useStore.getState().objects)).toEqual([10, 5, -2]);

    // Clean up
    state.deleteObject(childId);
    state.deleteObject(parentId);
    state.deleteObject(otherParentId);
  });

  it('should manage loopMode and setLoopMode correctly', () => {
    const state = useStore.getState();
    
    // Default should be repeat
    expect(state.loopMode).toBe('repeat');
    
    // We should be able to update loopMode
    state.setLoopMode('once');
    expect(useStore.getState().loopMode).toBe('once');
    
    state.setLoopMode('repeat');
    expect(useStore.getState().loopMode).toBe('repeat');
  });

  it('should manage alternatingIdles and setAlternatingIdles correctly', () => {
    const state = useStore.getState();
    
    // Default should be true
    expect(state.alternatingIdles).toBe(true);
    
    // We should be able to toggle it
    state.setAlternatingIdles(false);
    expect(useStore.getState().alternatingIdles).toBe(false);
    
    state.setAlternatingIdles(true);
    expect(useStore.getState().alternatingIdles).toBe(true);
  });

  it('should support object-specific alternating idle configuration properties', () => {
    const state = useStore.getState();
    const objId = 'test_alt_idle_obj';

    state.addObject({
      id: objId,
      name: 'Alt Idle Character',
      type: 'gltf',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    // Verify updating properties works on the object
    state.updateObject(objId, {
      alternatingIdles: true,
      alternateAnimation: 'idle_scratch_head',
      alternateFrequency: 3,
    });

    const updated = useStore.getState().objects.find(o => o.id === objId);
    expect(updated?.alternatingIdles).toBe(true);
    expect(updated?.alternateAnimation).toBe('idle_scratch_head');
    expect(updated?.alternateFrequency).toBe(3);

    state.deleteObject(objId);
  });

  it('should support keyframeClipboard state and setKeyframeClipboard action', () => {
    const state = useStore.getState();
    expect(state.keyframeClipboard).toBeNull();

    const sampleSingleClipboard = {
      type: 'single' as const,
      property: 'rotation' as const,
      value: [0, 0, 0, 1]
    };
    state.setKeyframeClipboard(sampleSingleClipboard);
    expect(useStore.getState().keyframeClipboard).toEqual(sampleSingleClipboard);

    state.setKeyframeClipboard(null);
    expect(useStore.getState().keyframeClipboard).toBeNull();
  });

  it('should support cloneActiveAnimation action and duplicate/register the clip', () => {
    const state = useStore.getState();
    const objId = 'test_clone_model';

    // 1. Setup mock model and select it
    state.addObject({
      id: objId,
      name: 'Clone Test Character',
      type: 'gltf',
      url: '/models/clone.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      activeAnimation: 'walk',
      availableAnimations: ['walk'],
    });

    state.setAnimationTargetId(objId);
    useStore.setState({ workspaceMode: 'animation' });

    // 2. Setup mock raw Three.js AnimationClip inside the registry
    const mockClip = new THREE.AnimationClip('walk', 1.0, [
      new THREE.VectorKeyframeTrack('Hips.position', [0, 0.5, 1.0], [0, 0, 0, 0, 1, 0, 0, 2, 0])
    ]);
    loadedAnimationsRegistry[objId] = [mockClip];

    // 3. Invoke cloneActiveAnimation
    const clonedName = state.cloneActiveAnimation();
    expect(clonedName).toBe('walk_EDIT');

    // 4. Verify state updates
    const updatedObj = useStore.getState().objects.find(o => o.id === objId);
    expect(updatedObj?.activeAnimation).toBe('walk_EDIT');
    expect(updatedObj?.availableAnimations).toContain('walk_EDIT');
    expect(useStore.getState().modelAnimations[objId]).toContain('walk_EDIT');

    const registryClips = loadedAnimationsRegistry[objId] || [];
    const clonedRegistryClip = registryClips.find(c => c.name === 'walk_EDIT');
    expect(clonedRegistryClip).toBeDefined();
    expect(clonedRegistryClip?.duration).toBe(1.0);

    // Verify tracks are parsed and loaded to timeline
    const activeTracks = useStore.getState().tracks;
    const hipsTrack = activeTracks.find(t => t.boneName === 'Hips' && t.property === 'position');
    expect(hipsTrack).toBeDefined();
    expect(hipsTrack?.keyframes[0]).toEqual([0, 0, 0]);
    expect(hipsTrack?.keyframes[15]).toEqual([0, 1, 0]); // at time 0.5s -> frame 15

    // Clean up
    state.deleteObject(objId);
    delete loadedAnimationsRegistry[objId];
  });

  it('should support addObjects and recursively delete gltf_part children when parent is deleted', () => {
    const state = useStore.getState();
    const parentId = 'gltf_parent_id';
    const partId1 = 'gltf_part_1';
    const partId2 = 'gltf_part_2';

    // 1. Add parent and parts
    state.addObject({
      id: parentId,
      name: 'Parent GLTF',
      type: 'gltf',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    state.addObjects([
      {
        id: partId1,
        name: 'Part 1',
        type: 'gltf_part',
        parentId: parentId,
        position: [1, 1, 1],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      {
        id: partId2,
        name: 'Part 2',
        type: 'gltf_part',
        parentId: partId1, // Nested child part
        position: [2, 2, 2],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      }
    ]);

    // Verify addition
    let objs = useStore.getState().objects;
    expect(objs.find(o => o.id === parentId)).toBeDefined();
    expect(objs.find(o => o.id === partId1)).toBeDefined();
    expect(objs.find(o => o.id === partId2)).toBeDefined();

    // 2. Delete parent and verify parts are deleted recursively
    state.deleteObject(parentId);

    objs = useStore.getState().objects;
    expect(objs.find(o => o.id === parentId)).toBeUndefined();
    expect(objs.find(o => o.id === partId1)).toBeUndefined();
    expect(objs.find(o => o.id === partId2)).toBeUndefined();
  });

  it('should support rotationSnapAngle setting and reset rotation to [0,0,0] on duplication', () => {
    const state = useStore.getState();

    // Verify initial rotationSnapAngle is 15
    expect(state.rotationSnapAngle).toBe(15);

    // Set rotationSnapAngle to 45
    state.setRotationSnapAngle(45);
    expect(useStore.getState().rotationSnapAngle).toBe(45);

    // Setup an object with some rotation
    const objId = 'test_rotation_snap_object';
    state.addObject({
      id: objId,
      name: 'Rotated Cube',
      type: 'mesh',
      geometry: 'box',
      position: [0, 0, 0],
      rotation: [Math.PI / 4, Math.PI / 2, Math.PI / 3],
      scale: [1, 1, 1],
    });

    // Duplicate object
    state.duplicateObject(objId);

    // Find the duplicated object (usually has '(Copy)' in name)
    const objs = useStore.getState().objects;
    const duplicatedObj = objs.find(o => o.name === 'Rotated Cube (Copy)');
    expect(duplicatedObj).toBeDefined();

    // Verify rotation of duplicated object is reset to [0, 0, 0]
    expect(duplicatedObj?.rotation).toEqual([0, 0, 0]);

    // Clean up
    state.deleteObject(objId);
    if (duplicatedObj) state.deleteObject(duplicatedObj.id);
  });

  it('should duplicate and mirror an object along X and Z axes', () => {
    const state = useStore.getState();
    const objId = `obj_${crypto.randomUUID()}`;
    state.addObject({
      id: objId,
      name: 'Left Wing',
      type: 'mesh',
      geometry: 'box',
      position: [3, 2, 1],
      rotation: [0, Math.PI / 4, 0],
      scale: [2, 1, 1],
    });

    state.duplicateAndMirrorObject(objId, 'x');

    const objs = useStore.getState().objects;
    const mirroredObj = objs.find((o) => o.name === 'Left Wing (Mirrored)');
    expect(mirroredObj).toBeDefined();
    expect(mirroredObj?.position[0]).toBe(-3);
    expect(mirroredObj?.scale[0]).toBe(-2);
    expect(mirroredObj?.rotation).toEqual([0, -Math.PI / 4, -0]);

    state.deleteObject(objId);
    if (mirroredObj) state.deleteObject(mirroredObj.id);
  });

  it('should auto-save objects to localStorage and update on changes', () => {
    const mockStorage: Record<string, string> = {};
    const originalLocalStorage = (global as any).localStorage;

    const mockLocalStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; },
      length: 0,
      key: (index: number) => null,
    };

    (global as any).localStorage = mockLocalStorage;
    if (typeof window !== 'undefined') {
      (window as any).localStorage = mockLocalStorage;
    }

    const state = useStore.getState();

    // Add an object to trigger state change
    const testObjId = 'test_autosave_object';
    state.addObject({
      id: testObjId,
      name: 'Autosave Cube',
      type: 'mesh',
      geometry: 'box',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    // Verify it was persisted to localStorage
    const savedData = localStorage.getItem('stellar-engine-autosave');
    expect(savedData).toBeDefined();
    expect(savedData).toContain('Autosave Cube');

    // Clean up
    state.deleteObject(testObjId);
    (global as any).localStorage = originalLocalStorage;
    if (typeof window !== 'undefined') {
      (window as any).localStorage = originalLocalStorage;
    }
  });

  it('should support agentic paint_foliage command via applyAiPlan', () => {
    useStore.getState().clearFoliage();
    expect(useStore.getState().foliageInstances.length).toBe(0);

    const msgId = 'msg_foliage_test';
    useStore.setState({
      assistantMessages: [
        {
          id: msgId,
          role: 'assistant',
          content: 'Painting foliage',
          timestamp: Date.now(),
          actionType: 'scene_action',
          actions: [
            {
              targetId: 'foliage_system',
              targetName: 'Foliage Instancing Engine',
              before: {},
              after: {},
              cmd: 'paint_foliage',
              params: {
                preset: 'procedural:pine_tree',
                count: 50,
                radius: 20,
              },
            },
          ],
        },
      ],
    });

    useStore.getState().applySceneAction(msgId);
    expect(useStore.getState().foliageInstances.length).toBe(50);
    expect(useStore.getState().foliageInstances[0].assetUrl).toBe('procedural:pine_tree');
  });
});

