import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { useStore, syncActiveClonedScenePose } from '../store/useStore';

describe('Three.js Skeleton / Zundo History Synchronization', () => {
  let mockScene: THREE.Group;
  let mockBone: THREE.Bone;

  beforeEach(() => {
    (useStore as any).temporal?.getState()?.clear();

    mockScene = new THREE.Group();
    mockBone = new THREE.Bone();
    mockBone.name = 'RightArm';
    mockBone.position.set(0, 0, 0);
    mockBone.quaternion.set(0, 0, 0, 1);
    mockBone.scale.set(1, 1, 1);
    mockScene.add(mockBone);

    useStore.setState({
      activeClonedScene: mockScene,
      animationTargetId: 'test_char',
      currentFrame: 0,
      tracks: [
        {
          boneName: 'RightArm',
          property: 'position',
          keyframes: {
            0: [0, 0, 0],
            10: [5, 10, 15],
          },
        },
        {
          boneName: 'RightArm',
          property: 'rotation',
          keyframes: {
            0: [0, 0, 0, 1],
            10: [0, 0.7071, 0, 0.7071],
          },
        },
      ],
    });
  });

  it('should interpolate and synchronize live Three.js bone transforms at currentFrame', () => {
    useStore.getState().setCurrentFrame(10);

    expect(mockBone.position.x).toBeCloseTo(5, 3);
    expect(mockBone.position.y).toBeCloseTo(10, 3);
    expect(mockBone.position.z).toBeCloseTo(15, 3);

    expect(mockBone.quaternion.y).toBeCloseTo(0.7071, 3);
    expect(mockBone.quaternion.w).toBeCloseTo(0.7071, 3);
  });

  it('should interpolate mid-frame bone positions when scrubbing timeline', () => {
    useStore.getState().setCurrentFrame(5);

    expect(mockBone.position.x).toBeCloseTo(2.5, 3);
    expect(mockBone.position.y).toBeCloseTo(5.0, 3);
    expect(mockBone.position.z).toBeCloseTo(7.5, 3);
  });

  it('should auto-sync live Three.js bone transforms upon Zundo undo and redo', () => {
    useStore.getState().setCurrentFrame(10);
    expect(mockBone.position.x).toBeCloseTo(5, 3);

    // Update keyframe at frame 10 to (20, 30, 40)
    useStore.getState().updateKeyframe('RightArm', 'position', 10, [20, 30, 40]);
    useStore.getState().syncSkeletonPose();

    expect(mockBone.position.x).toBeCloseTo(20, 3);
    expect(mockBone.position.y).toBeCloseTo(30, 3);
    expect(mockBone.position.z).toBeCloseTo(40, 3);

    // Trigger Undo — should revert keyframe AND immediately update live Three.js mockBone
    useStore.getState().undo();

    expect(mockBone.position.x).toBeCloseTo(5, 3);
    expect(mockBone.position.y).toBeCloseTo(10, 3);
    expect(mockBone.position.z).toBeCloseTo(15, 3);

    // Trigger Redo — should re-apply modified keyframe and update live Three.js mockBone
    useStore.getState().redo();

    expect(mockBone.position.x).toBeCloseTo(20, 3);
    expect(mockBone.position.y).toBeCloseTo(30, 3);
    expect(mockBone.position.z).toBeCloseTo(40, 3);
  });
});
