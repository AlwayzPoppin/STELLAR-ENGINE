import { describe, it, expect } from 'vitest';
import { useLogStore } from './useLogStore';

describe('useLogStore', () => {
  it('should have initial logs', () => {
    const state = useLogStore.getState();
    expect(state.logs.length).toBe(0);
  });

  it('should add a log', () => {
    const store = useLogStore;
    store.getState().addLog('log', 'Test print message');

    const updatedState = store.getState();
    const lastLog = updatedState.logs[updatedState.logs.length - 1];
    expect(lastLog.message).toBe('Test print message');
    expect(lastLog.type).toBe('log');
  });

  it('should clear logs', () => {
    const store = useLogStore;
    store.getState().clearLogs();

    const updatedState = store.getState();
    expect(updatedState.logs.length).toBe(0);
  });

  it('should cap logs list at 1000 items', () => {
    const store = useLogStore;
    store.getState().clearLogs();

    // Add 1050 logs
    for (let i = 0; i < 1050; i++) {
      store.getState().addLog('log', `Message ${i}`);
    }

    const updatedState = store.getState();
    expect(updatedState.logs.length).toBe(1000);
    // The first item in logs should be the 50th message
    expect(updatedState.logs[0].message).toBe('Message 50');
  });
});
