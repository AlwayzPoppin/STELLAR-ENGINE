import { describe, it, expect, beforeEach } from 'vitest';
import { useAnimationStore } from './useAnimationStore';

describe('useAnimationStore - Insymmetry State', () => {
  beforeEach(() => {
    // Reset state before each test
    useAnimationStore.setState({
      insymmetryEnabled: false,
      gaitAsymmetry: 0.0,
      postureBias: 0.0,
      dynamicVariance: 0.0,
      loopMode: 'loop',
    });
  });

  it('should initialize with default insymmetry settings', () => {
    const state = useAnimationStore.getState();
    expect(state.insymmetryEnabled).toBe(false);
    expect(state.gaitAsymmetry).toBe(0.0);
    expect(state.postureBias).toBe(0.0);
    expect(state.dynamicVariance).toBe(0.0);
  });

  it('should toggle and set insymmetry values', () => {
    const store = useAnimationStore.getState();

    store.setInsymmetryEnabled(true);
    expect(useAnimationStore.getState().insymmetryEnabled).toBe(true);

    store.setGaitAsymmetry(0.75);
    expect(useAnimationStore.getState().gaitAsymmetry).toBe(0.75);

    store.setPostureBias(-0.4);
    expect(useAnimationStore.getState().postureBias).toBe(-0.4);

    store.setDynamicVariance(0.9);
    expect(useAnimationStore.getState().dynamicVariance).toBe(0.9);
  });

  it('should set loop mode correctly using setLoopMode action', () => {
    const store = useAnimationStore.getState();
    store.setLoopMode('pingpong');
    expect(useAnimationStore.getState().loopMode).toBe('pingpong');
  });
});
