import { describe, it, expect } from 'vitest';
import { useStore } from './useStore';

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
});

