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
      geometry: 'box',
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
});
