import { describe, it, expect } from 'vitest';
import { useStore, getMirrorAxis } from './useStore';

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

  it('should mirror joint updates under symmetry', () => {
    const state = useStore.getState();
    
    // Add custom joints to 'obj_player'
    const player = state.objects.find(o => o.id === 'obj_player')!;
    expect(player).toBeDefined();

    // Set symmetry to true
    useStore.setState({ symmetryEnabled: true });

    // Add L and R arm joints
    const leftArmId = 'joint_l_arm';
    const rightArmId = 'joint_r_arm';
    
    state.addJoint('obj_player', {
      id: leftArmId,
      name: 'AutoRig_L_Shoulder',
      position: [0, 1, 0.5],
      rotation: [0, 0, 0],
      parentId: null,
    });
    
    state.addJoint('obj_player', {
      id: rightArmId,
      name: 'AutoRig_R_Shoulder',
      position: [0, 1, -0.5],
      rotation: [0, 0, 0],
      parentId: null,
    });

    // Verify that getMirrorAxis returns 'z' because the max coordinate spread is along Z
    const updatedPlayer1 = useStore.getState().objects.find(o => o.id === 'obj_player')!;
    const mirrorAxis = getMirrorAxis(updatedPlayer1.joints || []);
    expect(mirrorAxis).toBe('z');

    // Update left arm rotation
    state.updateJoint('obj_player', leftArmId, {
      rotation: [45, 30, 15],
    });

    // The counterpart (right arm) should be updated symmetrically.
    // For Z-mirror, updates.rotation = [rx, ry, rz] becomes [-rx, -ry, rz], so [-45, -30, 15].
    const updatedPlayer2 = useStore.getState().objects.find(o => o.id === 'obj_player')!;
    const rightArm = updatedPlayer2.joints!.find(j => j.id === rightArmId)!;
    expect(rightArm.rotation).toEqual([-45, -30, 15]);

    // Update left arm position
    state.updateJoint('obj_player', leftArmId, {
      position: [0.1, 1.2, 0.6],
    });

    // The counterpart (right arm) position should negate the Z coordinate: [0.1, 1.2, -0.6]
    const updatedPlayer3 = useStore.getState().objects.find(o => o.id === 'obj_player')!;
    const rightArmPos = updatedPlayer3.joints!.find(j => j.id === rightArmId)!;
    expect(rightArmPos.position).toEqual([0.1, 1.2, -0.6]);
  });

  it('should anti-mirror (invert Pitch) joint updates under antiSymmetry', () => {
    const state = useStore.getState();
    
    // Enable symmetry AND anti-symmetry
    useStore.setState({ symmetryEnabled: true, antiSymmetryEnabled: true });

    const leftArmId = 'joint_l_arm';
    const rightArmId = 'joint_r_arm';

    // Update left arm rotation with pitch=45, yaw=30, roll=15
    state.updateJoint('obj_player', leftArmId, {
      rotation: [45, 30, 15],
    });

    // The counterpart (right arm) should be updated with anti-symmetry.
    // For Z-mirror, updates.rotation = [rx, ry, rz] becomes [-rx, -ry, -rz], so [-45, -30, -15].
    const updatedPlayer = useStore.getState().objects.find(o => o.id === 'obj_player')!;
    const rightArm = updatedPlayer.joints!.find(j => j.id === rightArmId)!;
    expect(rightArm.rotation).toEqual([-45, -30, -15]);

    // Restore store defaults
    useStore.setState({ symmetryEnabled: true, antiSymmetryEnabled: false });
  });
});

