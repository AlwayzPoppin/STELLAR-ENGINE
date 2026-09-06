import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';

describe('Animation Target Model & Viewport Selection Synchronization', () => {
  beforeEach(() => {
    useStore.setState({
      objects: [
        {
          id: 'cube_1',
          name: 'Cube Primitive',
          type: 'mesh',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          textureUrl: null,
          parentId: null,
        },
        {
          id: 'char_gltf',
          name: 'Warrior Character',
          type: 'gltf',
          position: [2, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          textureUrl: null,
          parentId: null,
        },
      ],
      selectedIds: [],
      animationTargetId: null,
      workspaceMode: 'animation',
      activeClonedScene: null,
      activeSkeleton: [],
      tracks: [],
    });
  });

  it('should automatically set animationTargetId when clicking/selecting any mesh in viewport', () => {
    // Select the primitive cube in animation mode
    useStore.getState().selectObject('cube_1');

    const state = useStore.getState();
    expect(state.selectedIds).toEqual(['cube_1']);
    expect(state.animationTargetId).toBe('cube_1');
  });

  it('should switch animationTargetId when selecting a different model in viewport', () => {
    useStore.getState().selectObject('cube_1');
    expect(useStore.getState().animationTargetId).toBe('cube_1');

    useStore.getState().selectObject('char_gltf');
    expect(useStore.getState().animationTargetId).toBe('char_gltf');
    expect(useStore.getState().selectedIds).toEqual(['char_gltf']);
  });

  it('should synchronize selectedIds when setAnimationTargetId is invoked via dropdown', () => {
    useStore.getState().setAnimationTargetId('cube_1');

    const state = useStore.getState();
    expect(state.animationTargetId).toBe('cube_1');
    expect(state.selectedIds).toEqual(['cube_1']);
  });

  it('should auto-bind the selected object when switching workspace mode to animation', () => {
    useStore.setState({
      workspaceMode: 'level',
      selectedIds: ['cube_1'],
      animationTargetId: null,
    });

    useStore.getState().setWorkspaceMode('animation');

    const state = useStore.getState();
    expect(state.workspaceMode).toBe('animation');
    expect(state.animationTargetId).toBe('cube_1');
  });

  it('should support adding a root bone to an unrigged object and creating animation tracks', () => {
    useStore.getState().selectObject('cube_1');
    useStore.getState().addRootBoneToRig('cube_1', 'Pelvis');

    const state = useStore.getState();
    expect(state.activeSkeleton.length).toBe(1);
    expect(state.activeSkeleton[0].name).toBe('Pelvis');
    expect(state.selectedBoneId).toBe('Pelvis');
    expect(state.tracks.some((t) => t.boneName === 'Pelvis')).toBe(true);
  });

  it('should support auto-generating a full humanoid rig on an unrigged mesh', () => {
    useStore.getState().selectObject('cube_1');
    useStore.getState().generateBasicRig('cube_1');

    const state = useStore.getState();
    expect(state.activeSkeleton.length).toBeGreaterThanOrEqual(1);
    expect(state.activeSkeleton[0].name).toBe('Root');
    expect(state.tracks.some((t) => t.boneName === 'Spine')).toBe(true);
    expect(state.tracks.some((t) => t.boneName === 'Head')).toBe(true);
    expect(state.tracks.some((t) => t.boneName === 'Arm_L')).toBe(true);
    expect(state.tracks.some((t) => t.boneName === 'Leg_R')).toBe(true);
  });
});
