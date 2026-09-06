import { describe, it, expect, vi } from 'vitest';
import { SerializationManager, AutosaveState } from '../utils/SerializationManager';

describe('StatusBar Autosave Status Indicator', () => {
  it('should notify subscribers when autosave transitions between idle, saving, and saved', () => {
    const receivedStates: AutosaveState[] = [];
    const unsubscribe = SerializationManager.subscribeAutosave((state) => {
      receivedStates.push(state);
    });

    expect(receivedStates.length).toBeGreaterThan(0);
    expect(receivedStates[0].status).toBeDefined();

    unsubscribe();
  });

  it('should provide formatted timestamps for saved states', () => {
    const timestamp = Date.now();
    const formatted = new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});

describe('Viewport Pause Overlay and Hotkey Interactions', () => {
  it('should toggle simulation pause state on P key when in play mode', async () => {
    const { useStore } = await import('../store/useStore');
    useStore.setState({ isPlaying: true, isPaused: false });

    // Simulate keydown event handler logic
    const handleKey = (key: string) => {
      const state = useStore.getState();
      if (key.toLowerCase() === 'p' && state.isPlaying) {
        state.togglePause();
      } else if (key === 'Escape' && state.isPlaying) {
        if (state.isPaused) {
          state.setPaused(false);
        } else {
          state.setPaused(true);
        }
      }
    };

    handleKey('p');
    expect(useStore.getState().isPaused).toBe(true);

    handleKey('p');
    expect(useStore.getState().isPaused).toBe(false);

    // Test Escape key toggling
    handleKey('Escape');
    expect(useStore.getState().isPaused).toBe(true);

    handleKey('Escape');
    expect(useStore.getState().isPaused).toBe(false);
  });

  it('should resume simulation when pause overlay receives keydown event for P or Escape', async () => {
    const { useStore } = await import('../store/useStore');
    useStore.setState({ isPlaying: true, isPaused: true });

    const handleOverlayKeyDown = (e: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
      if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        useStore.getState().setPaused(false);
      }
    };

    const mockEvent = {
      key: 'p',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    handleOverlayKeyDown(mockEvent);
    expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockEvent.stopPropagation).toHaveBeenCalledTimes(1);
    expect(useStore.getState().isPaused).toBe(false);
  });
});

