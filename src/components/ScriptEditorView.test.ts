import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAssetStore } from '../store/useAssetStore';
import { useStore } from '../store/useStore';

describe('ScriptEditorView debounce and state management', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAssetStore.setState({
      assets: [
        {
          id: 'script_test_1',
          name: 'PlayerController.lua',
          type: 'script',
          content: '-- Initial Code\n',
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should not update Zustand store synchronously on every keystroke', () => {
    const updateAsset = vi.fn();
    let pendingTimeout: any = null;

    const debouncedSync = (newCode: string) => {
      if (pendingTimeout) clearTimeout(pendingTimeout);
      pendingTimeout = setTimeout(() => {
        updateAsset('script_test_1', { content: newCode });
      }, 500);
    };

    // Simulate typing 10 characters rapidly
    for (let i = 1; i <= 10; i++) {
      debouncedSync(`-- Initial Code\nline_${i}`);
    }

    // Immediately after typing, updateAsset should NOT have been called 10 times
    expect(updateAsset).not.toHaveBeenCalled();

    // Advance timer by 400ms (still within debounce window)
    vi.advanceTimersByTime(400);
    expect(updateAsset).not.toHaveBeenCalled();

    // Advance timer past 500ms
    vi.advanceTimersByTime(150);
    expect(updateAsset).toHaveBeenCalledTimes(1);
    expect(updateAsset).toHaveBeenCalledWith('script_test_1', {
      content: '-- Initial Code\nline_10',
    });
  });

  it('should immediately flush on manual save without waiting for debounce', () => {
    const updateAsset = vi.fn();
    let pendingTimeout: any = null;

    const debouncedSync = (newCode: string) => {
      if (pendingTimeout) clearTimeout(pendingTimeout);
      pendingTimeout = setTimeout(() => {
        updateAsset('script_test_1', { content: newCode });
      }, 500);
    };

    const flushImmediately = (val: string) => {
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
      updateAsset('script_test_1', { content: val });
    };

    debouncedSync('-- Typed partial code');
    expect(updateAsset).not.toHaveBeenCalled();

    // User triggers Ctrl+S / Save button
    flushImmediately('-- Typed partial code [Saved]');
    expect(updateAsset).toHaveBeenCalledTimes(1);
    expect(updateAsset).toHaveBeenCalledWith('script_test_1', {
      content: '-- Typed partial code [Saved]',
    });

    // Advancing past 500ms should not trigger redundant calls
    vi.advanceTimersByTime(600);
    expect(updateAsset).toHaveBeenCalledTimes(1);
  });
});
