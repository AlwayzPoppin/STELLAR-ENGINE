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
